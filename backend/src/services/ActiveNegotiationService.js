// Active Settlement Negotiation Service - Core Business Logic
// Real-time multi-party negotiation session management with AI assistance

const { supabase } = require('../lib/supabaseClient');
const emailService = require('./EmailService');

class ActiveNegotiationService {
  constructor() {
    try {
      console.log('Initializing ActiveNegotiationService...');
      this.emailService = emailService;
      this.sessionCache = new Map(); // Cache for active sessions
      this.cleanupInterval = null;
      
      // Start cleanup timer (run every 5 minutes) - but not in test environment
      if (process.env.NODE_ENV !== 'test') {
        this.startCleanupTimer();
      }
      console.log('ActiveNegotiationService initialized successfully');
    } catch (error) {
      console.error('Error initializing ActiveNegotiationService:', error);
      throw error;
    }
  }

  /**
   * Create new negotiation session
   */
  async createNegotiationSession(sessionData) {
    const { 
      caseId, 
      initiatorId, 
      initialOffer, 
      maxRounds, 
      deadlineHours, 
      allowCounterOffers, 
      parties 
    } = sessionData;

    try {
      // Calculate deadline
      const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

      // Create session record
      const { data: session, error: sessionError } = await supabase
        .from('negotiation_sessions')
        .insert({
          case_id: caseId,
          initiator_id: initiatorId,
          status: 'active',
          current_round: 1,
          max_rounds: maxRounds,
          deadline: deadline.toISOString(),
          allow_counter_offers: allowCounterOffers,
          initial_offer: initialOffer,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add parties to session
      const partyInserts = parties.map(party => ({
        session_id: session.id,
        user_id: party.user_id,
        role: party.role,
        name: party.name,
        email: party.email,
        has_responded: false,
        last_response_round: 0,
        joined_at: new Date().toISOString()
      }));

      const { error: partiesError } = await supabase
        .from('negotiation_participants')
        .insert(partyInserts);

      if (partiesError) throw partiesError;

      // Log initial activity
      await this.logActivity(session.id, {
        type: 'session_created',
        userId: initiatorId,
        details: {
          initialOffer,
          maxRounds,
          deadline: deadline.toISOString(),
          partiesCount: parties.length
        }
      });

      // Send invitation emails to all parties
      await this.sendNegotiationInvitations(session.id, parties, initialOffer);

      // Cache session
      this.sessionCache.set(session.id, {
        ...session,
        parties: partyInserts
      });

      return session;

    } catch (error) {
      console.error('Create negotiation session error:', error);
      throw new Error('Failed to create negotiation session');
    }
  }

  /**
   * Get negotiation session with basic details
   */
  async getSession(sessionId) {
    try {
      // Check cache first
      if (this.sessionCache.has(sessionId)) {
        return this.sessionCache.get(sessionId);
      }

      const { data: session, error } = await supabase
        .from('negotiation_sessions')
        .select(`
          *,
          negotiation_participants (
            user_id,
            role,
            name,
            email,
            has_responded,
            last_response_round
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      // Cache the session
      this.sessionCache.set(sessionId, session);
      return session;

    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Get negotiation session with full details
   */
  async getSessionWithDetails(sessionId) {
    try {
      const { data: session, error } = await supabase
        .from('negotiation_sessions')
        .select(`
          *,
          negotiation_participants (*),
          negotiation_responses (
            id,
            user_id,
            response,
            counter_offer,
            message,
            round_number,
            submitted_at
          ),
          negotiation_compromises (
            id,
            compromise_offer,
            ai_reasoning,
            confidence_score,
            generated_at
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return session;

    } catch (error) {
      console.error('Get session with details error:', error);
      return null;
    }
  }

  /**
   * Submit response to negotiation
   */
  async submitResponse(sessionId, responseData) {
    const { userId, response, counterOffer, message, roundNumber } = responseData;

    try {
      // Insert response
      const { data: responseRecord, error: responseError } = await supabase
        .from('negotiation_responses')
        .insert({
          session_id: sessionId,
          user_id: userId,
          response,
          counter_offer: counterOffer,
          message,
          round_number: roundNumber,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // Update participant status
      const { error: updateError } = await supabase
        .from('negotiation_participants')
        .update({
          has_responded: true,
          last_response_round: roundNumber,
          last_response_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Log activity
      await this.logActivity(sessionId, {
        type: 'response_submitted',
        userId,
        details: {
          response,
          counterOffer,
          roundNumber,
          hasMessage: !!message
        }
      });

      // Invalidate cache
      this.sessionCache.delete(sessionId);

      return responseRecord;

    } catch (error) {
      console.error('Submit response error:', error);
      throw new Error('Failed to submit response');
    }
  }

  /**
   * Evaluate and update session status
   */
  async evaluateAndUpdateSessionStatus(sessionId) {
    try {
      const session = await this.getSessionWithDetails(sessionId);
      if (!session) throw new Error('Session not found');

      const currentRound = session.current_round;
      const participants = session.negotiation_participants;
      const responses = session.negotiation_responses.filter(r => r.round_number === currentRound);

      // Check if all parties have responded in current round
      const allResponded = participants.every(p => p.has_responded && p.last_response_round === currentRound);

      let newStatus = session.status;
      let newRound = currentRound;

      if (allResponded) {
        // Analyze responses to determine next action
        const acceptances = responses.filter(r => r.response === 'accept').length;
        const rejections = responses.filter(r => r.response === 'reject').length;
        const counters = responses.filter(r => r.response === 'counter').length;

        if (acceptances === participants.length) {
          // All accepted - negotiation successful
          newStatus = 'completed_accepted';
          await this.finalizeNegotiation(sessionId, 'accepted');
        } else if (rejections === participants.length) {
          // All rejected - negotiation failed
          newStatus = 'completed_failed';
          await this.finalizeNegotiation(sessionId, 'failed');
        } else if (currentRound >= session.max_rounds) {
          // Max rounds reached
          newStatus = 'completed_max_rounds';
          await this.finalizeNegotiation(sessionId, 'max_rounds');
        } else if (counters > 0 && session.allow_counter_offers) {
          // Move to next round with counter offers
          newRound = currentRound + 1;
          await this.startNewRound(sessionId, newRound, responses);
        } else {
          // Mixed responses, no counters allowed - failed
          newStatus = 'completed_failed';
          await this.finalizeNegotiation(sessionId, 'failed');
        }
      }

      // Update session
      const { data: updatedSession, error: updateError } = await supabase
        .from('negotiation_sessions')
        .update({
          status: newStatus,
          current_round: newRound,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Invalidate cache
      this.sessionCache.delete(sessionId);

      return updatedSession;

    } catch (error) {
      console.error('Evaluate session status error:', error);
      throw new Error('Failed to evaluate session status');
    }
  }

  /**
   * Start new negotiation round
   */
  async startNewRound(sessionId, roundNumber, previousResponses) {
    try {
      // Reset participant response status for new round
      const { error: resetError } = await supabase
        .from('negotiation_participants')
        .update({
          has_responded: false
        })
        .eq('session_id', sessionId);

      if (resetError) throw resetError;

      // Find the most recent counter offer to use as the new base
      const counterOffers = previousResponses.filter(r => r.response === 'counter' && r.counter_offer);
      const latestCounterOffer = counterOffers.length > 0 ? 
        counterOffers[counterOffers.length - 1].counter_offer : null;

      // Log round start
      await this.logActivity(sessionId, {
        type: 'round_started',
        userId: null,
        details: {
          roundNumber,
          baseOffer: latestCounterOffer,
          previousResponsesCount: previousResponses.length
        }
      });

      // Send notifications about new round
      const session = await this.getSession(sessionId);
      await this.sendRoundNotifications(session, roundNumber, latestCounterOffer);

    } catch (error) {
      console.error('Start new round error:', error);
      throw new Error('Failed to start new round');
    }
  }

  /**
   * Finalize negotiation with outcome
   */
  async finalizeNegotiation(sessionId, outcome) {
    try {
      const finalizedAt = new Date().toISOString();
      
      // Update session with final outcome
      const { error: updateError } = await supabase
        .from('negotiation_sessions')
        .update({
          finalized_at: finalizedAt,
          final_outcome: outcome,
          updated_at: finalizedAt
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Log finalization
      await this.logActivity(sessionId, {
        type: 'negotiation_finalized',
        userId: null,
        details: {
          outcome,
          finalizedAt
        }
      });

      // Send final notifications
      const session = await this.getSession(sessionId);
      await this.sendFinalizationNotifications(session, outcome);

      // Remove from cache
      this.sessionCache.delete(sessionId);

    } catch (error) {
      console.error('Finalize negotiation error:', error);
      throw new Error('Failed to finalize negotiation');
    }
  }

  /**
   * Get session responses
   */
  async getSessionResponses(sessionId) {
    try {
      const { data: responses, error } = await supabase
        .from('negotiation_responses')
        .select(`
          *,
          users!negotiation_responses_user_id_fkey (
            email,
            full_name
          )
        `)
        .eq('session_id', sessionId)
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      return responses.map(response => ({
        ...response,
        user_email: response.users?.email,
        user_name: response.users?.full_name
      }));

    } catch (error) {
      console.error('Get session responses error:', error);
      return [];
    }
  }

  /**
   * Get session activity log
   */
  async getSessionActivity(sessionId, limit = 20) {
    try {
      const { data: activities, error } = await supabase
        .from('negotiation_activity_log')
        .select(`
          *,
          users!negotiation_activity_log_user_id_fkey (
            email,
            full_name
          )
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return activities;

    } catch (error) {
      console.error('Get session activity error:', error);
      return [];
    }
  }

  /**
   * Get pending responses count
   */
  async getPendingResponses(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session || session.status !== 'active') return [];

      const pendingParties = session.negotiation_participants.filter(
        p => !p.has_responded || p.last_response_round < session.current_round
      );

      return pendingParties;

    } catch (error) {
      console.error('Get pending responses error:', error);
      return [];
    }
  }

  /**
   * Get user's negotiations
   */
  async getUserNegotiations(userId, options = {}) {
    try {
      const { status, page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('negotiation_sessions')
        .select(`
          *,
          negotiation_participants!inner (
            role,
            name
          ),
          cases (
            title,
            case_number
          )
        `)
        .or(`initiator_id.eq.${userId},negotiation_participants.user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: negotiations, error, count } = await query;
      if (error) throw error;

      return {
        data: negotiations,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      console.error('Get user negotiations error:', error);
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Get user negotiation statistics
   */
  async getUserNegotiationStats(userId) {
    try {
      const { data: stats, error } = await supabase
        .rpc('get_user_negotiation_stats', { user_id: userId });

      if (error) throw error;

      return stats[0] || {
        total_negotiations: 0,
        active_negotiations: 0,
        completed_accepted: 0,
        completed_failed: 0,
        success_rate: 0,
        average_rounds: 0
      };

    } catch (error) {
      console.error('Get user negotiation stats error:', error);
      return {
        total_negotiations: 0,
        active_negotiations: 0,
        completed_accepted: 0,
        completed_failed: 0,
        success_rate: 0,
        average_rounds: 0
      };
    }
  }

  /**
   * Cancel negotiation session
   */
  async cancelSession(sessionId, cancellationData) {
    try {
      const { cancelledBy, reason } = cancellationData;

      const { error: updateError } = await supabase
        .from('negotiation_sessions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: cancelledBy,
          cancellation_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Log cancellation
      await this.logActivity(sessionId, {
        type: 'negotiation_cancelled',
        userId: cancelledBy,
        details: { reason }
      });

      // Remove from cache
      this.sessionCache.delete(sessionId);

    } catch (error) {
      console.error('Cancel session error:', error);
      throw new Error('Failed to cancel negotiation session');
    }
  }

  /**
   * Expire session due to deadline
   */
  async expireSession(sessionId) {
    try {
      const { error: updateError } = await supabase
        .from('negotiation_sessions')
        .update({
          status: 'expired',
          expired_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Log expiration
      await this.logActivity(sessionId, {
        type: 'negotiation_expired',
        userId: null,
        details: { expiredAt: new Date().toISOString() }
      });

      // Remove from cache
      this.sessionCache.delete(sessionId);

    } catch (error) {
      console.error('Expire session error:', error);
      throw new Error('Failed to expire negotiation session');
    }
  }

  /**
   * Get negotiation analytics
   */
  async getAnalytics(options = {}) {
    try {
      const { userId, timeframe = '30d', caseId } = options;

      const { data: analytics, error } = await supabase
        .rpc('get_negotiation_analytics', {
          p_user_id: userId,
          p_timeframe: timeframe,
          p_case_id: caseId
        });

      if (error) throw error;
      return analytics[0] || {};

    } catch (error) {
      console.error('Get analytics error:', error);
      return {};
    }
  }

  /**
   * Log activity for session
   */
  async logActivity(sessionId, activityData) {
    try {
      const { type, userId, details } = activityData;

      const { error } = await supabase
        .from('negotiation_activity_log')
        .insert({
          session_id: sessionId,
          activity_type: type,
          user_id: userId,
          details,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      console.error('Log activity error:', error);
      // Don't throw - activity logging shouldn't break main functionality
    }
  }

  /**
   * Send negotiation invitations
   */
  async sendNegotiationInvitations(sessionId, parties, initialOffer) {
    try {
      for (const party of parties) {
        const emailData = {
          to: party.email,
          subject: 'Settlement Negotiation Invitation',
          template: 'negotiation-invitation',
          variables: {
            recipientName: party.name,
            caseTitle: 'Legal Dispute Case', // TODO: Get from case data
            initialOffer: initialOffer.amount,
            sessionId,
            invitationLink: `${process.env.FRONTEND_URL}/negotiations/${sessionId}`
          }
        };

        // Send email (non-blocking)
        this.emailService.sendEmail(emailData).catch(error => {
          console.error(`Failed to send invitation to ${party.email}:`, error);
        });
      }

    } catch (error) {
      console.error('Send negotiation invitations error:', error);
    }
  }

  /**
   * Send round notifications
   */
  async sendRoundNotifications(session, roundNumber, baseOffer) {
    // TODO: Implement round notification emails
    console.log(`Round ${roundNumber} started for session ${session.id}`);
  }

  /**
   * Send finalization notifications
   */
  async sendFinalizationNotifications(session, outcome) {
    // TODO: Implement finalization notification emails
    console.log(`Negotiation finalized with outcome: ${outcome} for session ${session.id}`);
  }

  /**
   * Start cleanup timer for expired sessions
   */
  startCleanupTimer() {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 60000); // Run every minute
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const now = new Date().toISOString();
      
      const { data: expiredSessions, error } = await supabase
        .from('negotiation_sessions')
        .select('id')
        .eq('status', 'active')
        .lt('deadline', now);

      if (error) throw error;

      for (const session of expiredSessions) {
        await this.expireSession(session.id);
      }

    } catch (error) {
      console.error('Cleanup expired sessions error:', error);
    }
  }

  /**
   * Get service health
   */
  async getServiceHealth() {
    try {
      const { data: stats, error } = await supabase
        .rpc('get_negotiation_service_health');

      if (error) throw error;

      return {
        status: 'healthy',
        activeNegotiations: stats[0]?.active_count || 0,
        totalSessions: stats[0]?.total_count || 0,
        averageResponseTime: stats[0]?.avg_response_time || 0,
        systemLoad: this.sessionCache.size
      };

    } catch (error) {
      console.error('Get service health error:', error);
      return {
        status: 'degraded',
        activeNegotiations: 0,
        totalSessions: 0,
        averageResponseTime: 0,
        systemLoad: this.sessionCache.size
      };
    }
  }

  /**
   * Cleanup on service shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessionCache.clear();
  }
}

module.exports = new ActiveNegotiationService();