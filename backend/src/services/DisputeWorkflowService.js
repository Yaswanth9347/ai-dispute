// Dispute Workflow Service - Manages the complete dispute resolution lifecycle
const { supabase } = require('../lib/supabaseClient');
const { logger } = require('../lib/logger');
const { v4: uuidv4 } = require('uuid');
const Case = require('../models/Case');

// Dispute lifecycle stages
const DisputeStage = {
  DRAFT: 'draft',
  AWAITING_RESPONDENT: 'awaiting_respondent',
  STATEMENT_COLLECTION: 'statement_collection',
  STATEMENT_FINALIZED: 'statement_finalized',
  AI_ANALYSIS: 'ai_analysis',
  OPTIONS_PRESENTED: 'options_presented',
  AWAITING_SELECTION: 'awaiting_selection',
  CONSENSUS_REACHED: 'consensus_reached',
  REANALYSIS: 'reanalysis',
  SETTLEMENT_READY: 'settlement_ready',
  SIGNATURE_PENDING: 'signature_pending',
  CLOSED_SETTLED: 'closed_settled',
  FORWARDED_TO_COURT: 'forwarded_to_court',
  CLOSED_REJECTED: 'closed_rejected'
};

// Valid stage transitions
const STAGE_TRANSITIONS = {
  [DisputeStage.DRAFT]: [DisputeStage.AWAITING_RESPONDENT],
  [DisputeStage.AWAITING_RESPONDENT]: [DisputeStage.STATEMENT_COLLECTION],
  [DisputeStage.STATEMENT_COLLECTION]: [DisputeStage.STATEMENT_FINALIZED],
  [DisputeStage.STATEMENT_FINALIZED]: [DisputeStage.AI_ANALYSIS],
  [DisputeStage.AI_ANALYSIS]: [DisputeStage.OPTIONS_PRESENTED],
  [DisputeStage.OPTIONS_PRESENTED]: [DisputeStage.AWAITING_SELECTION],
  [DisputeStage.AWAITING_SELECTION]: [
    DisputeStage.CONSENSUS_REACHED, 
    DisputeStage.REANALYSIS, 
    DisputeStage.FORWARDED_TO_COURT
  ],
  [DisputeStage.REANALYSIS]: [DisputeStage.AWAITING_SELECTION],
  [DisputeStage.CONSENSUS_REACHED]: [DisputeStage.SETTLEMENT_READY],
  [DisputeStage.SETTLEMENT_READY]: [DisputeStage.SIGNATURE_PENDING],
  [DisputeStage.SIGNATURE_PENDING]: [DisputeStage.CLOSED_SETTLED],
  [DisputeStage.CLOSED_SETTLED]: [],
  [DisputeStage.FORWARDED_TO_COURT]: [],
  [DisputeStage.CLOSED_REJECTED]: []
};

class DisputeWorkflowService {
  constructor() {
    this.DisputeStage = DisputeStage;
  }

  // Initialize dispute workflow
  async initializeWorkflow(caseId, initiatorUserId) {
    try {
      logger.info(`Initializing workflow for case ${caseId}`);

      // Create workflow record
      const workflow = {
        id: uuidv4(),
        case_id: caseId,
        current_stage: DisputeStage.DRAFT,
        initiated_by: initiatorUserId,
        initiated_at: new Date().toISOString(),
        stage_history: JSON.stringify([{
          stage: DisputeStage.DRAFT,
          timestamp: new Date().toISOString(),
          actor: initiatorUserId,
          notes: 'Workflow initialized'
        }]),
        metadata: JSON.stringify({
          partyStatements: {},
          aiAnalysisCount: 0,
          reanalysisCount: 0
        })
      };

      const { data, error } = await supabase
        .from('dispute_workflows')
        .insert([workflow])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      // Update case status
      await Case.updateStatus(caseId, 'draft');

      return {
        success: true,
        workflow: data
      };

    } catch (error) {
      logger.error(`Failed to initialize workflow for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get workflow for a case
  async getWorkflow(caseId) {
    try {
      const { data, error } = await supabase
        .from('dispute_workflows')
        .select('*')
        .eq('case_id', caseId)
        .single();

      if (error) {
        throw new Error(`Failed to get workflow: ${error.message}`);
      }

      // Parse JSON fields
      if (data) {
        data.stage_history = JSON.parse(data.stage_history || '[]');
        data.metadata = JSON.parse(data.metadata || '{}');
      }

      return {
        success: true,
        workflow: data
      };

    } catch (error) {
      logger.error(`Failed to get workflow for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Transition to a new stage
  async transitionStage(caseId, newStage, actorUserId, notes = '') {
    try {
      logger.info(`Transitioning case ${caseId} to stage ${newStage}`);

      // Get current workflow
      const workflowResult = await this.getWorkflow(caseId);
      if (!workflowResult.success) {
        throw new Error('Workflow not found');
      }

      const workflow = workflowResult.workflow;
      const currentStage = workflow.current_stage;

      // Validate transition
      if (!this.isValidTransition(currentStage, newStage)) {
        throw new Error(`Invalid transition from ${currentStage} to ${newStage}`);
      }

      // Add to stage history
      const stageHistory = workflow.stage_history || [];
      stageHistory.push({
        stage: newStage,
        timestamp: new Date().toISOString(),
        actor: actorUserId,
        notes,
        previousStage: currentStage
      });

      // Update workflow
      const { data, error } = await supabase
        .from('dispute_workflows')
        .update({
          current_stage: newStage,
          stage_history: JSON.stringify(stageHistory),
          updated_at: new Date().toISOString()
        })
        .eq('case_id', caseId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update workflow: ${error.message}`);
      }

      // Update case status to match stage
      const caseStatus = this.stageToStatus(newStage);
      await Case.updateStatus(caseId, caseStatus);

      // Trigger stage-specific actions
      await this.onStageTransition(caseId, newStage, workflow);

      logger.info(`Successfully transitioned case ${caseId} to ${newStage}`);

      return {
        success: true,
        workflow: data,
        previousStage: currentStage,
        newStage
      };

    } catch (error) {
      logger.error(`Failed to transition stage for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check if transition is valid
  isValidTransition(currentStage, newStage) {
    const allowedTransitions = STAGE_TRANSITIONS[currentStage] || [];
    return allowedTransitions.includes(newStage);
  }

  // Get allowed transitions for current stage
  getAllowedTransitions(currentStage) {
    return STAGE_TRANSITIONS[currentStage] || [];
  }

  // Convert stage to case status
  stageToStatus(stage) {
    const stageStatusMap = {
      [DisputeStage.DRAFT]: 'draft',
      [DisputeStage.AWAITING_RESPONDENT]: 'pending',
      [DisputeStage.STATEMENT_COLLECTION]: 'active',
      [DisputeStage.STATEMENT_FINALIZED]: 'active',
      [DisputeStage.AI_ANALYSIS]: 'analyzing',
      [DisputeStage.OPTIONS_PRESENTED]: 'negotiation',
      [DisputeStage.AWAITING_SELECTION]: 'negotiation',
      [DisputeStage.CONSENSUS_REACHED]: 'settlement',
      [DisputeStage.REANALYSIS]: 'analyzing',
      [DisputeStage.SETTLEMENT_READY]: 'settlement',
      [DisputeStage.SIGNATURE_PENDING]: 'settlement',
      [DisputeStage.CLOSED_SETTLED]: 'closed',
      [DisputeStage.FORWARDED_TO_COURT]: 'escalated',
      [DisputeStage.CLOSED_REJECTED]: 'closed'
    };

    return stageStatusMap[stage] || 'active';
  }

  // Handle stage-specific actions
  async onStageTransition(caseId, newStage, workflow) {
    try {
      // Import services only when needed to avoid circular dependencies
      const EmailService = require('./EmailService');
      const NotificationService = require('./NotificationService');

      switch (newStage) {
        case DisputeStage.AWAITING_RESPONDENT:
          // Notification sent when party is invited (handled by InvitationService)
          break;

        case DisputeStage.STATEMENT_COLLECTION:
          // Notify both parties to submit statements
          await NotificationService.notifyStatementsNeeded(caseId);
          break;

        case DisputeStage.AI_ANALYSIS:
          // Trigger AI analysis (handled separately)
          logger.info(`Case ${caseId} ready for AI analysis`);
          break;

        case DisputeStage.OPTIONS_PRESENTED:
          // Notify parties that settlement options are ready
          await NotificationService.notifyOptionsReady(caseId);
          break;

        case DisputeStage.CONSENSUS_REACHED:
          // Notify parties of consensus
          await NotificationService.notifyConsensusReached(caseId);
          break;

        case DisputeStage.FORWARDED_TO_COURT:
          // Notify parties case is being forwarded to court
          await NotificationService.notifyCaseForwarded(caseId);
          break;

        case DisputeStage.CLOSED_SETTLED:
          // Send final settlement documents
          await NotificationService.notifySettlementClosed(caseId);
          break;

        default:
          // No specific action needed
          break;
      }

    } catch (error) {
      logger.error(`Error in stage transition handler for ${newStage}:`, error);
      // Don't throw - stage transition should succeed even if notifications fail
    }
  }

  // Update workflow metadata
  async updateMetadata(caseId, updates) {
    try {
      const workflowResult = await this.getWorkflow(caseId);
      if (!workflowResult.success) {
        throw new Error('Workflow not found');
      }

      const workflow = workflowResult.workflow;
      const currentMetadata = workflow.metadata || {};
      const newMetadata = { ...currentMetadata, ...updates };

      const { data, error } = await supabase
        .from('dispute_workflows')
        .update({
          metadata: JSON.stringify(newMetadata),
          updated_at: new Date().toISOString()
        })
        .eq('case_id', caseId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update metadata: ${error.message}`);
      }

      return {
        success: true,
        workflow: data
      };

    } catch (error) {
      logger.error(`Failed to update workflow metadata:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get workflow statistics
  async getStatistics(caseId) {
    try {
      const workflowResult = await this.getWorkflow(caseId);
      if (!workflowResult.success) {
        throw new Error('Workflow not found');
      }

      const workflow = workflowResult.workflow;
      const stageHistory = workflow.stage_history || [];

      // Calculate statistics
      const stats = {
        currentStage: workflow.current_stage,
        totalStages: stageHistory.length,
        daysInCurrentStage: this.getDaysInStage(stageHistory[stageHistory.length - 1]),
        totalDuration: this.getTotalDuration(workflow.initiated_at),
        stageTransitions: stageHistory.length - 1,
        reanalysisCount: workflow.metadata?.reanalysisCount || 0,
        estimatedCompletion: this.estimateCompletion(workflow.current_stage)
      };

      return {
        success: true,
        statistics: stats
      };

    } catch (error) {
      logger.error(`Failed to get workflow statistics:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper: Calculate days in current stage
  getDaysInStage(stageEntry) {
    if (!stageEntry) return 0;
    const stageStart = new Date(stageEntry.timestamp);
    const now = new Date();
    return Math.floor((now - stageStart) / (1000 * 60 * 60 * 24));
  }

  // Helper: Calculate total duration
  getTotalDuration(initiatedAt) {
    const start = new Date(initiatedAt);
    const now = new Date();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  }

  // Helper: Estimate completion
  estimateCompletion(currentStage) {
    const stageEstimates = {
      [DisputeStage.DRAFT]: 14,
      [DisputeStage.AWAITING_RESPONDENT]: 10,
      [DisputeStage.STATEMENT_COLLECTION]: 7,
      [DisputeStage.STATEMENT_FINALIZED]: 2,
      [DisputeStage.AI_ANALYSIS]: 1,
      [DisputeStage.OPTIONS_PRESENTED]: 5,
      [DisputeStage.AWAITING_SELECTION]: 7,
      [DisputeStage.CONSENSUS_REACHED]: 3,
      [DisputeStage.REANALYSIS]: 3,
      [DisputeStage.SETTLEMENT_READY]: 2,
      [DisputeStage.SIGNATURE_PENDING]: 3,
      [DisputeStage.CLOSED_SETTLED]: 0,
      [DisputeStage.FORWARDED_TO_COURT]: 0,
      [DisputeStage.CLOSED_REJECTED]: 0
    };

    return stageEstimates[currentStage] || 7;
  }
}

module.exports = new DisputeWorkflowService();
module.exports.DisputeStage = DisputeStage;
