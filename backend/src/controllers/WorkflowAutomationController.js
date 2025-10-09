// Phase 5.4 - Workflow Automation Controller
// API controller for workflow automation and integration features

const WorkflowAutomationService = require('../services/WorkflowAutomationService');
const asyncHandler = require('../lib/asyncHandler');
const { z } = require('zod');

class WorkflowAutomationController {
  constructor() {
    this.workflowService = WorkflowAutomationService;
  }

  // Create workflow automation
  createAutomation = asyncHandler(async (req, res) => {
    const createAutomationSchema = z.object({
      name: z.string().min(1, 'Name is required').max(255),
      description: z.string().optional(),
      triggerType: z.enum([
        'document_generated',
        'case_status_change', 
        'approval_completed',
        'time_based',
        'court_filing_complete',
        'collaboration_started'
      ]),
      triggerConditions: z.object({}).passthrough(),
      actions: z.array(z.object({
        type: z.string(),
        config: z.object({}).passthrough(),
        stopOnError: z.boolean().optional().default(true)
      })).min(1, 'At least one action is required'),
      settings: z.object({}).passthrough().optional().default({})
    });

    const validatedData = createAutomationSchema.parse(req.body);

    const result = await this.workflowService.createWorkflowAutomation(
      validatedData, 
      req.user.id
    );

    res.status(201).json(result);
  });

  // Get user's workflow automations
  getAutomations = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, triggerType } = req.query;
    
    let query = req.supabase
      .from('workflow_automations')
      .select(`
        *,
        workflow_executions!inner(
          id,
          status,
          started_at,
          completed_at,
          duration_ms
        )
      `)
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (triggerType) {
      query = query.eq('trigger_type', triggerType);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: automations, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch automations: ${error.message}`);
    }

    res.json({
      success: true,
      data: {
        automations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  });

  // Get specific automation
  getAutomation = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: automation, error } = await req.supabase
      .from('workflow_automations')
      .select(`
        *,
        workflow_executions(
          id,
          status,
          started_at,
          completed_at,
          duration_ms,
          actions_completed,
          actions_total,
          trigger_data,
          results,
          error_details
        )
      `)
      .eq('id', id)
      .eq('created_by', req.user.id)
      .single();

    if (error || !automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    // Sort executions by most recent first
    if (automation.workflow_executions) {
      automation.workflow_executions.sort((a, b) => 
        new Date(b.started_at) - new Date(a.started_at)
      );
    }

    res.json({
      success: true,
      data: { automation }
    });
  });

  // Update automation
  updateAutomation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const updateAutomationSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      triggerConditions: z.object({}).passthrough().optional(),
      actions: z.array(z.object({
        type: z.string(),
        config: z.object({}).passthrough(),
        stopOnError: z.boolean().optional()
      })).optional(),
      settings: z.object({}).passthrough().optional(),
      status: z.enum(['active', 'inactive']).optional()
    });

    const validatedData = updateAutomationSchema.parse(req.body);

    const { data: automation, error } = await req.supabase
      .from('workflow_automations')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('created_by', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: { automation }
    });
  });

  // Delete automation
  deleteAutomation = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await req.supabase
      .from('workflow_automations')
      .delete()
      .eq('id', id)
      .eq('created_by', req.user.id);

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Automation not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: 'Automation deleted successfully'
    });
  });

  // Execute automation manually
  executeAutomation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { triggerData = {} } = req.body;

    // Verify ownership
    const { data: automation, error: fetchError } = await req.supabase
      .from('workflow_automations')
      .select('id, name, status')
      .eq('id', id)
      .eq('created_by', req.user.id)
      .single();

    if (fetchError || !automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    if (automation.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot execute inactive automation'
      });
    }

    const result = await this.workflowService.executeWorkflowAutomation(
      id, 
      triggerData
    );

    res.json(result);
  });

  // Get execution details
  getExecution = asyncHandler(async (req, res) => {
    const { executionId } = req.params;

    const { data: execution, error } = await req.supabase
      .from('workflow_executions')
      .select(`
        *,
        workflow_automations!inner(
          id,
          name,
          created_by
        )
      `)
      .eq('id', executionId)
      .single();

    if (error || !execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    // Check if user owns the automation
    if (execution.workflow_automations.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { execution }
    });
  });

  // Cancel execution
  cancelExecution = asyncHandler(async (req, res) => {
    const { executionId } = req.params;

    // Check ownership through automation
    const { data: execution, error: fetchError } = await req.supabase
      .from('workflow_executions')
      .select(`
        id,
        status,
        workflow_automations!inner(
          created_by
        )
      `)
      .eq('id', executionId)
      .single();

    if (fetchError || !execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    if (execution.workflow_automations.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed execution'
      });
    }

    const { error: updateError } = await req.supabase
      .from('workflow_executions')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });
  });

  // Get workflow statistics
  getWorkflowStatistics = asyncHandler(async (req, res) => {
    const result = await this.workflowService.getWorkflowStatistics(req.user.id);
    res.json(result);
  });

  // Get execution history
  getExecutionHistory = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      automationId,
      dateFrom,
      dateTo 
    } = req.query;

    let query = req.supabase
      .from('workflow_executions')
      .select(`
        *,
        workflow_automations!inner(
          id,
          name,
          created_by
        )
      `)
      .eq('workflow_automations.created_by', req.user.id)
      .order('started_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (automationId) {
      query = query.eq('automation_id', automationId);
    }

    if (dateFrom) {
      query = query.gte('started_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('started_at', dateTo);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: executions, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch execution history: ${error.message}`);
    }

    res.json({
      success: true,
      data: {
        executions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  });

  // Trigger workflow by event
  triggerWorkflow = asyncHandler(async (req, res) => {
    const triggerWorkflowSchema = z.object({
      triggerType: z.string(),
      triggerData: z.object({}).passthrough()
    });

    const { triggerType, triggerData } = triggerWorkflowSchema.parse(req.body);

    const result = await this.workflowService.triggerWorkflow(
      triggerType, 
      triggerData
    );

    res.json(result);
  });

  // Get available trigger types and action types
  getWorkflowSchema = asyncHandler(async (req, res) => {
    const schema = {
      triggerTypes: [
        {
          value: 'document_generated',
          label: 'Document Generated',
          description: 'Triggers when a new document is generated',
          availableFields: ['documentId', 'caseId', 'templateId', 'userId']
        },
        {
          value: 'case_status_change',
          label: 'Case Status Change',
          description: 'Triggers when a case status changes',
          availableFields: ['caseId', 'oldStatus', 'newStatus', 'userId']
        },
        {
          value: 'approval_completed',
          label: 'Approval Completed',
          description: 'Triggers when document approval is completed',
          availableFields: ['documentId', 'approvalId', 'decision', 'approverId']
        },
        {
          value: 'time_based',
          label: 'Time-Based',
          description: 'Triggers at specified times or intervals',
          availableFields: ['schedule', 'timezone']
        },
        {
          value: 'court_filing_complete',
          label: 'Court Filing Complete',
          description: 'Triggers when court filing is processed',
          availableFields: ['filingId', 'caseId', 'status', 'confirmationNumber']
        },
        {
          value: 'collaboration_started',
          label: 'Collaboration Started',
          description: 'Triggers when document collaboration begins',
          availableFields: ['collaborationId', 'documentId', 'participants']
        }
      ],
      
      actionTypes: [
        {
          value: 'generate_document',
          label: 'Generate Document',
          description: 'Create a new document from template',
          requiredConfig: ['templateId'],
          optionalConfig: ['caseId', 'variables', 'outputFormat', 'generateAI']
        },
        {
          value: 'file_to_court',
          label: 'File to Court',
          description: 'Submit documents to court system',
          requiredConfig: ['courtSystemId', 'filingType'],
          optionalConfig: ['documentIds', 'expedited', 'serviceMethod']
        },
        {
          value: 'send_notification',
          label: 'Send Notification',
          description: 'Send email or other notifications',
          requiredConfig: ['recipients', 'subject', 'template'],
          optionalConfig: ['channels']
        },
        {
          value: 'create_collaboration',
          label: 'Create Collaboration',
          description: 'Start document collaboration session',
          requiredConfig: ['participants'],
          optionalConfig: ['documentId', 'type', 'permissions', 'settings']
        },
        {
          value: 'submit_for_approval',
          label: 'Submit for Approval',
          description: 'Submit document for approval workflow',
          requiredConfig: ['approvers'],
          optionalConfig: ['documentId', 'workflowType', 'deadline', 'autoApproveRules']
        },
        {
          value: 'ai_review_document',
          label: 'AI Review Document',
          description: 'Perform AI-powered document review',
          requiredConfig: [],
          optionalConfig: ['documentId', 'reviewType', 'options']
        },
        {
          value: 'update_case_status',
          label: 'Update Case Status',
          description: 'Change case status',
          requiredConfig: ['newStatus'],
          optionalConfig: ['caseId', 'reason']
        },
        {
          value: 'create_calendar_event',
          label: 'Create Calendar Event',
          description: 'Create calendar event',
          requiredConfig: ['title', 'startTime'],
          optionalConfig: ['duration', 'attendees', 'description']
        },
        {
          value: 'send_webhook',
          label: 'Send Webhook',
          description: 'Send HTTP webhook',
          requiredConfig: ['url'],
          optionalConfig: ['method', 'headers', 'payload']
        },
        {
          value: 'conditional_branch',
          label: 'Conditional Branch',
          description: 'Execute different actions based on conditions',
          requiredConfig: ['condition'],
          optionalConfig: ['trueActions', 'falseActions']
        }
      ],

      conditionOperators: [
        'equals', 'not_equals', 'greater_than', 'less_than',
        'contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'
      ]
    };

    res.json({
      success: true,
      data: { schema }
    });
  });

  // Health check
  healthCheck = asyncHandler(async (req, res) => {
    const health = await this.workflowService.healthCheck();
    res.json(health);
  });
}

module.exports = WorkflowAutomationController;