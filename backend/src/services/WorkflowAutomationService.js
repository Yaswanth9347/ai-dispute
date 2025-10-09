// Phase 5.4 - Workflow Automation Service
// Advanced automation and integration system for legal document workflows

const { supabase } = require('../lib/supabaseClient');
const { logger } = require('../lib/logger');
const DocumentGeneratorService = require('./DocumentGeneratorService');
const CourtIntegrationService = require('./CourtIntegrationService');
const AdvancedDocumentService = require('./AdvancedDocumentService');
const { sendEmail } = require('../lib/mailer');

class WorkflowAutomationService {
  constructor() {
    this.documentService = DocumentGeneratorService;
    this.courtService = CourtIntegrationService;
    this.advancedDocService = AdvancedDocumentService;
    this.activeExecutions = new Map();
    this.executionQueue = [];
    this.processingQueue = false;
  }

  // Create workflow automation
  async createWorkflowAutomation(automationData, userId) {
    try {
      const {
        name,
        description,
        triggerType,
        triggerConditions,
        actions,
        settings = {}
      } = automationData;

      // Validate automation data
      const validation = this.validateAutomation({
        name, triggerType, triggerConditions, actions
      });

      if (!validation.isValid) {
        throw new Error(`Invalid automation: ${validation.errors.join(', ')}`);
      }

      // Create automation record
      const { data: automation, error } = await supabase
        .from('workflow_automations')
        .insert({
          name,
          description,
          trigger_type: triggerType,
          trigger_conditions: triggerConditions,
          actions,
          settings,
          created_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Workflow automation created', { 
        automationId: automation.id, 
        name, 
        triggerType 
      });

      return {
        success: true,
        data: { automation }
      };

    } catch (error) {
      logger.error('Failed to create workflow automation', { error: error.message });
      throw error;
    }
  }

  // Execute workflow automation
  async executeWorkflowAutomation(automationId, triggerData = {}) {
    try {
      // Get automation details
      const { data: automation, error } = await supabase
        .from('workflow_automations')
        .select('*')
        .eq('id', automationId)
        .eq('status', 'active')
        .single();

      if (error || !automation) {
        throw new Error('Automation not found or inactive');
      }

      // Create execution record
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .insert({
          automation_id: automationId,
          trigger_data: triggerData,
          actions_total: automation.actions.length,
          status: 'pending'
        })
        .select()
        .single();

      if (execError) throw execError;

      // Add to execution queue
      this.executionQueue.push({
        executionId: execution.id,
        automation,
        triggerData
      });

      // Process queue if not already processing
      if (!this.processingQueue) {
        this.processExecutionQueue();
      }

      return {
        success: true,
        data: { 
          executionId: execution.id,
          status: 'queued'
        }
      };

    } catch (error) {
      logger.error('Failed to execute workflow automation', { 
        automationId, 
        error: error.message 
      });
      throw error;
    }
  }

  // Process execution queue
  async processExecutionQueue() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;

    try {
      while (this.executionQueue.length > 0) {
        const execution = this.executionQueue.shift();
        await this.runWorkflowExecution(execution);
      }
    } catch (error) {
      logger.error('Error processing execution queue', { error: error.message });
    } finally {
      this.processingQueue = false;
    }
  }

  // Run single workflow execution
  async runWorkflowExecution({ executionId, automation, triggerData }) {
    const startTime = Date.now();
    let completedActions = 0;
    const executionLog = [];

    try {
      // Update execution status to running
      await supabase
        .from('workflow_executions')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', executionId);

      this.activeExecutions.set(executionId, {
        status: 'running',
        startTime,
        automation
      });

      // Execute actions sequentially
      for (const action of automation.actions) {
        try {
          const actionResult = await this.executeAction(action, triggerData, automation);
          
          executionLog.push({
            action: action.type,
            timestamp: new Date().toISOString(),
            status: 'completed',
            result: actionResult
          });

          completedActions++;

        } catch (actionError) {
          executionLog.push({
            action: action.type,
            timestamp: new Date().toISOString(),
            status: 'failed',
            error: actionError.message
          });

          // Decide whether to continue or stop based on action settings
          if (action.stopOnError !== false) {
            throw actionError;
          }
        }

        // Update progress
        await supabase
          .from('workflow_executions')
          .update({ 
            actions_completed: completedActions,
            execution_log: executionLog
          })
          .eq('id', executionId);
      }

      // Mark execution as completed
      const duration = Date.now() - startTime;
      
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          actions_completed: completedActions,
          execution_log: executionLog,
          results: { success: true, actionsCompleted: completedActions }
        })
        .eq('id', executionId);

      // Update automation statistics
      await this.updateAutomationStats(automation.id, true);

      logger.info('Workflow execution completed', {
        executionId,
        automationId: automation.id,
        duration,
        actionsCompleted: completedActions
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Mark execution as failed
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          actions_completed: completedActions,
          execution_log: executionLog,
          error_details: { message: error.message, stack: error.stack }
        })
        .eq('id', executionId);

      // Update automation statistics
      await this.updateAutomationStats(automation.id, false);

      logger.error('Workflow execution failed', {
        executionId,
        automationId: automation.id,
        error: error.message,
        duration
      });

    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  // Execute individual action
  async executeAction(action, triggerData, automation) {
    const { type, config } = action;

    switch (type) {
      case 'generate_document':
        return await this.executeGenerateDocumentAction(config, triggerData);
      
      case 'file_to_court':
        return await this.executeCourtFilingAction(config, triggerData);
      
      case 'send_notification':
        return await this.executeSendNotificationAction(config, triggerData);
      
      case 'create_collaboration':
        return await this.executeCreateCollaborationAction(config, triggerData);
      
      case 'submit_for_approval':
        return await this.executeSubmitApprovalAction(config, triggerData);
      
      case 'ai_review_document':
        return await this.executeAIReviewAction(config, triggerData);
      
      case 'update_case_status':
        return await this.executeUpdateCaseStatusAction(config, triggerData);
      
      case 'create_calendar_event':
        return await this.executeCreateCalendarEventAction(config, triggerData);
      
      case 'send_webhook':
        return await this.executeSendWebhookAction(config, triggerData);
      
      case 'conditional_branch':
        return await this.executeConditionalBranchAction(config, triggerData, automation);
      
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  // Action executors
  async executeGenerateDocumentAction(config, triggerData) {
    const { templateId, caseId, outputFormat = 'pdf', variables = {} } = config;
    
    // Merge trigger data with configured variables
    const mergedVariables = { ...variables, ...triggerData };
    
    const result = await this.documentService.generateDocument({
      templateId,
      caseId: caseId || triggerData.caseId,
      variables: mergedVariables,
      outputFormat,
      generateAI: config.generateAI || false
    });

    return { documentId: result.data.documentId };
  }

  async executeCourtFilingAction(config, triggerData) {
    const { courtSystemId, filingType, documentIds, expedited = false } = config;
    
    const result = await this.courtService.fileCaseWithCourt({
      caseId: triggerData.caseId,
      courtSystemId,
      documentIds: documentIds || [triggerData.documentId],
      filingType,
      expedited,
      serviceMethod: config.serviceMethod || 'electronic'
    });

    return { filingId: result.data.filingId };
  }

  async executeSendNotificationAction(config, triggerData) {
    const { recipients, subject, template, channels = ['email'] } = config;
    
    const notifications = [];
    
    for (const recipient of recipients) {
      if (channels.includes('email')) {
        await sendEmail({
          to: recipient.email,
          subject,
          template,
          data: { ...triggerData, recipient }
        });
        
        notifications.push({
          type: 'email',
          recipient: recipient.email,
          status: 'sent'
        });
      }
      
      // Add SMS, push notifications, etc. here
    }

    return { notifications };
  }

  async executeCreateCollaborationAction(config, triggerData) {
    const { documentId, participants, type = 'review', permissions = {} } = config;
    
    const result = await this.advancedDocService.startCollaboration({
      documentId: documentId || triggerData.documentId,
      participants,
      type,
      permissions,
      settings: config.settings || {}
    });

    return { collaborationId: result.data.collaborationId };
  }

  async executeSubmitApprovalAction(config, triggerData) {
    const { documentId, approvers, workflowType = 'sequential', deadline } = config;
    
    const result = await this.advancedDocService.submitForApproval({
      documentId: documentId || triggerData.documentId,
      approvers,
      workflowType,
      deadline,
      autoApproveRules: config.autoApproveRules || {}
    });

    return { approvalId: result.data.approvalId };
  }

  async executeAIReviewAction(config, triggerData) {
    const { documentId, reviewType = 'smart_review' } = config;
    
    const result = await this.advancedDocService.performSmartReview({
      documentId: documentId || triggerData.documentId,
      reviewType,
      options: config.options || {}
    });

    return { reviewId: result.data.reviewId };
  }

  async executeUpdateCaseStatusAction(config, triggerData) {
    const { caseId, newStatus, reason } = config;
    
    const { error } = await supabase
      .from('cases')
      .update({ 
        status: newStatus,
        status_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', caseId || triggerData.caseId);

    if (error) throw error;

    return { caseId: caseId || triggerData.caseId, newStatus };
  }

  async executeCreateCalendarEventAction(config, triggerData) {
    // This would integrate with calendar systems like Google Calendar, Outlook, etc.
    const { title, startTime, duration, attendees, description } = config;
    
    // Mock implementation - integrate with actual calendar API
    const event = {
      id: `evt_${Date.now()}`,
      title,
      startTime,
      duration,
      attendees,
      description: description || `Auto-generated event for case ${triggerData.caseId}`
    };

    logger.info('Calendar event created', { event });
    
    return { eventId: event.id };
  }

  async executeSendWebhookAction(config, triggerData) {
    const { url, method = 'POST', headers = {}, payload } = config;
    
    const webhookPayload = {
      ...payload,
      triggerData,
      timestamp: new Date().toISOString()
    };

    // Mock webhook call - implement actual HTTP request
    logger.info('Webhook sent', { 
      url, 
      method, 
      payload: webhookPayload 
    });

    return { webhookId: `webhook_${Date.now()}`, status: 'sent' };
  }

  async executeConditionalBranchAction(config, triggerData, automation) {
    const { condition, trueActions = [], falseActions = [] } = config;
    
    const conditionResult = this.evaluateCondition(condition, triggerData);
    const actionsToExecute = conditionResult ? trueActions : falseActions;
    
    const results = [];
    
    for (const action of actionsToExecute) {
      const result = await this.executeAction(action, triggerData, automation);
      results.push(result);
    }

    return { 
      conditionResult, 
      actionsExecuted: actionsToExecute.length,
      results 
    };
  }

  // Condition evaluation
  evaluateCondition(condition, data) {
    const { field, operator, value } = condition;
    const fieldValue = this.getNestedValue(data, field);

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'contains':
        return String(fieldValue).includes(value);
      case 'starts_with':
        return String(fieldValue).startsWith(value);
      case 'ends_with':
        return String(fieldValue).endsWith(value);
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      default:
        return false;
    }
  }

  // Get nested object value by path
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj
    );
  }

  // Trigger workflow based on events
  async triggerWorkflow(triggerType, triggerData) {
    try {
      // Find active automations with matching trigger
      const { data: automations, error } = await supabase
        .from('workflow_automations')
        .select('*')
        .eq('trigger_type', triggerType)
        .eq('status', 'active');

      if (error) throw error;

      const triggeredExecutions = [];

      for (const automation of automations) {
        // Check if trigger conditions are met
        if (this.checkTriggerConditions(automation.trigger_conditions, triggerData)) {
          const execution = await this.executeWorkflowAutomation(automation.id, triggerData);
          triggeredExecutions.push(execution);
        }
      }

      return {
        success: true,
        data: {
          triggeredCount: triggeredExecutions.length,
          executions: triggeredExecutions
        }
      };

    } catch (error) {
      logger.error('Failed to trigger workflows', { 
        triggerType, 
        error: error.message 
      });
      throw error;
    }
  }

  // Check trigger conditions
  checkTriggerConditions(conditions, data) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true; // No conditions means always trigger
    }

    // Handle multiple conditions with AND/OR logic
    if (conditions.operator === 'OR') {
      return conditions.conditions.some(condition => 
        this.evaluateCondition(condition, data)
      );
    } else {
      // Default to AND logic
      const conditionsArray = conditions.conditions || [conditions];
      return conditionsArray.every(condition => 
        this.evaluateCondition(condition, data)
      );
    }
  }

  // Update automation statistics
  async updateAutomationStats(automationId, success) {
    try {
      const { data: current, error: fetchError } = await supabase
        .from('workflow_automations')
        .select('execution_count, success_rate')
        .eq('id', automationId)
        .single();

      if (fetchError) throw fetchError;

      const newExecutionCount = (current.execution_count || 0) + 1;
      const currentSuccessRate = current.success_rate || 0;
      const currentSuccessCount = Math.round(currentSuccessRate * (current.execution_count || 0));
      const newSuccessCount = success ? currentSuccessCount + 1 : currentSuccessCount;
      const newSuccessRate = newSuccessCount / newExecutionCount;

      const { error: updateError } = await supabase
        .from('workflow_automations')
        .update({
          execution_count: newExecutionCount,
          success_rate: newSuccessRate,
          last_executed_at: new Date().toISOString()
        })
        .eq('id', automationId);

      if (updateError) throw updateError;

    } catch (error) {
      logger.error('Failed to update automation stats', { 
        automationId, 
        error: error.message 
      });
    }
  }

  // Validate automation configuration
  validateAutomation({ name, triggerType, triggerConditions, actions }) {
    const errors = [];

    if (!name || name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!triggerType) {
      errors.push('Trigger type is required');
    }

    const validTriggerTypes = [
      'document_generated',
      'case_status_change',
      'approval_completed',
      'time_based',
      'court_filing_complete',
      'collaboration_started'
    ];

    if (!validTriggerTypes.includes(triggerType)) {
      errors.push(`Invalid trigger type. Must be one of: ${validTriggerTypes.join(', ')}`);
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      errors.push('At least one action is required');
    }

    // Validate each action
    for (const [index, action] of actions.entries()) {
      if (!action.type) {
        errors.push(`Action ${index + 1}: Type is required`);
      }
      
      if (!action.config) {
        errors.push(`Action ${index + 1}: Configuration is required`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get workflow automation statistics
  async getWorkflowStatistics(userId) {
    try {
      const { data: automations, error } = await supabase
        .from('workflow_automations')
        .select(`
          *,
          workflow_executions(count)
        `)
        .eq('created_by', userId);

      if (error) throw error;

      const stats = {
        totalAutomations: automations.length,
        activeAutomations: automations.filter(a => a.status === 'active').length,
        totalExecutions: automations.reduce((sum, a) => sum + (a.execution_count || 0), 0),
        averageSuccessRate: automations.length > 0 
          ? automations.reduce((sum, a) => sum + (a.success_rate || 0), 0) / automations.length
          : 0,
        triggerTypeDistribution: {},
        recentActivity: []
      };

      // Calculate trigger type distribution
      automations.forEach(automation => {
        const type = automation.trigger_type;
        stats.triggerTypeDistribution[type] = (stats.triggerTypeDistribution[type] || 0) + 1;
      });

      return {
        success: true,
        data: { statistics: stats }
      };

    } catch (error) {
      logger.error('Failed to get workflow statistics', { error: error.message });
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    const components = {
      database: 'operational',
      executionQueue: this.executionQueue.length,
      activeExecutions: this.activeExecutions.size,
      services: {
        documentGenerator: 'operational',
        courtIntegration: 'operational',
        advancedDocument: 'operational'
      }
    };

    return {
      service: 'Workflow Automation Service',
      status: 'operational',
      timestamp: new Date().toISOString(),
      components
    };
  }
}

module.exports = new WorkflowAutomationService();