// Invitation Service - Manage party invitations to cases
const Case = require('../models/Case');
const CaseParty = require('../models/CaseParty');
const User = require('../models/User');
const { supabase } = require('../lib/supabaseClient');
const { logger } = require('../lib/logger');
const mailer = require('../lib/mailer');
const { v4: uuidv4 } = require('uuid');

class InvitationService {
  constructor() {
    this.invitationTokens = new Map(); // In-memory storage for tokens
  }

  // Invite a party to join a case
  async inviteParty(caseId, inviterUserId, inviteeData) {
    try {
      logger.info(`Inviting party to case ${caseId}`, { inviteeData });

      // Verify case exists and inviter has permission
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      if (!await Case.hasAccess(caseId, inviterUserId)) {
        throw new Error('Access denied to invite parties to this case');
      }

      // Check if party is already in the case
      const existingParty = await CaseParty.findOne({
        case_id: caseId,
        contact_email: inviteeData.email
      });

      if (existingParty) {
        throw new Error('Party is already part of this case');
      }

      // Generate invitation token
      const invitationToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Store invitation details
      const invitation = {
        id: uuidv4(),
        case_id: caseId,
        inviter_user_id: inviterUserId,
        invitee_email: inviteeData.email,
        invitee_name: inviteeData.name,
        party_role: inviteeData.role || 'respondent',
        invitation_token: invitationToken,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        invitation_message: inviteeData.message || null
      };

      // Store in database
      const { data, error } = await supabase
        .from('case_invitations')
        .insert([invitation])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create invitation: ${error.message}`);
      }

      // Cache token for quick lookup
      this.invitationTokens.set(invitationToken, {
        ...invitation,
        case_title: caseData.title
      });

      // Send invitation email
      await this.sendInvitationEmail(invitation, caseData);

      logger.info(`Invitation sent successfully`, { 
        invitationId: data.id, 
        caseId,
        inviteeEmail: inviteeData.email 
      });

      return {
        success: true,
        invitation: data,
        invitation_token: invitationToken,
        expires_at: expiresAt
      };

    } catch (error) {
      logger.error(`Failed to invite party to case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Accept an invitation
  async acceptInvitation(invitationToken, acceptingUserId) {
    try {
      logger.info(`Processing invitation acceptance`, { invitationToken });

      // Get invitation details
      const invitation = await this.getInvitationByToken(invitationToken);
      if (!invitation) {
        throw new Error('Invalid or expired invitation token');
      }

      if (invitation.status !== 'pending') {
        throw new Error(`Invitation is already ${invitation.status}`);
      }

      if (new Date() > new Date(invitation.expires_at)) {
        throw new Error('Invitation has expired');
      }

      // Get or create user for the invitee
      let inviteeUser = await User.findOne({ email: invitation.invitee_email });
      
      if (!inviteeUser) {
        // Create new user account for invitee
        inviteeUser = await User.create({
          email: invitation.invitee_email,
          full_name: invitation.invitee_name,
          auth_provider: 'invitation',
          status: 'active',
          role: 'party'
        });
      }

      // Add party to case
      const partyData = await CaseParty.create({
        case_id: invitation.case_id,
        user_id: inviteeUser.id,
        role: invitation.party_role,
        contact_email: invitation.invitee_email,
        contact_name: invitation.invitee_name,
        status: 'active',
        joined_at: new Date().toISOString()
      });

      // Update invitation status
      await this.updateInvitationStatus(invitation.id, 'accepted', inviteeUser.id);

      // Remove from cache
      this.invitationTokens.delete(invitationToken);

      logger.info(`Invitation accepted successfully`, { 
        invitationId: invitation.id,
        caseId: invitation.case_id,
        userId: inviteeUser.id 
      });

      return {
        success: true,
        party: partyData,
        user: inviteeUser,
        case_id: invitation.case_id
      };

    } catch (error) {
      logger.error(`Failed to accept invitation:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Decline an invitation
  async declineInvitation(invitationToken, reason = null) {
    try {
      const invitation = await this.getInvitationByToken(invitationToken);
      if (!invitation) {
        throw new Error('Invalid or expired invitation token');
      }

      await this.updateInvitationStatus(invitation.id, 'declined', null, reason);
      this.invitationTokens.delete(invitationToken);

      logger.info(`Invitation declined`, { invitationId: invitation.id });

      return {
        success: true,
        message: 'Invitation declined successfully'
      };

    } catch (error) {
      logger.error(`Failed to decline invitation:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get invitation by token
  async getInvitationByToken(token) {
    try {
      // Check cache first
      if (this.invitationTokens.has(token)) {
        return this.invitationTokens.get(token);
      }

      // Query database
      const { data, error } = await supabase
        .from('case_invitations')
        .select(`
          *,
          cases!inner(title, case_type, description)
        `)
        .eq('invitation_token', token)
        .single();

      if (error || !data) {
        return null;
      }

      // Cache for future use
      this.invitationTokens.set(token, {
        ...data,
        case_title: data.cases.title
      });

      return data;

    } catch (error) {
      logger.error(`Failed to get invitation by token:`, error);
      return null;
    }
  }

  // Update invitation status
  async updateInvitationStatus(invitationId, status, userId = null, reason = null) {
    const updateData = {
      status,
      responded_at: new Date().toISOString()
    };

    if (userId) updateData.responding_user_id = userId;
    if (reason) updateData.decline_reason = reason;

    const { error } = await supabase
      .from('case_invitations')
      .update(updateData)
      .eq('id', invitationId);

    if (error) {
      throw new Error(`Failed to update invitation status: ${error.message}`);
    }
  }

  // Send invitation email
  async sendInvitationEmail(invitation, caseData) {
    try {
      const invitationUrl = `${process.env.FRONTEND_URL}/invitation/${invitation.invitation_token}`;
      
      const emailData = {
        to: invitation.invitee_email,
        subject: `Invitation to Join Legal Case: ${caseData.title}`,
        template: 'case-invitation',
        data: {
          invitee_name: invitation.invitee_name,
          case_title: caseData.title,
          case_type: caseData.case_type,
          party_role: invitation.party_role,
          invitation_url: invitationUrl,
          expires_at: new Date(invitation.expires_at).toLocaleDateString(),
          invitation_message: invitation.invitation_message,
          dispute_amount: caseData.dispute_amount,
          currency: caseData.currency
        }
      };

      await mailer.sendEmail(emailData);
      logger.info(`Invitation email sent to ${invitation.invitee_email}`);

    } catch (error) {
      logger.error(`Failed to send invitation email:`, error);
      // Don't throw error - invitation still created even if email fails
    }
  }

  // Get all invitations for a case
  async getCaseInvitations(caseId, userId) {
    try {
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied to case invitations');
      }

      const { data, error } = await supabase
        .from('case_invitations')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch invitations: ${error.message}`);
      }

      return {
        success: true,
        invitations: data
      };

    } catch (error) {
      logger.error(`Failed to get case invitations:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Resend invitation
  async resendInvitation(invitationId, userId) {
    try {
      const { data: invitation, error } = await supabase
        .from('case_invitations')
        .select(`
          *,
          cases!inner(*)
        `)
        .eq('id', invitationId)
        .single();

      if (error || !invitation) {
        throw new Error('Invitation not found');
      }

      if (!await Case.hasAccess(invitation.case_id, userId)) {
        throw new Error('Access denied to resend invitation');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only resend pending invitations');
      }

      // Extend expiration by 7 days
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await supabase
        .from('case_invitations')
        .update({ 
          expires_at: newExpiresAt.toISOString(),
          resent_at: new Date().toISOString()
        })
        .eq('id', invitationId);

      // Send email again
      await this.sendInvitationEmail(invitation, invitation.cases);

      return {
        success: true,
        message: 'Invitation resent successfully',
        expires_at: newExpiresAt
      };

    } catch (error) {
      logger.error(`Failed to resend invitation:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Cancel invitation
  async cancelInvitation(invitationId, userId) {
    try {
      const { data: invitation, error } = await supabase
        .from('case_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();

      if (error || !invitation) {
        throw new Error('Invitation not found');
      }

      if (!await Case.hasAccess(invitation.case_id, userId)) {
        throw new Error('Access denied to cancel invitation');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only cancel pending invitations');
      }

      await this.updateInvitationStatus(invitationId, 'cancelled');
      this.invitationTokens.delete(invitation.invitation_token);

      return {
        success: true,
        message: 'Invitation cancelled successfully'
      };

    } catch (error) {
      logger.error(`Failed to cancel invitation:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Cleanup expired invitations
  async cleanupExpiredInvitations() {
    try {
      const { data, error } = await supabase
        .from('case_invitations')
        .update({ status: 'expired' })
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'pending')
        .select('invitation_token');

      if (error) {
        logger.error('Failed to cleanup expired invitations:', error);
        return;
      }

      // Remove from cache
      data.forEach(invitation => {
        this.invitationTokens.delete(invitation.invitation_token);
      });

      logger.info(`Cleaned up ${data.length} expired invitations`);

    } catch (error) {
      logger.error('Error during invitation cleanup:', error);
    }
  }
}

module.exports = new InvitationService();