// Advanced AI Routes - Phase 4 API routes for enhanced AI analysis
const express = require('express');
const router = express.Router();
const AdvancedAIController = require('../controllers/AdvancedAIController');
const { requireAuth } = require('../lib/authMiddleware');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');

// Initialize controller
const advancedAIController = new AdvancedAIController();

// =============================================================================
// HEALTH AND STATUS ENDPOINTS (No Auth Required)
// =============================================================================

/**
 * @swagger
 * /api/ai/advanced/health:
 *   get:
 *     summary: Check advanced AI service health
 *     description: Get status of advanced AI services and models
 *     tags: [Advanced AI]
 *     responses:
 *       200:
 *         description: Service health status
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Advanced AI Service',
    version: '4.0.0',
    status: 'operational',
    models: {
      'gemini-2.0-flash-exp': 'available',
      'ensemble-analysis': 'available'
    },
    timestamp: new Date().toISOString()
  });
});

// Apply authentication to all routes
router.use(requireAuth);

// Validation schemas
const caseIdValidation = [
  param('caseId')
    .isUUID()
    .withMessage('Invalid case ID format')
];

const analysisRequestValidation = [
  body('analysisType')
    .optional()
    .isIn(['comprehensive', 'outcome_only', 'risk_only', 'strategy_only'])
    .withMessage('Invalid analysis type'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object')
];

const comparisonValidation = [
  body('analysis_ids')
    .isArray({ min: 2 })
    .withMessage('At least 2 analysis IDs required'),
  body('analysis_ids.*')
    .isUUID()
    .withMessage('Invalid analysis ID format'),
  body('comparison_criteria')
    .optional()
    .isArray()
    .withMessage('Comparison criteria must be an array')
];

// =============================================================================
// COMPREHENSIVE ANALYSIS ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/ai/advanced/analyze/{caseId}:
 *   post:
 *     summary: Perform comprehensive advanced AI analysis
 *     description: Execute multi-model AI analysis including outcome prediction, precedent matching, risk assessment, and strategy recommendation
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               analysisType:
 *                 type: string
 *                 enum: [comprehensive, outcome_only, risk_only, strategy_only]
 *                 default: comprehensive
 *               options:
 *                 type: object
 *                 properties:
 *                   includeHistorical:
 *                     type: boolean
 *                   confidenceThreshold:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *     responses:
 *       200:
 *         description: Advanced analysis completed successfully
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
 *                     analysis_id:
 *                       type: string
 *                     analysis_summary:
 *                       type: object
 *                     detailed_analysis:
 *                       type: object
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Access denied to case
 *       500:
 *         description: Analysis failed
 */
router.post('/analyze/:caseId',
  caseIdValidation,
  analysisRequestValidation,
  validate,
  advancedAIController.performAdvancedAnalysis
);

// =============================================================================
// INDIVIDUAL ANALYSIS ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/ai/advanced/predict-outcome/{caseId}:
 *   post:
 *     summary: Predict case outcome using AI
 *     description: Generate AI-powered prediction of case outcome with confidence scores
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Outcome prediction generated successfully
 */
router.post('/predict-outcome/:caseId',
  caseIdValidation,
  validate,
  advancedAIController.predictCaseOutcome
);

/**
 * @swagger
 * /api/ai/advanced/precedents/{caseId}:
 *   post:
 *     summary: Find relevant legal precedents
 *     description: Search for and analyze relevant legal precedents for the case
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Legal precedents found and analyzed
 */
router.post('/precedents/:caseId',
  caseIdValidation,
  validate,
  advancedAIController.findLegalPrecedents
);

/**
 * @swagger
 * /api/ai/advanced/risk-assessment/{caseId}:
 *   post:
 *     summary: Assess dispute risks
 *     description: Analyze financial, legal, and procedural risks associated with the case
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Risk assessment completed successfully
 */
router.post('/risk-assessment/:caseId',
  caseIdValidation,
  validate,
  advancedAIController.assessDisputeRisk
);

/**
 * @swagger
 * /api/ai/advanced/strategy/{caseId}:
 *   post:
 *     summary: Generate legal strategy
 *     description: Create AI-powered legal strategy recommendations for the case
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Legal strategy generated successfully
 */
router.post('/strategy/:caseId',
  caseIdValidation,
  validate,
  advancedAIController.generateLegalStrategy
);

// =============================================================================
// INSIGHTS AND ANALYTICS ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/ai/advanced/insights/{caseType}/{jurisdiction}:
 *   get:
 *     summary: Get historical case insights
 *     description: Retrieve insights and statistics from historical cases of similar type and jurisdiction
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: path
 *         name: caseType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: jurisdiction
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: include_details
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Historical insights retrieved successfully
 */
router.get('/insights/:caseType/:jurisdiction',
  [
    param('caseType').isString().withMessage('Case type is required'),
    param('jurisdiction').isString().withMessage('Jurisdiction is required'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('include_details').optional().isBoolean().withMessage('Include details must be boolean')
  ],
  validate,
  advancedAIController.getHistoricalInsights
);

/**
 * @swagger
 * /api/ai/advanced/history/{caseId}:
 *   get:
 *     summary: Get analysis history for a case
 *     description: Retrieve historical AI analyses performed on a specific case
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: analysis_type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis history retrieved successfully
 */
router.get('/history/:caseId',
  [
    ...caseIdValidation,
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('analysis_type').optional().isString().withMessage('Analysis type must be string')
  ],
  validate,
  advancedAIController.getAnalysisHistory
);

/**
 * @swagger
 * /api/ai/advanced/compare:
 *   post:
 *     summary: Compare multiple analysis results
 *     description: Compare and analyze differences between multiple AI analyses
 *     tags: [Advanced AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - analysis_ids
 *             properties:
 *               analysis_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 2
 *               comparison_criteria:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Analysis comparison completed successfully
 */
router.post('/compare',
  comparisonValidation,
  validate,
  advancedAIController.compareAnalyses
);

/**
 * @swagger
 * /api/ai/advanced/statistics:
 *   get:
 *     summary: Get AI analysis statistics
 *     description: Retrieve statistics and trends from AI analyses
 *     tags: [Advanced AI]
 *     parameters:
 *       - in: query
 *         name: time_period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *       - in: query
 *         name: case_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: jurisdiction
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/statistics',
  [
    query('time_period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid time period'),
    query('case_type').optional().isString().withMessage('Case type must be string'),
    query('jurisdiction').optional().isString().withMessage('Jurisdiction must be string')
  ],
  validate,
  advancedAIController.getAnalysisStatistics
);

// =============================================================================
// BATCH PROCESSING ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/ai/advanced/batch/analyze:
 *   post:
 *     summary: Batch process multiple cases
 *     description: Process multiple cases for AI analysis in batch
 *     tags: [Advanced AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - case_ids
 *             properties:
 *               case_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 maxItems: 10
 *               analysis_type:
 *                 type: string
 *                 enum: [comprehensive, outcome_only, risk_only, strategy_only]
 *                 default: comprehensive
 *     responses:
 *       202:
 *         description: Batch analysis started successfully
 *       400:
 *         description: Invalid batch request
 */
router.post('/batch/analyze',
  [
    body('case_ids')
      .isArray({ min: 1, max: 10 })
      .withMessage('Case IDs array required (max 10 cases)'),
    body('case_ids.*')
      .isUUID()
      .withMessage('Invalid case ID format'),
    body('analysis_type')
      .optional()
      .isIn(['comprehensive', 'outcome_only', 'risk_only', 'strategy_only'])
      .withMessage('Invalid analysis type')
  ],
  validate,
  async (req, res) => {
    // Placeholder for batch processing endpoint
    res.status(202).json({
      success: true,
      message: 'Batch analysis started',
      batch_id: 'batch_' + Date.now(),
      case_count: req.body.case_ids.length
    });
  }
);

// =============================================================================
// BATCH PROCESSING ENDPOINT IMPLEMENTATIONS ABOVE
// =============================================================================

module.exports = router;