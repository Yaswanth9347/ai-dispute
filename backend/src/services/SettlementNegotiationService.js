// Settlement Negotiation Service - Handle multi-party settlement workflows
const SettlementProposal = require('../models/SettlementProposal');
const Case = require('../models/Case');
const CaseParty = require('../models/CaseParty');
const AIAnalysisService = require('./AIAnalysisService');
const RealTimeService = require('./RealTimeService');
const SignatureService = require('./SignatureService');
const { logger } = require('../lib/logger');
const { v4: uuidv4 } = require('uuid');

class SettlementNegotiationService {
  constructor() {
    this.activeNegotiations = new Map(); // Track active negotiation sessions
  }

  // Start settlement negotiation
  async startSettlementNegotiation(caseId, initiatorUserId, negotiationData) {
    try {
      const {
        negotiation_type = 'multi_party',
        initial_proposals,
        negotiation_deadline,
        negotiation_message
      } = negotiationData;

      // Verify case access
      if (!await Case.hasAccess(caseId, initiatorUserId)) {
        throw new Error('Access denied to case');
      }

      // Get case parties
      const caseParties = await CaseParty.findAll({ case_id: caseId });
      if (caseParties.length < 2) {
        throw new Error('At least 2 parties required for settlement negotiation');
      }

      // Create negotiation session
      const negotiationSession = {
        id: uuidv4(),
        case_id: caseId,
        initiator_user_id: initiatorUserId,
        negotiation_type,
        status: 'active',
        total_parties: caseParties.length,
        responded_parties: 0,
        deadline: negotiation_deadline ? new Date(negotiation_deadline).toISOString() : 
                  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
        created_at: new Date().toISOString(),
        negotiation_message
      };

      // Save negotiation session
      await this.createNegotiationSession(negotiationSession);

      // Create initial proposals if provided
      let createdProposals = [];
      if (initial_proposals && initial_proposals.length > 0) {
        for (const proposal of initial_proposals) {
          const proposalResult = await this.createSettlementProposal(
            caseId,
            initiatorUserId,
            {
              ...proposal,
              negotiation_session_id: negotiationSession.id,
              proposal_type: 'negotiation_initial'
            }
          );
          
          if (proposalResult.success) {
            createdProposals.push(proposalResult.proposal);
          }
        }
      }

      // Track active negotiation
      this.activeNegotiations.set(negotiationSession.id, {
        ...negotiationSession,
        parties: caseParties,
        proposals: createdProposals,
        responses: new Map()
      });

      // Notify all parties
      await this.notifyNegotiationStart(negotiationSession, caseParties);

      // Broadcast to case room
      if (RealTimeService.io) {
        RealTimeService.broadcastSystemMessage(
          caseId,
          `Settlement negotiation started. All parties are invited to participate.`,
          'negotiation_started'
        );
      }

      logger.info(`Settlement negotiation started`, { 
        negotiationId: negotiationSession.id,
        caseId,
        partiesCount: caseParties.length 
      });

      return {
        success: true,
        negotiation_session: negotiationSession,
        initial_proposals: createdProposals,
        parties: caseParties
      };

    } catch (error) {
      logger.error('Failed to start settlement negotiation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Submit settlement proposal during negotiation
  async submitNegotiationProposal(negotiationId, proposingUserId, proposalData) {
    try {
      const negotiation = this.activeNegotiations.get(negotiationId);
      if (!negotiation) {
        throw new Error('Negotiation session not found or inactive');
      }

      if (negotiation.status !== 'active') {
        throw new Error(`Negotiation is ${negotiation.status}`);
      }

      if (new Date() > new Date(negotiation.deadline)) {
        throw new Error('Negotiation deadline has passed');
      }

      // Verify user is a party to the case
      const userParty = negotiation.parties.find(p => p.user_id === proposingUserId);
      if (!userParty) {
        throw new Error('Access denied - not a party to this negotiation');
      }

      // Create settlement proposal
      const proposalResult = await this.createSettlementProposal(
        negotiation.case_id,
        proposingUserId,
        {
          ...proposalData,
          negotiation_session_id: negotiationId,
          proposal_type: 'negotiation_counter',
          proposed_by_party: userParty.role
        }
      );

      if (!proposalResult.success) {
        throw new Error(proposalResult.error);
      }

      // Update negotiation tracking
      negotiation.proposals.push(proposalResult.proposal);
      negotiation.responses.set(userParty.role, {
        user_id: proposingUserId,
        proposal_id: proposalResult.proposal.id,
        responded_at: new Date().toISOString()
      });

      // Check if all parties have responded
      if (negotiation.responses.size >= negotiation.total_parties) {
        await this.processNegotiationRound(negotiationId);
      }

      // Broadcast new proposal
      if (RealTimeService.io) {
        const roomName = `case-${negotiation.case_id}`;
        RealTimeService.io.to(roomName).emit('negotiation-proposal', {
          negotiation_id: negotiationId,
          proposal_id: proposalResult.proposal.id,
          proposed_by: userParty.role,
          proposal: proposalResult.proposal,
          timestamp: new Date().toISOString()
        });
      }

      logger.info(`Negotiation proposal submitted`, { 
        negotiationId,
        proposalId: proposalResult.proposal.id,
        proposingUserId 
      });

      return {
        success: true,
        proposal: proposalResult.proposal,
        negotiation_status: negotiation.status,
        responses_received: negotiation.responses.size,
        total_parties: negotiation.total_parties
      };

    } catch (error) {
      logger.error('Failed to submit negotiation proposal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Accept a settlement proposal
  async acceptSettlementProposal(proposalId, acceptingUserId) {
    try {
      const proposal = await SettlementProposal.findById(proposalId);
      if (!proposal) {
        throw new Error('Settlement proposal not found');
      }

      // Verify access
      if (!await Case.hasAccess(proposal.case_id, acceptingUserId)) {
        throw new Error('Access denied to settlement proposal');
      }

      if (proposal.status !== 'pending') {
        throw new Error(`Proposal is already ${proposal.status}`);
      }

      // Update proposal status
      await SettlementProposal.update(proposalId, {
        status: 'accepted',
        accepted_by: acceptingUserId,
        accepted_at: new Date().toISOString()
      });

      // If this is part of a negotiation, update negotiation status
      if (proposal.negotiation_session_id) {
        await this.processProposalAcceptance(proposal.negotiation_session_id, proposalId);
      }

      // Start signature process for accepted settlement
      await this.initiateSettlementSigning(proposal);

      // Broadcast acceptance
      if (RealTimeService.io) {
        RealTimeService.broadcastSystemMessage(
          proposal.case_id,
          `Settlement proposal has been accepted. Proceeding to signature collection.`,
          'settlement_accepted'
        );
      }

      logger.info(`Settlement proposal accepted`, { proposalId, acceptingUserId });

      return {
        success: true,
        proposal: { ...proposal, status: 'accepted' },
        message: 'Settlement proposal accepted. Signature process initiated.'
      };

    } catch (error) {
      logger.error('Failed to accept settlement proposal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create settlement proposal
  async createSettlementProposal(caseId, creatorUserId, proposalData) {
    try {
      const proposal = await SettlementProposal.create({
        ...proposalData,
        case_id: caseId,
        created_by: creatorUserId,
        status: 'pending'
      });

      return {
        success: true,
        proposal
      };

    } catch (error) {
      logger.error('Failed to create settlement proposal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process negotiation round (when all parties respond)
  async processNegotiationRound(negotiationId) {
    try {
      const negotiation = this.activeNegotiations.get(negotiationId);
      if (!negotiation) return;

      // Get all proposals from this round
      const roundProposals = negotiation.proposals.filter(p => 
        p.negotiation_session_id === negotiationId
      );

      // Use AI to analyze proposals and suggest compromises
      const aiAnalysis = await AIAnalysisService.generateSettlementProposals(
        negotiation.case_id,
        negotiation.initiator_user_id,
        {
          negotiation_context: {
            session_id: negotiationId,
            round_proposals: roundProposals,
            parties: negotiation.parties
          }
        }
      );

      // Check for potential agreement
      const agreementCheck = await this.checkForAgreement(roundProposals);
      
      if (agreementCheck.hasAgreement) {
        await this.finalizeNegotiation(negotiationId, agreementCheck.agreedProposal);
      } else {
        // Start new round with AI suggestions
        await this.startNewNegotiationRound(negotiationId, aiAnalysis);
      }

    } catch (error) {
      logger.error('Failed to process negotiation round:', error);
    }
  }

  // Check if parties have reached agreement
  async checkForAgreement(proposals) {
    // Simple agreement detection - in reality this would be more sophisticated
    const amounts = proposals.map(p => p.settlement_amount).filter(Boolean);
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
    
    // If variance is low, might indicate convergence
    const agreementThreshold = avgAmount * 0.1; // 10% variance threshold
    
    if (variance <= agreementThreshold && amounts.length > 1) {
      return {
        hasAgreement: true,
        agreedProposal: {
          settlement_amount: Math.round(avgAmount),
          currency: proposals[0].currency,
          agreement_type: 'compromise'
        }
      };
    }

    return { hasAgreement: false };
  }

  // Finalize negotiation with agreement
  async finalizeNegotiation(negotiationId, agreedProposal) {
    try {
      const negotiation = this.activeNegotiations.get(negotiationId);
      if (!negotiation) return;

      // Create final settlement proposal
      const finalProposal = await this.createSettlementProposal(
        negotiation.case_id,
        negotiation.initiator_user_id,
        {
          ...agreedProposal,
          negotiation_session_id: negotiationId,
          proposal_type: 'negotiation_final',
          status: 'accepted'
        }
      );

      // Update negotiation status
      await this.updateNegotiationStatus(negotiationId, 'completed');

      // Start signature process
      if (finalProposal.success) {
        await this.initiateSettlementSigning(finalProposal.proposal);
      }

      // Remove from active negotiations
      this.activeNegotiations.delete(negotiationId);

      logger.info(`Negotiation finalized with agreement`, { negotiationId });

    } catch (error) {
      logger.error('Failed to finalize negotiation:', error);
    }
  }

  // Initiate settlement signing process
  async initiateSettlementSigning(settlementProposal) {
    try {
      // Get all case parties
      const caseParties = await CaseParty.findAll({ 
        case_id: settlementProposal.case_id 
      });

      // Create signature request
      const signatureResult = await SignatureService.createSignatureRequest({
        case_id: settlementProposal.case_id,
        document_type: 'settlement_agreement',
        signers: caseParties.map(party => ({
          user_id: party.user_id,
          email: party.contact_email,
          name: party.contact_name
        })),
        signing_order: 'parallel',
        expiry_hours: 72,
        message: `Please sign the settlement agreement for case ${settlementProposal.case_id}`
      }, settlementProposal.created_by);

      if (signatureResult.success) {
        // Link signature request to settlement proposal
        await SettlementProposal.update(settlementProposal.id, {
          signature_request_id: signatureResult.signature_request.id,
          status: 'awaiting_signatures'
        });

        logger.info(`Settlement signing initiated`, { 
          proposalId: settlementProposal.id,
          signatureRequestId: signatureResult.signature_request.id 
        });
      }

    } catch (error) {
      logger.error('Failed to initiate settlement signing:', error);
    }
  }

  // Get negotiation status
  async getNegotiationStatus(negotiationId, userId) {
    try {
      const negotiation = this.activeNegotiations.get(negotiationId);
      if (!negotiation) {
        throw new Error('Negotiation session not found');
      }

      // Verify access
      if (!await Case.hasAccess(negotiation.case_id, userId)) {
        throw new Error('Access denied to negotiation');
      }

      return {
        success: true,
        negotiation: {
          id: negotiation.id,
          case_id: negotiation.case_id,
          status: negotiation.status,
          total_parties: negotiation.total_parties,
          responded_parties: negotiation.responses.size,
          deadline: negotiation.deadline,
          proposals: negotiation.proposals,
          responses: Array.from(negotiation.responses.entries())
        }
      };

    } catch (error) {
      logger.error('Failed to get negotiation status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create negotiation session (database operation)
  async createNegotiationSession(sessionData) {
    // Implementation would save to database
    logger.info(`Creating negotiation session: ${sessionData.id}`);
    return sessionData;
  }

  // Update negotiation status
  async updateNegotiationStatus(negotiationId, status) {
    // Implementation would update database
    logger.info(`Updating negotiation ${negotiationId} status to ${status}`);
    
    const negotiation = this.activeNegotiations.get(negotiationId);
    if (negotiation) {
      negotiation.status = status;
    }
  }

  // Notify parties about negotiation start
  async notifyNegotiationStart(negotiation, parties) {
    try {
      for (const party of parties) {
        if (RealTimeService.io && party.user_id) {
          await RealTimeService.sendUserNotification(party.user_id, {
            type: 'negotiation_started',
            title: 'Settlement Negotiation Started',
            message: 'You are invited to participate in settlement negotiations',
            action_url: `${process.env.FRONTEND_URL}/cases/${negotiation.case_id}/negotiation/${negotiation.id}`,
            negotiation_id: negotiation.id
          });
        }
      }
    } catch (error) {
      logger.error('Failed to notify negotiation start:', error);
    }
  }

  // Start new negotiation round
  async startNewNegotiationRound(negotiationId, aiSuggestions) {
    const negotiation = this.activeNegotiations.get(negotiationId);
    if (!negotiation) return;

    // Clear previous round responses
    negotiation.responses.clear();

    // Broadcast AI suggestions for new round
    if (RealTimeService.io) {
      const roomName = `case-${negotiation.case_id}`;
      RealTimeService.io.to(roomName).emit('negotiation-new-round', {
        negotiation_id: negotiationId,
        ai_suggestions: aiSuggestions,
        round_number: Math.floor(negotiation.proposals.length / negotiation.total_parties) + 1,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`New negotiation round started`, { negotiationId });
  }

  // Process proposal acceptance in negotiation context
  async processProposalAcceptance(negotiationId, proposalId) {
    try {
      // End negotiation if proposal is accepted
      await this.updateNegotiationStatus(negotiationId, 'completed');
      this.activeNegotiations.delete(negotiationId);

      logger.info(`Negotiation completed with accepted proposal`, { 
        negotiationId, 
        proposalId 
      });

    } catch (error) {
      logger.error('Failed to process proposal acceptance:', error);
    }
  }

  // Get active negotiations for a case
  async getCaseNegotiations(caseId, userId) {
    try {
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied to case');
      }

      const activeNegotiations = Array.from(this.activeNegotiations.values())
        .filter(n => n.case_id === caseId);

      return {
        success: true,
        negotiations: activeNegotiations
      };

    } catch (error) {
      logger.error('Failed to get case negotiations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SettlementNegotiationService();