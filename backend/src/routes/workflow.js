// Phase 5.4 - Workflow Automation Routes
// RESTful API routes for workflow automation and integration

const express = require('express');
const router = express.Router();
const WorkflowAutomationController = require('../controllers/WorkflowAutomationController');
const { requireAuth } = require('../lib/authMiddleware');
const { z } = require('zod');

const workflowController = new WorkflowAutomationController();

/**
 * @swagger
 * components:
 *   schemas:
 *     WorkflowAutomation:
 *       type: object
 *       required:
 *         - name
 *         - triggerType
 *         - actions
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           maxLength: 255
 *         description:
 *           type: string
 *         triggerType:
 *           type: string
 *           enum: [document_generated, case_status_change, approval_completed, time_based, court_filing_complete, collaboration_started]
 *         triggerConditions:
 *           type: object
 *         actions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               config:
 *                 type: object
 *               stopOnError:
 *                 type: boolean
 *         settings:
 *           type: object
 *         status:
 *           type: string
 *           enum: [active, inactive, error]
 *         executionCount:
 *           type: integer
 *         successRate:
 *           type: number
 *           format: float
 *         createdBy:
 *           type: string
 *           format: uuid
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     WorkflowExecution:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         automationId:
 *           type: string
 *           format: uuid
 *         triggerData:
 *           type: object
 *         status:
 *           type: string
 *           enum: [pending, running, completed, failed, cancelled]
 *         startedAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         durationMs:
 *           type: integer
 *         actionsCompleted:
 *           type: integer
 *         actionsTotal:
 *           type: integer
 *         executionLog:
 *           type: array
 *         results:
 *           type: object
 *         errorDetails:
 *           type: object
 *
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Input validation middleware
const validateCreateAutomation = (req, res, next) => {
  const schema = z.object({
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

  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      issues: error.errors
    });
  }
};

const validateExecuteAutomation = (req, res, next) => {
  const schema = z.object({
    triggerData: z.object({}).passthrough().optional().default({})
  });

  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      issues: error.errors
    });
  }
};

const validateTriggerWorkflow = (req, res, next) => {
  const schema = z.object({
    triggerType: z.string().min(1, 'Trigger type is required'),
    triggerData: z.object({}).passthrough()
  });

  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      issues: error.errors
    });
  }
};

/**
 * @swagger
 * /api/workflow/health:
 *   get:
 *     summary: Check workflow automation service health
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 components:
 *                   type: object
 */
router.get('/health', requireAuth, workflowController.healthCheck);

/**
 * @swagger
 * /api/workflow/schema:
 *   get:
 *     summary: Get workflow automation schema
 *     description: Returns available trigger types, action types, and configuration options
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow automation schema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     schema:
 *                       type: object
 */
router.get('/schema', requireAuth, workflowController.getWorkflowSchema);

/**
 * @swagger
 * /api/workflow/automations:
 *   post:
 *     summary: Create workflow automation
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - triggerType
 *               - actions
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               triggerType:
 *                 type: string
 *                 enum: [document_generated, case_status_change, approval_completed, time_based, court_filing_complete, collaboration_started]
 *               triggerConditions:
 *                 type: object
 *               actions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                     config:
 *                       type: object
 *                     stopOnError:
 *                       type: boolean
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Automation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     automation:
 *                       $ref: '#/components/schemas/WorkflowAutomation'
 *       400:
 *         description: Validation error
 */
router.post('/automations', requireAuth, validateCreateAutomation, workflowController.createAutomation);

/**
 * @swagger
 * /api/workflow/automations:
 *   get:
 *     summary: Get user's workflow automations
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, error]
 *       - in: query
 *         name: triggerType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of workflow automations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     automations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WorkflowAutomation'
 *                     pagination:
 *                       type: object
 */
router.get('/automations', requireAuth, workflowController.getAutomations);

/**
 * @swagger
 * /api/workflow/automations/{id}:
 *   get:
 *     summary: Get specific workflow automation
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Workflow automation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     automation:
 *                       $ref: '#/components/schemas/WorkflowAutomation'
 *       404:
 *         description: Automation not found
 */
router.get('/automations/:id', requireAuth, workflowController.getAutomation);

/**
 * @swagger
 * /api/workflow/automations/{id}:
 *   put:
 *     summary: Update workflow automation
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               triggerConditions:
 *                 type: object
 *               actions:
 *                 type: array
 *               settings:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Automation updated successfully
 *       404:
 *         description: Automation not found
 */
router.put('/automations/:id', requireAuth, workflowController.updateAutomation);

/**
 * @swagger
 * /api/workflow/automations/{id}:
 *   delete:
 *     summary: Delete workflow automation
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Automation deleted successfully
 *       404:
 *         description: Automation not found
 */
router.delete('/automations/:id', requireAuth, workflowController.deleteAutomation);

/**
 * @swagger
 * /api/workflow/automations/{id}/execute:
 *   post:
 *     summary: Execute workflow automation manually
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               triggerData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Automation execution started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     executionId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *       404:
 *         description: Automation not found
 *       400:
 *         description: Cannot execute inactive automation
 */
router.post('/automations/:id/execute', requireAuth, validateExecuteAutomation, workflowController.executeAutomation);

/**
 * @swagger
 * /api/workflow/executions/{executionId}:
 *   get:
 *     summary: Get workflow execution details
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Execution details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     execution:
 *                       $ref: '#/components/schemas/WorkflowExecution'
 *       404:
 *         description: Execution not found
 */
router.get('/executions/:executionId', requireAuth, workflowController.getExecution);

/**
 * @swagger
 * /api/workflow/executions/{executionId}/cancel:
 *   post:
 *     summary: Cancel workflow execution
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Execution cancelled successfully
 *       404:
 *         description: Execution not found
 *       400:
 *         description: Cannot cancel completed execution
 */
router.post('/executions/:executionId/cancel', requireAuth, workflowController.cancelExecution);

/**
 * @swagger
 * /api/workflow/executions:
 *   get:
 *     summary: Get workflow execution history
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed, cancelled]
 *       - in: query
 *         name: automationId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Execution history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     executions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WorkflowExecution'
 *                     pagination:
 *                       type: object
 */
router.get('/executions', requireAuth, workflowController.getExecutionHistory);

/**
 * @swagger
 * /api/workflow/statistics:
 *   get:
 *     summary: Get workflow automation statistics
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalAutomations:
 *                           type: integer
 *                         activeAutomations:
 *                           type: integer
 *                         totalExecutions:
 *                           type: integer
 *                         averageSuccessRate:
 *                           type: number
 *                         triggerTypeDistribution:
 *                           type: object
 */
router.get('/statistics', requireAuth, workflowController.getWorkflowStatistics);

/**
 * @swagger
 * /api/workflow/trigger:
 *   post:
 *     summary: Trigger workflows by event
 *     description: Manually trigger workflows that match the specified trigger type and conditions
 *     tags: [Workflow Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - triggerType
 *               - triggerData
 *             properties:
 *               triggerType:
 *                 type: string
 *               triggerData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Workflows triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     triggeredCount:
 *                       type: integer
 *                     executions:
 *                       type: array
 */
router.post('/trigger', requireAuth, validateTriggerWorkflow, workflowController.triggerWorkflow);

// Export router
module.exports = router;