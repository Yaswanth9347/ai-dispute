// AI Routes - RESTful API routes for AI analysis features
const express = require('express');
const router = express.Router();
const AIController = require('../controllers/AIController');
const AIConversationController = require('../controllers/AIConversationController');
const { requireAuth } = require('../lib/authMiddleware');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');

// Apply authentication middleware to all AI routes
router.use(requireAuth);

// Validation schemas
const caseIdValidation = [
  param('caseId')
    .isUUID()
    .withMessage('Invalid case ID format')
];

const evidenceIdValidation = [
  param('evidenceId')
    .isUUID()
    .withMessage('Invalid evidence ID format')
];

const analysisIdValidation = [
  param('analysisId')
    .isUUID()
    .withMessage('Invalid analysis ID format')
];

const bulkAnalyzeValidation = [
  body('case_ids')
    .isArray({ min: 1, max: 10 })
    .withMessage('case_ids must be an array with 1-10 items'),
  body('case_ids.*')
    .isUUID()
    .withMessage('Each case ID must be a valid UUID'),
  body('analysis_types')
    .isArray({ min: 1 })
    .withMessage('analysis_types must be an array with at least 1 item'),
  body('analysis_types.*')
    .isIn(['case_analysis', 'risk_assessment', 'legal_research'])
    .withMessage('Invalid analysis type')
];

const settlementPreferencesValidation = [
  body('preferences')
    .optional()
    .isObject()
    .withMessage('preferences must be an object'),
  body('preferences.risk_tolerance')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('risk_tolerance must be low, medium, or high'),
  body('preferences.timeline')
    .optional()
    .isIn(['urgent', 'normal', 'flexible'])
    .withMessage('timeline must be urgent, normal, or flexible'),
  body('preferences.settlement_preference')
    .optional()
    .isIn(['conservative', 'balanced', 'aggressive'])
    .withMessage('settlement_preference must be conservative, balanced, or aggressive')
];

const legalResearchValidation = [
  body('research_query')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('research_query must be a string with max 500 characters')
];

// Route definitions with OpenAPI-style documentation

/**
 * @swagger
 * /api/ai/analyze-case/{caseId}:
 *   post:
 *     summary: Analyze a case using AI
 *     description: Generate comprehensive AI analysis of a legal case including summary, legal issues, strength assessment, and recommendations
 *     tags: [AI Analysis]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique case identifier
 *     responses:
 *       200:
 *         description: Analysis completed successfully
 *       400:
 *         description: Invalid case ID
 *       403:
 *         description: Access denied to case
 *       500:
 *         description: Analysis failed
 */
router.post('/analyze-case/:caseId', 
  caseIdValidation,
  validate,
  AIController.analyzeCase);

/**
 * @swagger
 * /api/ai/settlement-proposals/{caseId}:
 *   post:
 *     summary: Generate AI settlement proposals
 *     description: Create multiple settlement proposal options using AI analysis
 *     tags: [AI Analysis]
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
 *               preferences:
 *                 type: object
 *                 properties:
 *                   risk_tolerance:
 *                     type: string
 *                     enum: [low, medium, high]
 *                   timeline:
 *                     type: string
 *                     enum: [urgent, normal, flexible]
 *                   settlement_preference:
 *                     type: string
 *                     enum: [conservative, balanced, aggressive]
 *     responses:
 *       200:
 *         description: Settlement proposals generated successfully
 */
router.post('/settlement-proposals/:caseId', 
  caseIdValidation,
  settlementPreferencesValidation,
  validate,
  AIController.generateSettlementProposals);

/**
 * @swagger
 * /api/ai/analyze-evidence/{evidenceId}:
 *   post:
 *     summary: Analyze evidence using AI
 *     description: Generate AI analysis of evidence including content summary, relevance, and legal significance
 *     tags: [AI Analysis]
 *     parameters:
 *       - in: path
 *         name: evidenceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Evidence analysis completed successfully
 */
router.post('/analyze-evidence/:evidenceId', 
  evidenceIdValidation,
  validate,
  AIController.analyzeEvidence);

/**
 * @swagger
 * /api/ai/legal-research/{caseId}:
 *   post:
 *     summary: Conduct AI legal research
 *     description: Perform legal research using AI including applicable laws, precedents, and strategic considerations
 *     tags: [AI Analysis]
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
 *               research_query:
 *                 type: string
 *                 maxLength: 500
 *                 description: Specific legal research query
 *     responses:
 *       200:
 *         description: Legal research completed successfully
 */
router.post('/legal-research/:caseId', 
  caseIdValidation,
  legalResearchValidation,
  validate,
  AIController.conductLegalResearch);

/**
 * @swagger
 * /api/ai/risk-assessment/{caseId}:
 *   post:
 *     summary: Conduct AI risk assessment
 *     description: Analyze potential risks and outcomes for all parties in the dispute
 *     tags: [AI Analysis]
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
  AIController.assessRisks);

/**
 * @swagger
 * /api/ai/analyses/{caseId}:
 *   get:
 *     summary: Get all AI analyses for a case
 *     description: Retrieve all completed AI analyses for a specific case
 *     tags: [AI Analysis]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Analyses retrieved successfully
 */
router.get('/analyses/:caseId', 
  caseIdValidation,
  validate,
  AIController.getCaseAnalyses);

/**
 * @swagger
 * /api/ai/analysis/{analysisId}:
 *   get:
 *     summary: Get specific AI analysis by ID
 *     description: Retrieve detailed information about a specific AI analysis
 *     tags: [AI Analysis]
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Analysis retrieved successfully
 *       404:
 *         description: Analysis not found
 */
router.get('/analysis/:analysisId', 
  analysisIdValidation,
  validate,
  AIController.getAnalysisById);

/**
 * @swagger
 * /api/ai/bulk-analyze:
 *   post:
 *     summary: Bulk analyze multiple cases
 *     description: Run multiple types of AI analysis across multiple cases
 *     tags: [AI Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - case_ids
 *               - analysis_types
 *             properties:
 *               case_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 maxItems: 10
 *               analysis_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [case_analysis, risk_assessment, legal_research]
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Bulk analysis completed
 */
router.post('/bulk-analyze', 
  bulkAnalyzeValidation,
  validate,
  AIController.bulkAnalyze);

/**
 * @swagger
 * /api/ai/reanalyze/{analysisId}:
 *   post:
 *     summary: Re-run an existing analysis
 *     description: Re-execute a previous AI analysis with current data
 *     tags: [AI Analysis]
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Re-analysis completed successfully
 *       404:
 *         description: Original analysis not found
 */
router.post('/reanalyze/:analysisId', 
  analysisIdValidation,
  validate,
  AIController.reAnalyze);

/**
 * @swagger
 * /api/ai/health:
 *   get:
 *     summary: AI service health check
 *     description: Check the operational status of AI analysis services
 *     tags: [System]
 *     responses:
 *       200:
 *         description: AI service is operational
 *       503:
 *         description: AI service is degraded or unavailable
 */
router.get('/health', AIController.healthCheck);

// ========== AI Conversation & File Upload Routes ==========

/**
 * @swagger
 * /api/ai/conversation-history/{caseId}:
 *   get:
 *     summary: Get AI conversation history for a case
 *     description: Retrieve all chat messages between user and AI for a specific case
 *     tags: [AI Conversation]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation history retrieved successfully
 */
router.get('/conversation-history/:caseId', AIConversationController.getConversationHistory);

/**
 * @swagger
 * /api/ai/conversation-history:
 *   post:
 *     summary: Save a conversation message
 *     description: Save a user or assistant message to the conversation history
 *     tags: [AI Conversation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caseId
 *               - message
 *               - role
 *             properties:
 *               caseId:
 *                 type: string
 *                 format: uuid
 *               message:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, assistant]
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Message saved successfully
 */
router.post('/conversation-history', AIConversationController.saveConversationMessage);

/**
 * @swagger
 * /api/ai/upload-files:
 *   post:
 *     summary: Upload and analyze files
 *     description: Upload PDF, images, or documents and get AI analysis of content
 *     tags: [AI Conversation]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               caseId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Files uploaded and analyzed successfully
 */
router.post('/upload-files', 
  AIConversationController.upload.array('files', 5), 
  AIConversationController.uploadFiles
);

// Export router
module.exports = router;