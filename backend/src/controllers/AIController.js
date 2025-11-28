// AI Controller - Handle AI-powered dispute resolution with workflow integration
const AIService = require('../services/AIService');
const AIWorkflowIntegrationService = require('../services/AIWorkflowIntegrationService');
const { validationResult } = require('express-validator');

class AIController {
  // Analyze a case for dispute resolution (workflow-integrated)
  async analyzeCase(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { caseId } = req.params;
      const userId = req.user.id;

      // Use workflow integration service to trigger AI analysis
      const result = await AIWorkflowIntegrationService.triggerAIAnalysis(caseId, userId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Failed to analyze case'
        });
      }

      res.json({
        success: true,
        message: 'Case analysis completed and workflow updated',
        data: {
          analysis: result.analysis,
          analysisId: result.analysisId,
          processingTime: result.processingTime,
          workflowUpdated: true
        }
      });

    } catch (error) {
      console.error('Error in AI case analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze case',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Generate settlement options (workflow-integrated)
  async generateSettlementOptions(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      // Use workflow integration service to generate settlement options
      const result = await AIWorkflowIntegrationService.generateSettlementOptions(caseId, userId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Failed to generate settlement options'
        });
      }

      res.json({
        success: true,
        message: 'Settlement options generated and workflow updated',
        data: {
          options: result.options,
          optionsId: result.optionsId,
          activeOptionsId: result.activeOptionsId,
          processingTime: result.processingTime,
          workflowUpdated: true
        }
      });

    } catch (error) {
      console.error('Error generating settlement options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate settlement options',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Record a party's option selection (workflow-integrated)
  async selectOption(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { caseId, optionId } = req.params;
      const { reasoning } = req.body;
      const userId = req.user.id;

      // Verify case access and get party type
      const Case = require('../models/Case');
      const caseData = await Case.getById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
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
          message: 'Access denied'
        });
      }

      // Use workflow integration service to handle option selection
      const result = await AIWorkflowIntegrationService.handleOptionSelection(
        caseId, 
        userId, 
        optionId, 
        reasoning, 
        partyType
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Failed to record option selection'
        });
      }

      res.json({
        success: true,
        message: 'Option selection recorded and workflow updated',
        data: {
          selection: result.selection,
          bothSelected: result.bothSelected,
          sameOption: result.sameOption,
          workflowUpdated: true
        }
      });

    } catch (error) {
      console.error('Error selecting option:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record option selection',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get AI workflow status for a case
  async getCaseAIStatus(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      // Verify case access
      const Case = require('../models/Case');
      const caseData = await Case.getById(caseId);
      if (!caseData || (caseData.filed_by !== userId && caseData.defender_id !== userId)) {
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied'
        });
      }

      // Get AI workflow status
      const result = await AIWorkflowIntegrationService.getAIWorkflowStatus(caseId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || 'Failed to get AI workflow status'
        });
      }

      res.json({
        success: true,
        message: 'AI workflow status retrieved',
        data: result.status
      });

    } catch (error) {
      console.error('Error getting AI workflow status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI workflow status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Accept the AI-generated combined solution
  async acceptCombinedSolution(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { caseId } = req.params;
      const userId = req.user.id;

      const result = await AIWorkflowIntegrationService.finalizeConsensus(caseId, userId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Combined solution accepted successfully',
          workflow_state: result.workflow_state,
          final_solution: result.final_solution
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to accept combined solution'
        });
      }
    } catch (error) {
      console.error('Error accepting combined solution:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to accept combined solution',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Stub methods for routes compatibility
  async analyzeEvidence(req, res) {
    res.status(501).json({ success: false, message: 'Evidence analysis not implemented yet' });
  }

  async conductLegalResearch(req, res) {
    res.status(501).json({ success: false, message: 'Legal research not implemented yet' });
  }

  async assessRisks(req, res) {
    res.status(501).json({ success: false, message: 'Risk assessment not implemented yet' });
  }

  async getCaseAnalyses(req, res) {
    res.status(501).json({ success: false, message: 'Case analyses retrieval not implemented yet' });
  }

  async getAnalysisById(req, res) {
    res.status(501).json({ success: false, message: 'Analysis by ID not implemented yet' });
  }

  async bulkAnalyze(req, res) {
    res.status(501).json({ success: false, message: 'Bulk analysis not implemented yet' });
  }

  async reAnalyze(req, res) {
    res.status(501).json({ success: false, message: 'Re-analysis not implemented yet' });
  }

  async healthCheck(req, res) {
    res.json({ 
      success: true, 
      message: 'AI Controller is running',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new AIController();