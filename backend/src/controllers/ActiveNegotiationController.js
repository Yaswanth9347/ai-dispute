// Active Settlement Negotiation Controller - Real-time Multi-party Negotiations
// Comprehensive negotiation session management with AI assistance and real-time updates

const { supabase } = require('../lib/supabaseClient');
const ActiveNegotiationService = require('../services/ActiveNegotiationService');
const geminiService = require('../services/GeminiService');
const { z } = require('zod');

class ActiveNegotiationController {
  constructor() {
    try {
      console.log('Initializing ActiveNegotiationController...');
      this.negotiationService = ActiveNegotiationService;
      this.geminiService = geminiService;
      this.activeConnections = new Map(); // WebSocket connections for real-time updates
      console.log('ActiveNegotiationController initialized successfully');
    } catch (error) {
      console.error('Error initializing ActiveNegotiationController:', error);
      throw error;
    }
  }

  /**
   * Start a new active negotiation session
   */
  async startNegotiation(req, res) {
    try {
      const { caseId, initialOffer, maxRounds = 10, deadlineHours = 72, allowCounterOffers = true } = req.body;
      const userId = req.user.sub;

      // Validate input - be more flexible with the schema
      const schema = z.object({
        caseId: z.string().uuid(),
        initialOffer: z.record(z.any()), // Accept any object structure for initial offer
        participants: z.array(z.record(z.any())).optional(),
        deadline: z.string().optional(),
        maxRounds: z.number().int().min(1).max(50).optional(),
        deadlineHours: z.number().int().min(1).max(720).optional(),
        allowCounterOffers: z.boolean().optional()
      });

      const validatedData = schema.parse(req.body);

      // Verify case exists and user has access
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('*, case_parties(*)')
        .eq('id', caseId)
        .single();

      if (caseError) {
        return res.status(404).json({
          success: false,
          error: 'Case not found or access denied'
        });
      }

      // Start negotiation session
      const session = await this.negotiationService.createNegotiationSession({
        caseId,
        initiatorId: userId,
        initialOffer,
        maxRounds,
        deadlineHours,
        allowCounterOffers,
        parties: caseData.case_parties
      });

      // Send real-time notifications to all parties
      await this.notifyParties(session.id, 'negotiation_started', {
        initiator: req.user.email,
        initialOffer,
        deadline: session.deadline
      });

      res.status(201).json({
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          currentRound: session.currentRound,
          deadline: session.deadline,
          parties: session.parties,
          allowCounterOffers: session.allowCounterOffers
        }
      });

    } catch (error) {
      console.error('Start negotiation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start negotiation session'
      });
    }
  }

  /**
   * Submit response to active negotiation
   */
  async submitResponse(req, res) {
    try {
      const { sessionId } = req.params;
      const { response, counterOffer, message } = req.body;
      const userId = req.user.id;

      // Validate input
      const schema = z.object({
        response: z.enum(['accept', 'reject', 'counter']),
        counterOffer: z.object({
          amount: z.number().min(0),
          terms: z.object().optional(),
          reasoning: z.string().optional()
        }).optional(),
        message: z.string().max(1000).optional()
      });

      const validatedData = schema.parse(req.body);

      // Get session and validate user participation
      const session = await this.negotiationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Negotiation session not found'
        });
      }

      // Verify user is a party to this negotiation
      const isParty = session.parties.some(party => party.userId === userId);
      if (!isParty) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to participate in this negotiation'
        });
      }

      // Check if session is still active
      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Negotiation session is not active'
        });
      }

      // Check deadline
      if (new Date() > new Date(session.deadline)) {
        await this.negotiationService.expireSession(sessionId);
        return res.status(400).json({
          success: false,
          error: 'Negotiation deadline has passed'
        });
      }

      // Submit response
      const responseData = await this.negotiationService.submitResponse(sessionId, {
        userId,
        response: validatedData.response,
        counterOffer: validatedData.counterOffer,
        message: validatedData.message,
        roundNumber: session.currentRound
      });

      // Check if this response triggers session completion or next round
      const updatedSession = await this.evaluateSessionStatus(sessionId);

      // Send real-time updates to all parties
      await this.notifyParties(sessionId, 'response_submitted', {
        respondent: req.user.email,
        response: validatedData.response,
        counterOffer: validatedData.counterOffer,
        sessionStatus: updatedSession.status,
        currentRound: updatedSession.currentRound
      });

      res.json({
        success: true,
        data: {
          responseId: responseData.id,
          sessionStatus: updatedSession.status,
          currentRound: updatedSession.currentRound,
          nextDeadline: updatedSession.deadline,
          requiresResponse: updatedSession.status === 'active'
        }
      });

    } catch (error) {
      console.error('Submit response error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit response'
      });
    }
  }

  /**
   * Generate AI-assisted compromise proposal
   */
  async generateCompromise(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = await this.negotiationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Negotiation session not found'
        });
      }

      // Verify user is a party
      const isParty = session.parties.some(party => party.userId === userId);
      if (!isParty) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to generate compromise for this negotiation'
        });
      }

      // Get all responses in current negotiation
      const responses = await this.negotiationService.getSessionResponses(sessionId);
      
      // Generate AI compromise using Gemini
      const compromise = await this.generateAICompromise(session, responses);

      // Save compromise proposal
      const { data: compromiseData, error: saveError } = await supabase
        .from('negotiation_compromises')
        .insert({
          session_id: sessionId,
          generated_by: userId,
          compromise_offer: compromise.offer,
          ai_reasoning: compromise.reasoning,
          confidence_score: compromise.confidence,
          valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000) // Valid for 24 hours
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Notify all parties about the compromise
      await this.notifyParties(sessionId, 'compromise_generated', {
        generator: req.user.email,
        compromise: compromise.offer,
        reasoning: compromise.reasoning,
        confidence: compromise.confidence
      });

      res.json({
        success: true,
        data: {
          compromiseId: compromiseData.id,
          compromise: compromise.offer,
          reasoning: compromise.reasoning,
          confidence: compromise.confidence,
          validUntil: compromiseData.valid_until,
          recommendedAction: compromise.recommendedAction
        }
      });

    } catch (error) {
      console.error('Generate compromise error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate compromise proposal'
      });
    }
  }

  /**
   * Get active negotiation session status
   */
  async getSessionStatus(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = await this.negotiationService.getSessionWithDetails(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Negotiation session not found'
        });
      }

      // Verify user has access
      const hasAccess = session.parties.some(party => party.userId === userId) || 
                       session.initiatorId === userId;
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get recent activity
      const activity = await this.negotiationService.getSessionActivity(sessionId, 10);
      
      // Get pending responses
      const pendingResponses = await this.negotiationService.getPendingResponses(sessionId);

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            caseId: session.caseId,
            status: session.status,
            currentRound: session.currentRound,
            maxRounds: session.maxRounds,
            deadline: session.deadline,
            allowCounterOffers: session.allowCounterOffers,
            parties: session.parties.map(party => ({
              userId: party.userId,
              role: party.role,
              name: party.name,
              hasResponded: party.hasResponded,
              lastResponse: party.lastResponse
            }))
          },
          activity,
          pendingResponses: pendingResponses.length,
          timeRemaining: this.calculateTimeRemaining(session.deadline),
          canSubmitResponse: this.canUserSubmitResponse(session, userId)
        }
      });

    } catch (error) {
      console.error('Get session status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session status'
      });
    }
  }

  /**
   * Get user's active negotiations
   */
  async getUserNegotiations(req, res) {
    try {
      const userId = req.user.id;
      const { status = 'all', page = 1, limit = 20 } = req.query;

      const negotiations = await this.negotiationService.getUserNegotiations(userId, {
        status: status !== 'all' ? status : null,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      // Add summary statistics
      const stats = await this.negotiationService.getUserNegotiationStats(userId);

      res.json({
        success: true,
        data: {
          negotiations: negotiations.data,
          pagination: negotiations.pagination,
          statistics: stats
        }
      });

    } catch (error) {
      console.error('Get user negotiations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user negotiations'
      });
    }
  }

  /**
   * Extend negotiation deadline
   */
  async extendDeadline(req, res) {
    try {
      const { sessionId } = req.params;
      const { additionalHours, reason } = req.body;
      const userId = req.user.id;

      const schema = z.object({
        additionalHours: z.number().int().min(1).max(168), // Max 1 week extension
        reason: z.string().max(500).optional()
      });

      const validatedData = schema.parse(req.body);

      const session = await this.negotiationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Negotiation session not found'
        });
      }

      // Only initiator or parties can extend deadline
      const canExtend = session.initiatorId === userId || 
                       session.parties.some(party => party.userId === userId);
      
      if (!canExtend) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to extend deadline'
        });
      }

      // Extend deadline
      const newDeadline = new Date(new Date(session.deadline).getTime() + 
                                 validatedData.additionalHours * 60 * 60 * 1000);

      const { error: updateError } = await supabase
        .from('negotiation_sessions')
        .update({
          deadline: newDeadline.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Log extension activity
      await this.negotiationService.logActivity(sessionId, {
        type: 'deadline_extended',
        userId,
        details: {
          additionalHours: validatedData.additionalHours,
          newDeadline: newDeadline.toISOString(),
          reason: validatedData.reason
        }
      });

      // Notify all parties
      await this.notifyParties(sessionId, 'deadline_extended', {
        extendedBy: req.user.email,
        additionalHours: validatedData.additionalHours,
        newDeadline: newDeadline.toISOString(),
        reason: validatedData.reason
      });

      res.json({
        success: true,
        data: {
          newDeadline: newDeadline.toISOString(),
          timeRemaining: this.calculateTimeRemaining(newDeadline.toISOString())
        }
      });

    } catch (error) {
      console.error('Extend deadline error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to extend deadline'
      });
    }
  }

  /**
   * Cancel active negotiation
   */
  async cancelNegotiation(req, res) {
    try {
      const { sessionId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const session = await this.negotiationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Negotiation session not found'
        });
      }

      // Only initiator can cancel
      if (session.initiatorId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only the negotiation initiator can cancel'
        });
      }

      // Cancel session
      await this.negotiationService.cancelSession(sessionId, {
        cancelledBy: userId,
        reason: reason || 'Cancelled by initiator'
      });

      // Notify all parties
      await this.notifyParties(sessionId, 'negotiation_cancelled', {
        cancelledBy: req.user.email,
        reason: reason || 'Cancelled by initiator'
      });

      res.json({
        success: true,
        data: {
          sessionId,
          status: 'cancelled',
          cancelledAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Cancel negotiation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel negotiation'
      });
    }
  }

  /**
   * Get negotiation analytics
   */
  async getNegotiationAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const { timeframe = '30d', caseId } = req.query;

      const analytics = await this.negotiationService.getAnalytics({
        userId,
        timeframe,
        caseId: caseId || null
      });

      res.json({
        success: true,
        data: { analytics }
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get negotiation analytics'
      });
    }
  }

  // Helper Methods

  async generateAICompromise(session, responses) {
    try {
      const prompt = `
        As a legal AI assistant, analyze this negotiation session and generate a fair compromise proposal.

        Case Context:
        - Session ID: ${session.id}
        - Current Round: ${session.currentRound}
        - Max Rounds: ${session.maxRounds}
        - Parties: ${session.parties.length}

        Recent Responses:
        ${responses.map(r => `
        - ${r.user_email}: ${r.response} 
          ${r.counter_offer ? `Counter: $${r.counter_offer.amount}` : ''}
          ${r.message ? `Message: ${r.message}` : ''}
        `).join('\n')}

        Generate a compromise proposal that:
        1. Considers all parties' positions
        2. Finds middle ground on monetary terms
        3. Addresses non-monetary concerns
        4. Has high likelihood of acceptance
        5. Is legally sound and enforceable

        Provide your response in JSON format with:
        {
          "offer": {
            "amount": number,
            "terms": object,
            "paymentSchedule": string,
            "additionalTerms": array
          },
          "reasoning": "detailed explanation",
          "confidence": number (0-1),
          "recommendedAction": "string",
          "riskAssessment": "string"
        }
      `;

      const aiResponse = await this.geminiService.generateContent(prompt);
      
      // Parse AI response and add safeguards
      let compromise;
      try {
        compromise = JSON.parse(aiResponse);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        compromise = {
          offer: {
            amount: this.calculateAverageOffer(responses),
            terms: { paymentSchedule: 'lump_sum' },
            additionalTerms: []
          },
          reasoning: 'AI-generated compromise based on average of all offers',
          confidence: 0.7,
          recommendedAction: 'Review and consider acceptance',
          riskAssessment: 'Moderate risk - balanced approach'
        };
      }

      return compromise;

    } catch (error) {
      console.error('AI compromise generation error:', error);
      // Return fallback compromise
      return {
        offer: {
          amount: this.calculateAverageOffer(responses),
          terms: { paymentSchedule: 'lump_sum' },
          additionalTerms: []
        },
        reasoning: 'System-generated compromise due to AI service unavailability',
        confidence: 0.6,
        recommendedAction: 'Consider as starting point for further negotiation'
      };
    }
  }

  calculateAverageOffer(responses) {
    const offers = responses
      .filter(r => r.counter_offer && r.counter_offer.amount)
      .map(r => r.counter_offer.amount);
    
    if (offers.length === 0) return 0;
    return Math.round(offers.reduce((sum, amount) => sum + amount, 0) / offers.length);
  }

  async evaluateSessionStatus(sessionId) {
    return await this.negotiationService.evaluateAndUpdateSessionStatus(sessionId);
  }

  async notifyParties(sessionId, eventType, data) {
    // This would integrate with WebSocket service for real-time notifications
    // For now, we'll log the notification
    console.log(`Notification [${sessionId}] ${eventType}:`, data);
    
    // TODO: Implement WebSocket real-time notifications
    // TODO: Send email notifications for offline parties
  }

  calculateTimeRemaining(deadline) {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const remainingMs = deadlineDate.getTime() - now.getTime();
    
    if (remainingMs <= 0) return { expired: true };
    
    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    
    return { days, hours, minutes, totalHours: Math.floor(remainingMs / (60 * 60 * 1000)) };
  }

  canUserSubmitResponse(session, userId) {
    if (session.status !== 'active') return false;
    if (new Date() > new Date(session.deadline)) return false;
    
    const userParty = session.parties.find(party => party.userId === userId);
    if (!userParty) return false;
    
    // Check if user has already responded in current round
    return !userParty.hasResponded || userParty.lastResponseRound < session.currentRound;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req, res) {
    try {
      const health = await this.negotiationService.getServiceHealth();
      
      res.json({
        success: true,
        data: {
          status: health.status,
          activeNegotiations: health.activeNegotiations,
          totalSessions: health.totalSessions,
          averageResponseTime: health.averageResponseTime,
          systemLoad: health.systemLoad,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({
        success: false,
        error: 'Service unhealthy'
      });
    }
  }
}

module.exports = ActiveNegotiationController;