// Dispute Controller - Handle dispute workflow and lifecycle
const DisputeWorkflowService = require('../services/DisputeWorkflowService');
const StatementService = require('../services/StatementService');
const SettlementOptionService = require('../services/SettlementOptionService');
const SettlementAIService = require('../services/SettlementAIService');
const ConsensusService = require('../services/ConsensusService');
const SignatureService = require('../services/SignatureService');
const CourtForwardingService = require('../services/CourtForwardingService');
const InvitationService = require('../services/InvitationService');
const EvidenceAnalysisService = require('../services/EvidenceAnalysisService');
const Case = require('../models/Case');
const { logger } = require('../lib/logger');

class DisputeController {
  // Initialize a new dispute workflow
  async initializeWorkflow(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      const result = await DisputeWorkflowService.initializeWorkflow(caseId, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.workflow
      });

    } catch (error) {
      logger.error('Error in initializeWorkflow:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get workflow status
  async getWorkflow(req, res) {
    try {
      const { caseId } = req.params;

      const result = await DisputeWorkflowService.getWorkflow(caseId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.workflow
      });

    } catch (error) {
      logger.error('Error in getWorkflow:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Invite respondent to join case
  async inviteRespondent(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;
      const { email, name, message } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          success: false,
          error: 'Email and name are required'
        });
      }

      // Invite party
      const inviteResult = await InvitationService.inviteParty(caseId, userId, {
        email,
        name,
        role: 'respondent',
        message
      });

      if (!inviteResult.success) {
        return res.status(400).json({
          success: false,
          error: inviteResult.error
        });
      }

      // Transition workflow
      await DisputeWorkflowService.transitionStage(
        caseId,
        DisputeWorkflowService.DisputeStage.AWAITING_RESPONDENT,
        userId,
        `Invited ${email} as respondent`
      );

      res.json({
        success: true,
        data: {
          invitation: inviteResult.invitation,
          invitationToken: inviteResult.invitation_token
        }
      });

    } catch (error) {
      logger.error('Error in inviteRespondent:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Submit statement
  async submitStatement(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;
      const { content, attachments = [] } = req.body;

      if (!content || content.trim().length < 50) {
        return res.status(400).json({
          success: false,
          error: 'Statement must be at least 50 characters long'
        });
      }

      const result = await StatementService.submitStatement(caseId, userId, content, attachments);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.statement
      });

    } catch (error) {
      logger.error('Error in submitStatement:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Finalize statement
  async finalizeStatement(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      const result = await StatementService.finalizeStatement(caseId, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.statement,
        message: 'Statement finalized successfully'
      });

    } catch (error) {
      logger.error('Error in finalizeStatement:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all statements for a case
  async getStatements(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      const result = await StatementService.getCaseStatements(caseId, userId);

      if (!result.success) {
        return res.status(403).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          statements: result.statements
        }
      });

    } catch (error) {
      logger.error('Error in getStatements:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get statement status
  async getStatementStatus(req, res) {
    try {
      const { caseId } = req.params;

      const result = await StatementService.getStatementStatus(caseId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.status
      });

    } catch (error) {
      logger.error('Error in getStatementStatus:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Trigger AI analysis and generate settlement options (Enhanced with workflow integration)
  async generateSettlementOptions(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      // Check if statements are finalized
      const statusResult = await StatementService.getStatementStatus(caseId);
      if (!statusResult.success || !statusResult.status.readyForAnalysis) {
        return res.status(400).json({
          success: false,
          error: 'Both parties must finalize statements before AI analysis'
        });
      }

      // Transition to AI analysis stage
      await DisputeWorkflowService.transitionStage(
        caseId,
        DisputeWorkflowService.DisputeStage.AI_ANALYSIS,
        userId,
        'Starting AI analysis'
      );

      // Use the enhanced AI workflow integration service
      const AIWorkflowIntegrationService = require('../services/AIWorkflowIntegrationService');
      
      // Trigger AI analysis which will automatically transition to OPTIONS_PRESENTED
      const analysisResult = await AIWorkflowIntegrationService.triggerAIAnalysis(caseId, userId);
      
      if (!analysisResult.success) {
        return res.status(500).json({
          success: false,
          error: analysisResult.error || 'Failed to perform AI analysis'
        });
      }

      // Generate settlement options which will transition to AWAITING_SELECTION
      const optionsResult = await AIWorkflowIntegrationService.generateSettlementOptions(caseId, userId);

      if (!optionsResult.success) {
        return res.status(500).json({
          success: false,
          error: optionsResult.error || 'Failed to generate settlement options'
        });
      }

      res.json({
        success: true,
        data: {
          analysis: analysisResult.analysis,
          analysisId: analysisResult.analysisId,
          options: optionsResult.options,
          optionsId: optionsResult.optionsId,
          activeOptionsId: optionsResult.activeOptionsId,
          workflowIntegrated: true
        },
        message: 'AI analysis and settlement options generated successfully with workflow integration'
      });

    } catch (error) {
      logger.error('Error in generateSettlementOptions (enhanced):', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get settlement options
  async getSettlementOptions(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      const result = await SettlementOptionService.getSettlementOptions(caseId, userId);

      if (!result.success) {
        return res.status(403).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          options: result.options
        }
      });

    } catch (error) {
      logger.error('Error in getSettlementOptions:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Select a settlement option (Enhanced with workflow integration)
  async selectOption(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;
      const { optionId, comments } = req.body;

      if (!optionId) {
        return res.status(400).json({
          success: false,
          error: 'Option ID is required'
        });
      }

      // Get case data to determine party type
      const caseData = await Case.getById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          error: 'Case not found'
        });
      }

      let partyType;
      if (caseData.filed_by === userId) {
        partyType = 'complainer';
      } else if (caseData.defender_id === userId) {
        partyType = 'defender';
      } else {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Use the enhanced AI workflow integration service
      const AIWorkflowIntegrationService = require('../services/AIWorkflowIntegrationService');
      
      const result = await AIWorkflowIntegrationService.handleOptionSelection(
        caseId,
        userId,
        optionId,
        comments,
        partyType
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          selection: result.selection,
          bothSelected: result.bothSelected,
          sameOption: result.sameOption,
          workflowIntegrated: true
        },
        message: result.bothSelected 
          ? (result.sameOption ? 'Both parties selected same option - proceeding to settlement' : 'Different options selected - generating combined solution')
          : 'Option selected successfully - waiting for other party'
      });

    } catch (error) {
      logger.error('Error in selectOption (enhanced):', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Forward case to court
  async forwardToCourt(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      // Transition workflow
      await DisputeWorkflowService.transitionStage(
        caseId,
        DisputeWorkflowService.DisputeStage.FORWARDED_TO_COURT,
        userId,
        reason || 'Case forwarded to court for resolution'
      );

      // Update case status
      await Case.updateStatus(caseId, 'escalated');

      res.json({
        success: true,
        message: 'Case forwarded to court successfully'
      });

    } catch (error) {
      logger.error('Error in forwardToCourt:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get workflow statistics
  async getWorkflowStatistics(req, res) {
    try {
      const { caseId } = req.params;

      const result = await DisputeWorkflowService.getStatistics(caseId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.statistics
      });

    } catch (error) {
      logger.error('Error in getWorkflowStatistics:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ============================================================================
  // NEW AI & CONSENSUS ENDPOINTS
  // ============================================================================

  // Generate AI settlement options
  async generateAIOptions(req, res) {
    try {
      const { caseId } = req.params;

      const result = await SettlementAIService.generateSettlementOptions(caseId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in generateAIOptions:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Select settlement option
  async selectOption(req, res) {
    try {
      const { caseId } = req.params;
      const { optionId, comments } = req.body;
      const userId = req.user.id;

      const selection = await ConsensusService.selectOption(
        caseId,
        userId,
        optionId,
        comments
      );

      res.json({
        success: true,
        data: selection
      });

    } catch (error) {
      logger.error('Error in selectOption:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get consensus status
  async getConsensusStatus(req, res) {
    try {
      const { caseId } = req.params;

      const status = await ConsensusService.getConsensusStatus(caseId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Error in getConsensusStatus:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Request signature
  async requestSignature(req, res) {
    try {
      const { caseId } = req.params;
      const { documentId, signatureType } = req.body;
      const userId = req.user.id;

      const signatureRequest = await SignatureService.requestSignature(
        caseId,
        userId,
        documentId,
        signatureType || 'otp'
      );

      res.json({
        success: true,
        data: signatureRequest
      });

    } catch (error) {
      logger.error('Error in requestSignature:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Verify signature with OTP
  async verifySignature(req, res) {
    try {
      const { signatureId } = req.params;
      const { otp, metadata } = req.body;

      const signature = await SignatureService.verifyAndSign(
        signatureId,
        otp,
        metadata || {}
      );

      res.json({
        success: true,
        data: signature
      });

    } catch (error) {
      logger.error('Error in verifySignature:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Resend OTP
  async resendOTP(req, res) {
    try {
      const { signatureId } = req.params;

      const result = await SignatureService.resendOTP(signatureId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in resendOTP:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get signature status
  async getSignatureStatus(req, res) {
    try {
      const { caseId } = req.params;

      const status = await SignatureService.getSignatureStatus(caseId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Error in getSignatureStatus:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Auto-forward to court
  async autoForwardToCourt(req, res) {
    try {
      const { caseId } = req.params;
      const { reason } = req.body;

      const result = await CourtForwardingService.autoForwardCase(
        caseId,
        reason || 'settlement_failed'
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in autoForwardToCourt:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Analyze evidence document with AI
  async analyzeEvidence(req, res) {
    try {
      const { caseId, documentId } = req.params;
      const userId = req.user.id;

      const analysis = await EvidenceAnalysisService.analyzeEvidence(
        documentId,
        userId,
        caseId
      );

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      logger.error('Error in analyzeEvidence:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all evidence analysis for a case
  async getCaseEvidenceAnalysis(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      const analysis = await EvidenceAnalysisService.getCaseEvidenceAnalysis(
        caseId,
        userId
      );

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      logger.error('Error in getCaseEvidenceAnalysis:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Bulk analyze all evidence for a case
  async analyzeAllEvidence(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      const results = await EvidenceAnalysisService.analyzeAllCaseEvidence(
        caseId,
        userId
      );

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      logger.error('Error in analyzeAllEvidence:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new DisputeController();
