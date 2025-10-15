/**
 * Case Notification Model
 * Tracks all notifications sent for cases
 */

const BaseModel = require('./BaseModel');

class CaseNotification extends BaseModel {
  constructor() {
    super('case_notifications');
  }

  /**
   * Create a notification record
   */
  async createNotification({
    case_id,
    recipient_email,
    recipient_name,
    notification_type,
    subject,
    status = 'pending',
    metadata = {}
  }) {
    try {
      const notification = await this.create({
        case_id,
        recipient_email,
        recipient_name,
        notification_type,
        subject,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        metadata
      });

      return notification;
    } catch (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Update notification status
   */
  async updateStatus(notificationId, status, errorMessage = null) {
    try {
      const updates = {
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null
      };

      if (errorMessage) {
        updates.metadata = { error: errorMessage };
      }

      return await this.updateById(notificationId, updates);
    } catch (error) {
      throw new Error(`Failed to update notification status: ${error.message}`);
    }
  }

  /**
   * Get all notifications for a case
   */
  async getCaseNotifications(caseId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get case notifications: ${error.message}`);
    }
  }

  /**
   * Get notifications by type
   */
  async getNotificationsByType(caseId, notificationType) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('case_id', caseId)
        .eq('notification_type', notificationType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get notifications by type: ${error.message}`);
    }
  }

  /**
   * Check if notification was already sent
   */
  async wasNotificationSent(caseId, notificationType, recipientEmail) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id, status')
        .eq('case_id', caseId)
        .eq('notification_type', notificationType)
        .eq('recipient_email', recipientEmail)
        .eq('status', 'sent')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get pending notifications (for retry logic)
   */
  async getPendingNotifications(limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get pending notifications: ${error.message}`);
    }
  }

  /**
   * Get notification statistics for a case
   */
  async getNotificationStats(caseId) {
    try {
      const allNotifications = await this.getCaseNotifications(caseId);
      
      const stats = {
        total: allNotifications.length,
        sent: allNotifications.filter(n => n.status === 'sent').length,
        pending: allNotifications.filter(n => n.status === 'pending').length,
        failed: allNotifications.filter(n => n.status === 'failed').length,
        byType: {}
      };

      // Group by type
      allNotifications.forEach(notification => {
        if (!stats.byType[notification.notification_type]) {
          stats.byType[notification.notification_type] = {
            total: 0,
            sent: 0,
            pending: 0,
            failed: 0
          };
        }
        stats.byType[notification.notification_type].total++;
        stats.byType[notification.notification_type][notification.status]++;
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get notification stats: ${error.message}`);
    }
  }
}

module.exports = new CaseNotification();
