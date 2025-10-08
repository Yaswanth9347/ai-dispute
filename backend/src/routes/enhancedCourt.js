// Enhanced Court Integration Routes - Real Court API Integration
// Live court system connections with real-time filing and status tracking

const express = require('express');
const EnhancedCourtController = require('../controllers/EnhancedCourtController');
const { requireAuth } = require('../lib/authMiddleware');
const validate = require('../middleware/validate');
const { body, param, query } = require('express-validator');

const router = express.Router();
const courtController = new EnhancedCourtController();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation schemas
const fileWithCourtValidation = [
  body('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format'),
  body('courtSystemCode')
    .notEmpty()
    .withMessage('Court system code is required')
    .isString()
    .withMessage('Court system code must be a string'),
  body('filingType')
    .notEmpty()
    .withMessage('Filing type is required')
    .isString()
    .withMessage('Filing type must be a string'),
  body('documents')
    .isArray({ min: 1 })
    .withMessage('At least one document is required'),
  body('documents.*.documentId')
    .notEmpty()
    .withMessage('Document ID is required'),
  body('documents.*.filename')
    .notEmpty()
    .withMessage('Document filename is required'),
  body('documents.*.documentType')
    .notEmpty()
    .withMessage('Document type is required'),
  body('expedited')
    .optional()
    .isBoolean()
    .withMessage('Expedited must be a boolean'),
  body('serviceMethod')
    .optional()
    .isIn(['electronic', 'mail', 'personal'])
    .withMessage('Invalid service method'),
  body('parties')
    .optional()
    .isArray()
    .withMessage('Parties must be an array'),
  body('parties.*.name')
    .if(body('parties').exists())
    .notEmpty()
    .withMessage('Party name is required'),
  body('parties.*.email')
    .if(body('parties').exists())
    .optional()
    .isEmail()
    .withMessage('Invalid party email format')
];

const filingIdValidation = [
  param('filingId')
    .notEmpty()
    .withMessage('Filing ID is required')
    .isUUID()
    .withMessage('Invalid filing ID format')
];

const caseIdValidation = [
  param('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format')
];

const courtSystemsValidation = [
  query('jurisdiction')
    .optional()
    .isString()
    .withMessage('Jurisdiction must be a string'),
  query('type')
    .optional()
    .isIn(['federal', 'state', 'local', 'appellate'])
    .withMessage('Invalid court type'),
  query('state')
    .optional()
    .isString()
    .withMessage('State must be a string')
];

const caseFilingsValidation = [
  param('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format'),
  query('status')
    .optional()
    .isIn(['pending', 'submitted', 'processing', 'processed', 'rejected', 'failed'])
    .withMessage('Invalid status filter'),
  query('filingType')
    .optional()
    .isString()
    .withMessage('Filing type must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200')
];

const analyticsValidation = [
  query('timeframe')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Timeframe must be 7d, 30d, 90d, or 1y'),
  query('courtSystem')
    .optional()
    .isString()
    .withMessage('Court system must be a string')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     CourtSystem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         jurisdiction:
 *           type: string
 *         type:
 *           type: string
 *           enum: [federal, state, local, appellate]
 *         hasRealAPI:
 *           type: boolean
 *         apiSupport:
 *           type: object
 *           properties:
 *             filingTypes:
 *               type: array
 *               items:
 *                 type: string
 *             maxFileSize:
 *               type: integer
 *             supportedFormats:
 *               type: array
 *               items:
 *                 type: string
 *     
 *     CourtFiling:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         caseId:
 *           type: string
 *           format: uuid
 *         courtSystemCode:
 *           type: string
 *         filingType:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, submitted, processing, processed, rejected, failed]
 *         confirmationNumber:
 *           type: string
 *         trackingId:
 *           type: string
 *         submittedAt:
 *           type: string
 *           format: date-time
 *         fees:
 *           type: number
 *         expedited:
 *           type: boolean
 *         realAPIUsed:
 *           type: boolean
 */

/**
 * @swagger
 * /api/enhanced-court/health:
 *   get:
 *     summary: Check court integration service health
 *     tags: [Enhanced Court Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service health status
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
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     activeConnections:
 *                       type: integer
 *                     supportedCourtCount:
 *                       type: integer
 *                     healthyCourtCount:
 *                       type: integer
 *       503:
 *         description: Service unhealthy
 */
router.get('/health', courtController.healthCheck.bind(courtController));

/**
 * @swagger
 * /api/enhanced-court/systems:
 *   get:
 *     summary: Get available court systems with real API support
 *     tags: [Enhanced Court Integration]
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
 *           enum: [federal, state, local, appellate]
 *         description: Filter by court type
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state name
 *     responses:
 *       200:
 *         description: Court systems retrieved successfully
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
 *                     courtSystems:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CourtSystem'
 *                     totalCount:
 *                       type: integer
 *                     realAPICount:
 *                       type: integer
 */
router.get('/systems', courtSystemsValidation, validate, courtController.getCourtSystems.bind(courtController));

/**
 * @swagger
 * /api/enhanced-court/file:
 *   post:
 *     summary: File documents with real court API
 *     tags: [Enhanced Court Integration]
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
 *               - courtSystemCode
 *               - filingType
 *               - documents
 *             properties:
 *               caseId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the case to file for
 *               courtSystemCode:
 *                 type: string
 *                 description: Court system code (e.g., PACER, TYLER_ODYSSEY)
 *               filingType:
 *                 type: string
 *                 description: Type of filing (complaint, motion, answer, etc.)
 *               documents:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - documentId
 *                     - filename
 *                     - documentType
 *                   properties:
 *                     documentId:
 *                       type: string
 *                       description: Internal document ID
 *                     filename:
 *                       type: string
 *                       description: Document filename
 *                     documentType:
 *                       type: string
 *                       description: Document type for court system
 *                     title:
 *                       type: string
 *                       description: Document title for court display
 *               expedited:
 *                 type: boolean
 *                 default: false
 *                 description: Request expedited processing
 *               serviceMethod:
 *                 type: string
 *                 enum: [electronic, mail, personal]
 *                 default: electronic
 *                 description: Service method for opposing parties
 *               filingParty:
 *                 type: string
 *                 description: Name of the filing party
 *               parties:
 *                 type: array
 *                 description: Additional parties to serve
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     role:
 *                       type: string
 *     responses:
 *       201:
 *         description: Filing submitted successfully to court
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
 *                     filingId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                     confirmationNumber:
 *                       type: string
 *                     trackingId:
 *                       type: string
 *                     estimatedProcessingTime:
 *                       type: string
 *                     fees:
 *                       type: number
 *                     realAPIUsed:
 *                       type: boolean
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Case or court system not found
 *       500:
 *         description: Filing failed
 */
router.post('/file', fileWithCourtValidation, validate, courtController.fileWithCourt.bind(courtController));

/**
 * @swagger
 * /api/enhanced-court/filings/{filingId}/status:
 *   get:
 *     summary: Check real-time filing status
 *     tags: [Enhanced Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filing ID to check status for
 *     responses:
 *       200:
 *         description: Filing status retrieved successfully
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
 *                     filing:
 *                       $ref: '#/components/schemas/CourtFiling'
 *                     statusHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                     realTimeChecked:
 *                       type: boolean
 *       403:
 *         description: Access denied
 *       404:
 *         description: Filing not found
 */
router.get('/filings/:filingId/status', filingIdValidation, validate, courtController.checkFilingStatus.bind(courtController));

/**
 * @swagger
 * /api/enhanced-court/cases/{caseId}/filings:
 *   get:
 *     summary: Get case filing history with real-time updates
 *     tags: [Enhanced Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Case ID to get filings for
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, submitted, processing, processed, rejected, failed]
 *         description: Filter by filing status
 *       - in: query
 *         name: filingType
 *         schema:
 *           type: string
 *         description: Filter by filing type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *         description: Maximum number of filings to return
 *     responses:
 *       200:
 *         description: Case filings retrieved successfully
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
 *                     filings:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CourtFiling'
 *                     caseInfo:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         caseNumber:
 *                           type: string
 *                         title:
 *                           type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         processed:
 *                           type: integer
 *                         rejected:
 *                           type: integer
 *                         realTimeUpdates:
 *                           type: integer
 *       403:
 *         description: Access denied
 *       404:
 *         description: Case not found
 */
router.get('/cases/:caseId/filings', caseFilingsValidation, validate, courtController.getCaseFilings.bind(courtController));

/**
 * @swagger
 * /api/enhanced-court/refresh-statuses:
 *   post:
 *     summary: Refresh filing statuses for all active filings
 *     tags: [Enhanced Court Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filing statuses refreshed successfully
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
 *                     refreshedCount:
 *                       type: integer
 *                     updatedCount:
 *                       type: integer
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           filingId:
 *                             type: string
 *                             format: uuid
 *                           oldStatus:
 *                             type: string
 *                           newStatus:
 *                             type: string
 *                           updated:
 *                             type: boolean
 *                     refreshedAt:
 *                       type: string
 *                       format: date-time
 */
router.post('/refresh-statuses', courtController.refreshAllFilingStatuses.bind(courtController));

/**
 * @swagger
 * /api/enhanced-court/analytics:
 *   get:
 *     summary: Get court integration analytics
 *     tags: [Enhanced Court Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Analytics timeframe
 *       - in: query
 *         name: courtSystem
 *         schema:
 *           type: string
 *         description: Filter by specific court system
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
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
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         totalFilings:
 *                           type: integer
 *                         successfulFilings:
 *                           type: integer
 *                         failedFilings:
 *                           type: integer
 *                         pendingFilings:
 *                           type: integer
 *                         successRate:
 *                           type: number
 *                         averageProcessingTime:
 *                           type: number
 *                         totalFees:
 *                           type: number
 *                     apiHealth:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         activeConnections:
 *                           type: integer
 *                         supportedSystems:
 *                           type: integer
 *                         healthySystems:
 *                           type: integer
 */
router.get('/analytics', analyticsValidation, validate, courtController.getCourtAnalytics.bind(courtController));

// Get supported court systems
router.get('/supported-courts', courtController.getCourtSystems.bind(courtController));

// Alternative route for status checking (tests expect this format)
router.get('/status/:filingId', 
  param('filingId')
    .notEmpty()
    .withMessage('Filing ID is required'),
  validate,
  courtController.checkFilingStatus.bind(courtController)
);

// Update filing status
router.put('/status/:filingId',
  param('filingId')
    .notEmpty()
    .withMessage('Filing ID is required'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'submitted', 'processed', 'failed', 'cancelled'])
    .withMessage('Invalid status value'),
  validate,
  courtController.updateFilingStatus.bind(courtController)
);

module.exports = router;