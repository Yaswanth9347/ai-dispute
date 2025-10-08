// Court Integration Routes - Phase 5.2 API Endpoints
const express = require('express');
const CourtController = require('../controllers/CourtController');
const { requireAuth } = require('../lib/authMiddleware');
const validate = require('../middleware/validate');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation schemas
const fileWithCourtValidation = [
  body('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format'),
  body('courtSystemId')
    .notEmpty()
    .withMessage('Court System ID is required')
    .isUUID()
    .withMessage('Invalid court system ID format'),
  body('documentIds')
    .optional()
    .isArray()
    .withMessage('Document IDs must be an array'),
  body('documentIds.*')
    .optional()
    .isUUID()
    .withMessage('Each document ID must be a valid UUID'),
  body('filingType')
    .optional()
    .isIn(['initial_complaint', 'motion', 'response', 'settlement', 'discovery', 'appeal'])
    .withMessage('Invalid filing type'),
  body('expedited')
    .optional()
    .isBoolean()
    .withMessage('Expedited must be a boolean'),
  body('serviceMethod')
    .optional()
    .isIn(['electronic', 'certified_mail', 'personal_service', 'publication'])
    .withMessage('Invalid service method'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const updateFilingStatusValidation = [
  param('filingId')
    .notEmpty()
    .withMessage('Filing ID is required')
    .isUUID()
    .withMessage('Invalid filing ID format'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['submitted', 'accepted', 'rejected', 'processed', 'cancelled'])
    .withMessage('Invalid status'),
  body('courtConfirmationNumber')
    .optional()
    .isString()
    .withMessage('Court confirmation number must be a string'),
  body('caseNumber')
    .optional()
    .isString()
    .withMessage('Case number must be a string'),
  body('courtResponse')
    .optional()
    .isObject()
    .withMessage('Court response must be an object'),
  body('estimatedProcessingTime')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Estimated processing time must be a positive integer'),
  body('nextSteps')
    .optional()
    .isArray()
    .withMessage('Next steps must be an array')
];

const courtSystemListValidation = [
  query('jurisdiction')
    .optional()
    .isString()
    .withMessage('Jurisdiction must be a string'),
  query('type')
    .optional()
    .isString()
    .withMessage('Type must be a string'),
  query('integration_type')
    .optional()
    .isIn(['api', 'efiling', 'email', 'manual'])
    .withMessage('Integration type must be api, efiling, email, or manual')
];

const filingHistoryValidation = [
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

const filingStatisticsValidation = [
  query('courtSystemId')
    .optional()
    .isUUID()
    .withMessage('Invalid court system ID format'),
  query('timeframe')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Timeframe must be 7d, 30d, 90d, or 1y')
];

const uuidValidation = [
  param('courtSystemId')
    .notEmpty()
    .withMessage('Court System ID is required')
    .isUUID()
    .withMessage('Invalid court system ID format')
];

const filingIdValidation = [
  param('filingId')
    .notEmpty()
    .withMessage('Filing ID is required')
    .isUUID()
    .withMessage('Invalid filing ID format')
];

const requiredDocumentsValidation = [
  param('courtSystemId')
    .notEmpty()
    .withMessage('Court System ID is required')
    .isUUID()
    .withMessage('Invalid court system ID format'),
  param('filingType')
    .notEmpty()
    .withMessage('Filing type is required')
    .isIn(['initial_complaint', 'motion', 'response', 'settlement', 'discovery', 'appeal'])
    .withMessage('Invalid filing type')
];

const cancelFilingValidation = [
  param('filingId')
    .notEmpty()
    .withMessage('Filing ID is required')
    .isUUID()
    .withMessage('Invalid filing ID format'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
];

// Routes

/**
 * @swagger
 * /api/court/file:
 *   post:
 *     summary: File case documents with court system
 *     tags: [Court Integration]
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
 *               - courtSystemId
 *             properties:
 *               caseId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the case to file
 *               courtSystemId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the court system
 *               documentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: IDs of documents to include in filing
 *               filingType:
 *                 type: string
 *                 enum: [initial_complaint, motion, response, settlement, discovery, appeal]
 *                 default: initial_complaint
 *                 description: Type of court filing
 *               expedited:
 *                 type: boolean
 *                 default: false
 *                 description: Whether this is an expedited filing
 *               serviceMethod:
 *                 type: string
 *                 enum: [electronic, certified_mail, personal_service, publication]
 *                 default: electronic
 *                 description: Method of service for the filing
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the filing
 *     responses:
 *       201:
 *         description: Court filing submitted successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Case or court system not found
 *       500:
 *         description: Internal server error
 */
router.post('/file', fileWithCourtValidation, validate, CourtController.fileCaseWithCourt);

/**
 * @swagger
 * /api/court/systems:
 *   get:
 *     summary: List available court systems
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: jurisdiction
 *         schema:
 *           type: string
 *         description: Filter by jurisdiction
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by court type
 *       - in: query
 *         name: integration_type
 *         schema:
 *           type: string
 *           enum: [api, efiling, email, manual]
 *         description: Filter by integration type
 *     responses:
 *       200:
 *         description: Court systems retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/systems', courtSystemListValidation, validate, CourtController.listCourtSystems);

/**
 * @swagger
 * /api/court/systems/{courtSystemId}:
 *   get:
 *     summary: Get court system details
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courtSystemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Court System ID
 *     responses:
 *       200:
 *         description: Court system retrieved successfully
 *       404:
 *         description: Court system not found
 *       500:
 *         description: Internal server error
 */
router.get('/systems/:courtSystemId', uuidValidation, validate, CourtController.getCourtSystem);

/**
 * @swagger
 * /api/court/filings/{filingId}/status:
 *   get:
 *     summary: Get filing status
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filing ID
 *     responses:
 *       200:
 *         description: Filing status retrieved successfully
 *       404:
 *         description: Filing not found
 *       500:
 *         description: Internal server error
 */
router.get('/filings/:filingId/status', filingIdValidation, validate, CourtController.getFilingStatus);

/**
 * @swagger
 * /api/court/filings/{filingId}/status:
 *   put:
 *     summary: Update filing status (for court system callbacks)
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [submitted, accepted, rejected, processed, cancelled]
 *                 description: New filing status
 *               courtConfirmationNumber:
 *                 type: string
 *                 description: Court-provided confirmation number
 *               caseNumber:
 *                 type: string
 *                 description: Assigned case number
 *               courtResponse:
 *                 type: object
 *                 description: Response from court system
 *               estimatedProcessingTime:
 *                 type: integer
 *                 description: Estimated processing time in days
 *               nextSteps:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Next steps in the process
 *     responses:
 *       200:
 *         description: Filing status updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Filing not found
 *       500:
 *         description: Internal server error
 */
router.put('/filings/:filingId/status', updateFilingStatusValidation, validate, CourtController.updateFilingStatus);

/**
 * @swagger
 * /api/court/cases/{caseId}/filings:
 *   get:
 *     summary: Get case filing history
 *     tags: [Court Integration]
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
 *         description: Maximum number of filings to return
 *     responses:
 *       200:
 *         description: Filing history retrieved successfully
 *       404:
 *         description: Case not found
 *       500:
 *         description: Internal server error
 */
router.get('/cases/:caseId/filings', filingHistoryValidation, validate, CourtController.getCaseFilingHistory);

/**
 * @swagger
 * /api/court/filings/{filingId}/cancel:
 *   post:
 *     summary: Cancel court filing
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filing ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Filing cancelled successfully
 *       400:
 *         description: Cannot cancel processed filing
 *       404:
 *         description: Filing not found
 *       500:
 *         description: Internal server error
 */
router.post('/filings/:filingId/cancel', cancelFilingValidation, validate, CourtController.cancelFiling);

/**
 * @swagger
 * /api/court/systems/{courtSystemId}/filings/{filingType}/requirements:
 *   get:
 *     summary: Get required documents for filing type
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courtSystemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Court System ID
 *       - in: path
 *         name: filingType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [initial_complaint, motion, response, settlement, discovery, appeal]
 *         description: Filing type
 *     responses:
 *       200:
 *         description: Required documents retrieved successfully
 *       404:
 *         description: Court system not found
 *       500:
 *         description: Internal server error
 */
router.get('/systems/:courtSystemId/filings/:filingType/requirements', requiredDocumentsValidation, validate, CourtController.getRequiredDocuments);

/**
 * @swagger
 * /api/court/filings/{filingId}/download:
 *   get:
 *     summary: Download filing package
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filing ID
 *     responses:
 *       200:
 *         description: Filing package downloaded successfully
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Filing or package not found
 *       500:
 *         description: Internal server error
 */
router.get('/filings/:filingId/download', filingIdValidation, validate, CourtController.downloadFilingPackage);

/**
 * @swagger
 * /api/court/statistics:
 *   get:
 *     summary: Get filing statistics
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courtSystemId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific court system
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
router.get('/statistics', filingStatisticsValidation, validate, CourtController.getFilingStatistics);

/**
 * @swagger
 * /api/court/health:
 *   get:
 *     summary: Court integration service health check
 *     tags: [Court Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/health', CourtController.healthCheck);

module.exports = router;