// Document Routes - Phase 5.1 API Endpoints
const express = require('express');
const DocumentController = require('../controllers/DocumentController');
const { requireAuth } = require('../lib/authMiddleware');
const validate = require('../middleware/validate');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation schemas
const generateDocumentValidation = [
  body('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format'),
  body('templateId')
    .notEmpty()
    .withMessage('Template ID is required')
    .isUUID()
    .withMessage('Invalid template ID format'),
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  body('outputFormat')
    .optional()
    .isIn(['pdf', 'docx', 'html'])
    .withMessage('Output format must be pdf, docx, or html'),
  body('generateAI')
    .optional()
    .isBoolean()
    .withMessage('generateAI must be a boolean')
];

const regenerateDocumentValidation = [
  param('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .isUUID()
    .withMessage('Invalid document ID format'),
  body('variables')
    .optional()
    .isObject()
    .withMessage('Variables must be an object'),
  body('outputFormat')
    .optional()
    .isIn(['pdf', 'docx', 'html'])
    .withMessage('Output format must be pdf, docx, or html'),
  body('generateAI')
    .optional()
    .isBoolean()
    .withMessage('generateAI must be a boolean')
];

const templateListValidation = [
  query('type')
    .optional()
    .isString()
    .withMessage('Type must be a string'),
  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  query('jurisdiction')
    .optional()
    .isString()
    .withMessage('Jurisdiction must be a string')
];

const documentHistoryValidation = [
  param('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const statisticsValidation = [
  query('caseId')
    .optional()
    .isUUID()
    .withMessage('Invalid case ID format'),
  query('timeframe')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Timeframe must be 7d, 30d, 90d, or 1y')
];

const uuidValidation = [
  param('templateId')
    .notEmpty()
    .withMessage('Template ID is required')
    .isUUID()
    .withMessage('Invalid template ID format')
];

const documentIdValidation = [
  param('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .isUUID()
    .withMessage('Invalid document ID format')
];

// Routes

/**
 * @swagger
 * /api/documents/generate:
 *   post:
 *     summary: Generate a new legal document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caseId
 *               - templateId
 *             properties:
 *               caseId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the case
 *               templateId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the document template
 *               variables:
 *                 type: object
 *                 description: Variables to populate the template
 *               outputFormat:
 *                 type: string
 *                 enum: [pdf, docx, html]
 *                 default: pdf
 *                 description: Output format for the document
 *               generateAI:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to use AI to enhance the document content
 *     responses:
 *       201:
 *         description: Document generated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Case or template not found
 *       500:
 *         description: Internal server error
 */
router.post('/generate', generateDocumentValidation, validate, DocumentController.generateDocument);

/**
 * @swagger
 * /api/documents/templates:
 *   get:
 *     summary: List available document templates
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by document type
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: jurisdiction
 *         schema:
 *           type: string
 *         description: Filter by jurisdiction
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/templates', templateListValidation, validate, DocumentController.listTemplates);

/**
 * @swagger
 * /api/documents/templates/{templateId}:
 *   get:
 *     summary: Get template details
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *       404:
 *         description: Template not found
 *       500:
 *         description: Internal server error
 */
router.get('/templates/:templateId', uuidValidation, validate, DocumentController.getTemplate);

/**
 * @swagger
 * /api/documents/case/{caseId}/history:
 *   get:
 *     summary: Get document history for a case
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Case ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of documents to return
 *     responses:
 *       200:
 *         description: Document history retrieved successfully
 *       404:
 *         description: Case not found
 *       500:
 *         description: Internal server error
 */
router.get('/case/:caseId/history', documentHistoryValidation, validate, DocumentController.getDocumentHistory);

/**
 * @swagger
 * /api/documents/{documentId}:
 *   get:
 *     summary: Get specific generated document details
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
router.get('/:documentId', documentIdValidation, validate, DocumentController.getDocument);

/**
 * @swagger
 * /api/documents/{documentId}/download:
 *   get:
 *     summary: Download generated document file
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
 *             schema:
 *               type: string
 *               format: binary
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
router.get('/:documentId/download', documentIdValidation, validate, DocumentController.downloadDocument);

/**
 * @swagger
 * /api/documents/{documentId}/preview:
 *   get:
 *     summary: Preview document content in HTML format
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document preview rendered successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
router.get('/:documentId/preview', documentIdValidation, validate, DocumentController.previewDocument);

/**
 * @swagger
 * /api/documents/{documentId}/regenerate:
 *   post:
 *     summary: Regenerate document with new parameters
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Original document ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variables:
 *                 type: object
 *                 description: New or updated variables
 *               outputFormat:
 *                 type: string
 *                 enum: [pdf, docx, html]
 *                 description: Output format for regenerated document
 *               generateAI:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to use AI enhancement
 *     responses:
 *       201:
 *         description: Document regenerated successfully
 *       404:
 *         description: Original document not found
 *       500:
 *         description: Internal server error
 */
router.post('/:documentId/regenerate', regenerateDocumentValidation, validate, DocumentController.regenerateDocument);

/**
 * @swagger
 * /api/documents/{documentId}:
 *   delete:
 *     summary: Delete generated document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID to delete
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       403:
 *         description: Not authorized to delete this document
 *       404:
 *         description: Document not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:documentId', documentIdValidation, validate, DocumentController.deleteDocument);

/**
 * @swagger
 * /api/documents/statistics:
 *   get:
 *     summary: Get document generation statistics
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: caseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific case
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/statistics', statisticsValidation, validate, DocumentController.getStatistics);

/**
 * @swagger
 * /api/documents/health:
 *   get:
 *     summary: Document service health check
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/health', DocumentController.healthCheck);

module.exports = router;