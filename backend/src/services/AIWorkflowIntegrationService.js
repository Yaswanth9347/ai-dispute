// AI Workflow Integration Service - Connect AI features with dispute workflow
const { logger } = require('../lib/logger');
const AIService = require('./AIService');
const AIAnalysis = require('../models/AIAnalysis');
const SettlementOptions = require('../models/SettlementOptions');
const DisputeWorkflowService = require('./DisputeWorkflowService');
const RealTimeService = require('./RealTimeService');
const EmailService = require('./EmailService');
const SMSService = require('./SMSService');
const Case = require('../models/Case');
const Statement = require('../models/Statement');
const Evidence = require('../models/Evidence');

class AIWorkflowIntegrationService {
  constructor() {
    this.disputeWorkflow = DisputeWorkflowService;
  }

  // Trigger AI analysis when workflow reaches AI_ANALYSIS stage
  async triggerAIAnalysis(caseId, actorUserId) {
    try {
      logger.info(`Triggering AI analysis for case ${caseId}`);

      // Get case data and statements
      const caseData = await Case.getById(caseId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      // Check if AI service is available
      if (!AIService.isAvailable()) {
        throw new Error('AI service is currently unavailable');
      }

      // Get case statements and evidence
      const statements = await Statement.getByCaseId(caseId);
      const evidence = await Evidence.getByCaseId(caseId);

      const complainerStatement = statements.find(s => s.party_type === 'complainer')?.content || '';
      const defenderStatement = statements.find(s => s.party_type === 'defender')?.content || '';

      // Prepare data for AI analysis
      const analysisData = {
        complainerStatement,
        defenderStatement,
        evidence: evidence.map(e => ({
          description: e.description,
          file_name: e.file_name,
          uploaded_by: e.uploaded_by === caseData.filed_by ? 'complainer' : 'defender'
        })),
        caseDetails: {
          title: caseData.title,
          description: caseData.description,
          dispute_amount: caseData.dispute_amount,
          category: caseData.category,
          priority: caseData.priority
        }
      };

      // Perform AI analysis
      const startTime = Date.now();
      const aiResponse = await AIService.analyzeCaseForResolution(analysisData);
      const processingTime = Date.now() - startTime;

      // Store analysis results
      const analysisRecord = await AIAnalysis.createAnalysis({
        case_id: caseId,
        analysis_type: 'case_analysis',
        model: aiResponse.provider === 'anthropic' ? 'claude-3-5-sonnet' : 'gpt-4',
        analysis: aiResponse,
        confidence_score: aiResponse.riskAssessment?.complainerWinProbability || 0.5,
        processing_time_ms: processingTime,
        tokens_used: aiResponse.usage?.totalTokens || 0,
        is_final: false
      });

      // Update workflow metadata
      await this.disputeWorkflow.updateMetadata(caseId, {
        ai_analysis_completed: true,
        ai_analysis_date: new Date().toISOString(),
        ai_analysis_id: analysisRecord.id,
        ai_confidence: aiResponse.riskAssessment?.complainerWinProbability || 0.5
      });

      // Send real-time notification
      RealTimeService.emitToCaseRoom(caseId, 'aiAnalysisCompleted', {
        analysis: aiResponse,
        analysisId: analysisRecord.id,
        timestamp: new Date().toISOString()
      });

      // Notify parties
      await this.notifyPartiesOfAnalysis(caseData, aiResponse);

      // Auto-transition to OPTIONS_PRESENTED stage
      await this.disputeWorkflow.transitionStage(
        caseId, 
        this.disputeWorkflow.DisputeStage.OPTIONS_PRESENTED, 
        actorUserId,
        'AI analysis completed successfully'
      );

      logger.info(`AI analysis completed and workflow transitioned for case ${caseId}`);

      return {
        success: true,
        analysis: aiResponse,
        analysisId: analysisRecord.id,
        processingTime
      };

    } catch (error) {
      logger.error(`Failed to trigger AI analysis for case ${caseId}:`, error);
      
      // Update workflow metadata with error
      await this.disputeWorkflow.updateMetadata(caseId, {
        ai_analysis_error: error.message,
        ai_analysis_failed_at: new Date().toISOString()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate settlement options when workflow reaches OPTIONS_PRESENTED stage
  async generateSettlementOptions(caseId, actorUserId) {
    try {
      logger.info(`Generating settlement options for case ${caseId}`);

      const caseData = await Case.getById(caseId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      // Get the latest case analysis
      const latestAnalysis = await AIAnalysis.getLatestAnalysis(caseId, 'case_analysis');
      if (!latestAnalysis) {
        throw new Error('Case analysis must be completed before generating settlement options');
      }

      // Generate settlement options using AI
      const startTime = Date.now();
      const settlementOptions = await AIService.generateSettlementOptions(
        caseData,
        latestAnalysis.analysis
      );
      const processingTime = Date.now() - startTime;

      // Store settlement options
      const optionsRecord = await AIAnalysis.createSettlementOptions({
        case_id: caseId,
        model: 'claude-3-5-sonnet',
        settlement_options: settlementOptions,
        confidence_score: 0.8,
        processing_time_ms: processingTime,
        tokens_used: settlementOptions.usage?.totalTokens || 0
      });

      // Create active settlement options record for tracking selections
      const activeOptions = await SettlementOptions.createOptions({
        case_id: caseId,
        analysis_id: optionsRecord.id,
        options_data: settlementOptions,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

      // Update workflow metadata
      await this.disputeWorkflow.updateMetadata(caseId, {
        settlement_options_generated: true,
        settlement_options_date: new Date().toISOString(),
        settlement_options_id: optionsRecord.id,
        active_options_id: activeOptions.id,
        options_count: settlementOptions.options.length
      });

      // Transition to AWAITING_SELECTION stage
      await this.disputeWorkflow.transitionStage(
        caseId,
        this.disputeWorkflow.DisputeStage.AWAITING_SELECTION,
        actorUserId,
        `Generated ${settlementOptions.options.length} settlement options`
      );

      // Send real-time update
      RealTimeService.emitToCaseRoom(caseId, 'settlementOptionsGenerated', {
        options: settlementOptions,
        optionsId: optionsRecord.id,
        timestamp: new Date().toISOString()
      });

      // Notify parties
      await this.notifyPartiesOfSettlementOptions(caseData, settlementOptions);

      logger.info(`Settlement options generated for case ${caseId}`);

      return {
        success: true,
        options: settlementOptions,
        optionsId: optionsRecord.id,
        activeOptionsId: activeOptions.id,
        processingTime
      };

    } catch (error) {
      logger.error(`Failed to generate settlement options for case ${caseId}:`, error);
      
      // Update workflow metadata with error
      await this.disputeWorkflow.updateMetadata(caseId, {
        settlement_options_error: error.message,
        settlement_options_failed_at: new Date().toISOString()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handle party selection and check for consensus
  async handleOptionSelection(caseId, userId, optionId, reasoning, partyType) {
    try {
      logger.info(`Processing option selection for case ${caseId}, party: ${partyType}`);

      // Get active settlement options
      const activeOptions = await SettlementOptions.getActiveByCaseId(caseId);
      if (!activeOptions) {
        throw new Error('No active settlement options found');
      }

      // Record the selection
      const selection = await SettlementOptions.recordSelection({
        options_id: activeOptions.id,
        case_id: caseId,
        user_id: userId,
        party_type: partyType,
        selected_option_id: optionId,
        selection_reasoning: reasoning
      });

      // Check if both parties have selected
      const selectionStatus = await SettlementOptions.checkBothPartiesSelected(activeOptions.id);

      // Update workflow metadata
      await this.disputeWorkflow.updateMetadata(caseId, {
        [`${partyType}_selection_made`]: true,
        [`${partyType}_selection_date`]: new Date().toISOString(),
        [`${partyType}_selected_option`]: optionId,
        both_parties_selected: selectionStatus.bothSelected
      });

      // Send real-time update
      RealTimeService.emitToCaseRoom(caseId, 'optionSelected', {
        partyType,
        optionId,
        bothSelected: selectionStatus.bothSelected,
        sameOption: selectionStatus.sameOption,
        timestamp: new Date().toISOString()
      });

      // Handle different selection outcomes
      if (selectionStatus.bothSelected) {
        if (selectionStatus.sameOption) {
          // Both parties selected the same option - finalize settlement
          await this.finalizeConsensus(caseId, optionId, activeOptions, 'same_option');
        } else {
          // Different options selected - generate combined solution
          await this.generateCombinedSolution(caseId, selectionStatus.selections, activeOptions);
        }
      }

      logger.info(`Option selection processed for case ${caseId}`);

      return {
        success: true,
        selection,
        bothSelected: selectionStatus.bothSelected,
        sameOption: selectionStatus.sameOption
      };

    } catch (error) {
      logger.error(`Failed to handle option selection for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate combined solution when parties select different options
  async generateCombinedSolution(caseId, selections, activeOptions) {
    try {
      logger.info(`Generating combined solution for case ${caseId}`);

      const caseData = await Case.getById(caseId);
      const latestAnalysis = await AIAnalysis.getLatestAnalysis(caseId, 'case_analysis');

      // Get the selected options
      const complainerOption = activeOptions.options_data.options.find(
        opt => opt.id === selections.complainer.selected_option_id
      );
      const defenderOption = activeOptions.options_data.options.find(
        opt => opt.id === selections.defender.selected_option_id
      );

      const selectedOptions = {
        complainer: complainerOption,
        defender: defenderOption
      };

      // Generate combined solution using AI
      const combinedSolution = await AIService.generateCombinedSolution(
        selectedOptions,
        caseData,
        latestAnalysis.analysis
      );

      // Store combined solution
      const combinedRecord = await AIAnalysis.createCombinedSolution({
        case_id: caseId,
        model: 'claude-3-5-sonnet',
        combined_solution: combinedSolution,
        confidence_score: combinedSolution.acceptanceProbability || 0.75,
        processing_time_ms: 0,
        tokens_used: 0
      });

      // Update workflow metadata
      await this.disputeWorkflow.updateMetadata(caseId, {
        combined_solution_generated: true,
        combined_solution_date: new Date().toISOString(),
        combined_solution_id: combinedRecord.id,
        acceptance_probability: combinedSolution.acceptanceProbability
      });

      // Transition to a special "consensus_pending" status (we can reuse AWAITING_SELECTION with metadata)
      await this.disputeWorkflow.updateMetadata(caseId, {
        waiting_for_combined_solution_consensus: true
      });

      // Send real-time update
      RealTimeService.emitToCaseRoom(caseId, 'combinedSolutionGenerated', {
        combinedSolution,
        combinedSolutionId: combinedRecord.id,
        timestamp: new Date().toISOString()
      });

      // Notify parties
      await this.notifyPartiesOfCombinedSolution(caseData, combinedSolution);

      logger.info(`Combined solution generated for case ${caseId}`);

      return {
        success: true,
        combinedSolution,
        combinedSolutionId: combinedRecord.id
      };

    } catch (error) {
      logger.error(`Failed to generate combined solution for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Finalize consensus and transition to settlement
  async finalizeConsensus(caseId, selectedOptionId, activeOptions, consensusType) {
    try {
      logger.info(`Finalizing consensus for case ${caseId}, type: ${consensusType}`);

      const selectedOption = activeOptions.options_data.options.find(opt => opt.id === selectedOptionId);

      // Update workflow metadata
      await this.disputeWorkflow.updateMetadata(caseId, {
        consensus_reached: true,
        consensus_date: new Date().toISOString(),
        consensus_type: consensusType,
        selected_settlement_option: selectedOption,
        settlement_ready: true
      });

      // Mark options as completed
      await SettlementOptions.updateStatus(activeOptions.id, 'completed');

      // Transition to CONSENSUS_REACHED stage
      await this.disputeWorkflow.transitionStage(
        caseId,
        this.disputeWorkflow.DisputeStage.CONSENSUS_REACHED,
        null, // system action
        `Consensus reached: ${consensusType === 'same_option' ? 'Same option selected' : 'Combined solution accepted'}`
      );

      // Send real-time update
      RealTimeService.emitToCaseRoom(caseId, 'consensusReached', {
        consensusType,
        selectedOption,
        timestamp: new Date().toISOString()
      });

      // Notify parties of successful consensus
      const caseData = await Case.getById(caseId);
      await this.notifyPartiesOfConsensus(caseData, selectedOption, consensusType);

      // Auto-transition to SETTLEMENT_READY stage
      setTimeout(async () => {
        await this.disputeWorkflow.transitionStage(
          caseId,
          this.disputeWorkflow.DisputeStage.SETTLEMENT_READY,
          null,
          'Settlement documents are being prepared'
        );
      }, 1000);

      logger.info(`Consensus finalized for case ${caseId}`);

      return {
        success: true,
        consensusType,
        selectedOption
      };

    } catch (error) {
      logger.error(`Failed to finalize consensus for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get current AI workflow status
  async getAIWorkflowStatus(caseId) {
    try {
      const workflow = await this.disputeWorkflow.getWorkflow(caseId);
      if (!workflow.success) {
        throw new Error('Workflow not found');
      }

      const currentStage = workflow.workflow.current_stage;
      const metadata = workflow.workflow.metadata || {};

      // Get AI-related data
      const latestAnalysis = await AIAnalysis.getLatestAnalysis(caseId, 'case_analysis');
      const settlementOptions = await AIAnalysis.getSettlementOptions(caseId);
      const activeOptions = await SettlementOptions.getActiveByCaseId(caseId);
      
      let selections = null;
      let selectionStatus = null;

      if (activeOptions) {
        selections = await SettlementOptions.getSelections(activeOptions.id);
        selectionStatus = await SettlementOptions.checkBothPartiesSelected(activeOptions.id);
      }

      return {
        success: true,
        status: {
          currentStage,
          metadata,
          analysis: latestAnalysis ? latestAnalysis.analysis : null,
          settlementOptions: settlementOptions ? settlementOptions.analysis : null,
          activeOptions,
          selections,
          selectionStatus,
          isAIStage: this.isAIRelatedStage(currentStage),
          nextAIAction: this.getNextAIAction(currentStage, metadata)
        }
      };

    } catch (error) {
      logger.error(`Failed to get AI workflow status for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper methods
  isAIRelatedStage(stage) {
    const aiStages = [
      this.disputeWorkflow.DisputeStage.AI_ANALYSIS,
      this.disputeWorkflow.DisputeStage.OPTIONS_PRESENTED,
      this.disputeWorkflow.DisputeStage.AWAITING_SELECTION,
      this.disputeWorkflow.DisputeStage.CONSENSUS_REACHED
    ];
    return aiStages.includes(stage);
  }

  getNextAIAction(currentStage, metadata) {
    switch (currentStage) {
      case this.disputeWorkflow.DisputeStage.STATEMENT_FINALIZED:
        return 'trigger_ai_analysis';
      case this.disputeWorkflow.DisputeStage.AI_ANALYSIS:
        return metadata.ai_analysis_completed ? 'generate_settlement_options' : 'waiting_for_analysis';
      case this.disputeWorkflow.DisputeStage.OPTIONS_PRESENTED:
        return 'await_party_selections';
      case this.disputeWorkflow.DisputeStage.AWAITING_SELECTION:
        if (metadata.waiting_for_combined_solution_consensus) {
          return 'await_combined_solution_consensus';
        }
        return metadata.both_parties_selected ? 'process_selections' : 'await_party_selections';
      case this.disputeWorkflow.DisputeStage.CONSENSUS_REACHED:
        return 'prepare_settlement_documents';
      default:
        return null;
    }
  }

  // Notification methods
  async notifyPartiesOfAnalysis(caseData, analysis) {
    const parties = [
      { email: caseData.filed_by_email, phone: caseData.filed_by_phone, type: 'complainer' },
      { email: caseData.defender_email, phone: caseData.defender_phone, type: 'defender' }
    ];

    for (const party of parties) {
      try {
        if (party.email) {
          await EmailService.sendAIAnalysisComplete(party.email, {
            caseNumber: caseData.case_number || caseData.id.slice(-8),
            caseId: caseData.id,
            summary: analysis.summary
          });
        }
      } catch (error) {
        logger.error(`Error notifying ${party.type} of analysis:`, error);
      }
    }
  }

  async notifyPartiesOfSettlementOptions(caseData, options) {
    const parties = [
      { email: caseData.filed_by_email, phone: caseData.filed_by_phone },
      { email: caseData.defender_email, phone: caseData.defender_phone }
    ];

    for (const party of parties) {
      try {
        if (party.email) {
          await EmailService.sendSettlementOptionsAvailable(party.email, {
            caseNumber: caseData.case_number || caseData.id.slice(-8),
            caseId: caseData.id,
            optionsCount: options.options.length
          });
        }
      } catch (error) {
        logger.error('Error sending settlement options notification:', error);
      }
    }
  }

  async notifyPartiesOfCombinedSolution(caseData, solution) {
    const parties = [
      { email: caseData.filed_by_email, phone: caseData.filed_by_phone },
      { email: caseData.defender_email, phone: caseData.defender_phone }
    ];

    for (const party of parties) {
      try {
        if (party.email) {
          await EmailService.sendCombinedSolutionGenerated(party.email, {
            caseNumber: caseData.case_number || caseData.id.slice(-8),
            caseId: caseData.id,
            solution: solution.combinedSolution
          });
        }
      } catch (error) {
        logger.error('Error sending combined solution notification:', error);
      }
    }
  }

  async notifyPartiesOfConsensus(caseData, selectedOption, consensusType) {
    const parties = [
      { email: caseData.filed_by_email, phone: caseData.filed_by_phone },
      { email: caseData.defender_email, phone: caseData.defender_phone }
    ];

    for (const party of parties) {
      try {
        if (party.email) {
          await EmailService.sendConsensusReached(party.email, {
            caseNumber: caseData.case_number || caseData.id.slice(-8),
            caseId: caseData.id,
            settlementTitle: selectedOption.title,
            consensusType
          });
        }
      } catch (error) {
        logger.error('Error sending consensus notification:', error);
      }
    }
  }
}

module.exports = new AIWorkflowIntegrationService();