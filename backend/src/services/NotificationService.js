// Notification Service - Phase 3 notification system for multi-party workflows
const logger = require('../lib/logger');
const { supabaseAdmin } = require('../lib/supabaseClient');
const mailer = require('../lib/mailer');

class NotificationService {
  constructor() {
    this.notificationTypes = {
      INVITATION_RECEIVED: 'invitation_received',
      INVITATION_ACCEPTED: 'invitation_accepted',
      INVITATION_DECLINED: 'invitation_declined',
      NEGOTIATION_STARTED: 'negotiation_started',
      PROPOSAL_RECEIVED: 'proposal_received',
      PROPOSAL_ACCEPTED: 'proposal_accepted',
      PROPOSAL_REJECTED: 'proposal_rejected',
      SIGNATURE_REQUESTED: 'signature_requested',
      DOCUMENT_SIGNED: 'document_signed',
      SETTLEMENT_REACHED: 'settlement_reached',
      CASE_UPDATE: 'case_update',
      DEADLINE_APPROACHING: 'deadline_approaching',
      SYSTEM_ALERT: 'system_alert'
    };

    this.priorities = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      URGENT: 'urgent'
    };

    this.emailTemplates = {
      [this.notificationTypes.INVITATION_RECEIVED]: {
        subject: 'You have been invited to join a legal case',
        template: 'case-invitation'
      },
      [this.notificationTypes.NEGOTIATION_STARTED]: {
        subject: 'Settlement negotiation has started',
        template: 'negotiation-started'
      },
      [this.notificationTypes.PROPOSAL_RECEIVED]: {
        subject: 'New settlement proposal received',
        template: 'proposal-received'
      },
      [this.notificationTypes.SIGNATURE_REQUESTED]: {
        subject: 'Document signature required',
        template: 'signature-request'
      },
      [this.notificationTypes.SETTLEMENT_REACHED]: {
        subject: 'Settlement agreement reached',
        template: 'settlement-reached'
      },
      [this.notificationTypes.DEADLINE_APPROACHING]: {
        subject: 'Important deadline approaching',
        template: 'deadline-reminder'
      }
    };
  }

  /**
   * Create a notification
   */
  async createNotification({
    userId,
    caseId = null,
    type,
    title,
    message,
    priority = this.priorities.MEDIUM,
    actionUrl = null,
    actionData = null,
    sendEmail = true,
    sendRealtime = true,
    expiresAt = null
  }) {
    try {
      logger.info('Creating notification', { 
        userId, 
        caseId, 
        type, 
        title, 
        priority 
      });

      // Validate notification type
      if (!Object.values(this.notificationTypes).includes(type)) {
        throw new Error(`Invalid notification type: ${type}`);
      }

      // Validate priority
      if (!Object.values(this.priorities).includes(priority)) {
        throw new Error(`Invalid priority: ${priority}`);
      }

      // Create notification record
      const { data: notification, error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          case_id: caseId,
          notification_type: type,
          title,
          message,
          priority,
          action_url: actionUrl,
          action_data: actionData,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      logger.info('Notification created successfully', { 
        notificationId: notification.notification_id 
      });

      // Send email notification if requested
      if (sendEmail) {
        await this.sendEmailNotification(notification);
      }

      // Send real-time notification if requested
      if (sendRealtime) {
        await this.sendRealtimeNotification(notification);
      }

      return notification;

    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(notification) {
    try {
      // Get user email
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('email, full_name')
        .eq('user_id', notification.user_id)
        .single();

      if (userError || !user) {
        logger.warn('User not found for email notification', { 
          userId: notification.user_id 
        });
        return;
      }

      const emailTemplate = this.emailTemplates[notification.notification_type];
      if (!emailTemplate) {
        logger.warn('No email template found for notification type', { 
          type: notification.notification_type 
        });
        return;
      }

      // Get additional context for email
      let emailContext = {
        userName: user.full_name,
        notificationTitle: notification.title,
        notificationMessage: notification.message,
        actionUrl: notification.action_url,
        actionData: notification.action_data
      };

      // Add case-specific context if available
      if (notification.case_id) {
        const { data: caseData } = await supabaseAdmin
          .from('cases')
          .select('case_title, case_number')
          .eq('case_id', notification.case_id)
          .single();

        if (caseData) {
          emailContext.caseTitle = caseData.case_title;
          emailContext.caseNumber = caseData.case_number;
        }
      }

      // Send email
      await mailer.sendTemplateEmail({
        to: user.email,
        subject: emailTemplate.subject,
        template: emailTemplate.template,
        context: emailContext
      });

      // Update notification as email sent
      await supabaseAdmin
        .from('notifications')
        .update({ 
          is_email_sent: true,
          updated_at: new Date().toISOString()
        })
        .eq('notification_id', notification.notification_id);

      logger.info('Email notification sent successfully', { 
        notificationId: notification.notification_id,
        email: user.email
      });

    } catch (error) {
      logger.error('Error sending email notification:', error);
      // Don't throw - we don't want to fail notification creation
    }
  }

  /**
   * Send real-time notification via WebSocket
   */
  async sendRealtimeNotification(notification) {
    try {
      // Import RealTimeService to avoid circular dependency
      const RealTimeService = require('./RealTimeService');
      const realTimeService = new RealTimeService();

      // Send to user's personal room
      await realTimeService.sendToUser(notification.user_id, 'notification', {
        notificationId: notification.notification_id,
        type: notification.notification_type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        actionUrl: notification.action_url,
        actionData: notification.action_data,
        createdAt: notification.created_at,
        caseId: notification.case_id
      });

      // Also send to case room if case-related
      if (notification.case_id) {
        await realTimeService.sendToCaseRoom(notification.case_id, 'case_notification', {
          notificationId: notification.notification_id,
          userId: notification.user_id,
          type: notification.notification_type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          createdAt: notification.created_at
        });
      }

      // Update notification as real-time sent
      await supabaseAdmin
        .from('notifications')
        .update({ 
          is_realtime_sent: true,
          updated_at: new Date().toISOString()
        })
        .eq('notification_id', notification.notification_id);

      logger.info('Real-time notification sent successfully', { 
        notificationId: notification.notification_id 
      });

    } catch (error) {
      logger.error('Error sending real-time notification:', error);
      // Don't throw - we don't want to fail notification creation
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, { 
    limit = 50, 
    offset = 0, 
    unreadOnly = false,
    type = null,
    caseId = null 
  } = {}) {
    try {
      let query = supabaseAdmin
        .from('notifications')
        .select(`
          notification_id,
          notification_type,
          title,
          message,
          priority,
          is_read,
          action_url,
          action_data,
          created_at,
          case_id,
          cases(case_title, case_number)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      if (type) {
        query = query.eq('notification_type', type);
      }

      if (caseId) {
        query = query.eq('case_id', caseId);
      }

      // Only show non-expired notifications
      query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      const { data: notifications, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }

      logger.info('User notifications retrieved', { 
        userId, 
        count: notifications.length 
      });

      return notifications;

    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('notification_id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to mark notification as read: ${error.message}`);
      }

      logger.info('Notification marked as read', { notificationId, userId });

      return data;

    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId, caseId = null) {
    try {
      let query = supabaseAdmin
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (caseId) {
        query = query.eq('case_id', caseId);
      }

      const { data, error } = await query.select();

      if (error) {
        throw new Error(`Failed to mark notifications as read: ${error.message}`);
      }

      logger.info('All notifications marked as read', { 
        userId, 
        caseId, 
        count: data.length 
      });

      return data;

    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification counts
   */
  async getNotificationCounts(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('is_read, priority, notification_type')
        .eq('user_id', userId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      if (error) {
        throw new Error(`Failed to get notification counts: ${error.message}`);
      }

      const counts = {
        total: data.length,
        unread: data.filter(n => !n.is_read).length,
        urgent: data.filter(n => n.priority === this.priorities.URGENT && !n.is_read).length,
        high: data.filter(n => n.priority === this.priorities.HIGH && !n.is_read).length,
        byType: {}
      };

      // Count by type
      Object.values(this.notificationTypes).forEach(type => {
        counts.byType[type] = data.filter(n => n.notification_type === type && !n.is_read).length;
      });

      logger.info('Notification counts retrieved', { userId, counts });

      return counts;

    } catch (error) {
      logger.error('Error getting notification counts:', error);
      throw error;
    }
  }

  /**
   * Delete expired notifications
   */
  async cleanupExpiredNotifications() {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select();

      if (error) {
        throw new Error(`Failed to cleanup expired notifications: ${error.message}`);
      }

      logger.info('Expired notifications cleaned up', { count: data.length });

      return data;

    } catch (error) {
      logger.error('Error cleaning up expired notifications:', error);
      throw error;
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  async sendBulkNotifications(notifications) {
    try {
      const results = [];

      for (const notif of notifications) {
        try {
          const result = await this.createNotification(notif);
          results.push({ success: true, notificationId: result.notification_id });
        } catch (error) {
          results.push({ success: false, error: error.message, notification: notif });
          logger.error('Error in bulk notification:', error);
        }
      }

      logger.info('Bulk notifications processed', { 
        total: notifications.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;

    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  // =============================================================================
  // SPECIALIZED NOTIFICATION METHODS
  // =============================================================================

  /**
   * Send invitation notification
   */
  async sendInvitationNotification(inviteeEmail, inviterName, caseTitle, invitationToken) {
    // This will be sent to email since user might not exist yet
    try {
      const emailContext = {
        inviterName,
        caseTitle,
        acceptUrl: `${process.env.FRONTEND_URL}/invitations/${invitationToken}/accept`,
        declineUrl: `${process.env.FRONTEND_URL}/invitations/${invitationToken}/decline`
      };

      await mailer.sendTemplateEmail({
        to: inviteeEmail,
        subject: `You have been invited to join legal case: ${caseTitle}`,
        template: 'case-invitation',
        context: emailContext
      });

      logger.info('Invitation email sent', { inviteeEmail, caseTitle });

    } catch (error) {
      logger.error('Error sending invitation notification:', error);
      throw error;
    }
  }

  /**
   * Send deadline reminder notifications
   */
  async sendDeadlineReminders() {
    try {
      // Check for invitations expiring in 24 hours
      const { data: expiringInvitations } = await supabaseAdmin
        .from('party_invitations')
        .select(`
          invitation_id,
          invitee_email,
          invitee_name,
          expires_at,
          cases(case_title, case_number)
        `)
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString())
        .lt('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      // Check for signature requests expiring in 24 hours
      const { data: expiringSignatures } = await supabaseAdmin
        .from('signature_assignments')
        .select(`
          assignment_id,
          signer_email,
          signer_name,
          signer_user_id,
          signature_requests(
            expires_at,
            document_title,
            cases(case_title, case_number)
          )
        `)
        .eq('status', 'pending')
        .gte('signature_requests.expires_at', new Date().toISOString())
        .lt('signature_requests.expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      // Send invitation deadline reminders
      for (const invitation of expiringInvitations || []) {
        await mailer.sendTemplateEmail({
          to: invitation.invitee_email,
          subject: `Reminder: Case invitation expires soon - ${invitation.cases.case_title}`,
          template: 'invitation-reminder',
          context: {
            inviteeName: invitation.invitee_name,
            caseTitle: invitation.cases.case_title,
            expiresAt: invitation.expires_at
          }
        });
      }

      // Send signature deadline reminders
      for (const signature of expiringSignatures || []) {
        const emailContext = {
          signerName: signature.signer_name,
          documentTitle: signature.signature_requests.document_title,
          caseTitle: signature.signature_requests.cases.case_title,
          expiresAt: signature.signature_requests.expires_at
        };

        // Send email reminder
        await mailer.sendTemplateEmail({
          to: signature.signer_email,
          subject: `Reminder: Document signature required - ${signature.signature_requests.document_title}`,
          template: 'signature-reminder',
          context: emailContext
        });

        // Also send in-app notification if user exists
        if (signature.signer_user_id) {
          await this.createNotification({
            userId: signature.signer_user_id,
            type: this.notificationTypes.DEADLINE_APPROACHING,
            title: 'Document signature deadline approaching',
            message: `The signature for "${signature.signature_requests.document_title}" expires in 24 hours`,
            priority: this.priorities.HIGH,
            actionUrl: `/signatures/${signature.assignment_id}/sign`,
            sendEmail: false // Already sent above
          });
        }
      }

      logger.info('Deadline reminders sent', {
        invitations: expiringInvitations?.length || 0,
        signatures: expiringSignatures?.length || 0
      });

    } catch (error) {
      logger.error('Error sending deadline reminders:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();