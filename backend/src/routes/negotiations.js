// Settlement Negotiation Routes - Phase 4.2 API Endpoints
// Multi-party negotiation system with AI-assisted compromise generation

const express = require('express');
const SettlementNegotiationController = require('../controllers/SettlementNegotiationController');
const { requireAuth } = require('../lib/authMiddleware');
const validate = require('../middleware/validate');
const { body, param, query } = require('express-validator');

const router = express.Router();
const negotiationController = new SettlementNegotiationController();

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * @swagger
 * components:
 *   schemas:
 *     SettlementNegotiation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         caseId:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [active, completed, failed, cancelled, timed_out]
 *         currentRound:
 *           type: integer
 *         maxRounds:
 *           type: integer
 *         parties:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, responded]
 *         currentOffers:
 *           type: object
 *         roundDeadline:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     NegotiationResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         negotiationId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         roundNumber:
 *           type: integer
 *         responseType:
 *           type: string
 *           enum: [accept, reject, counter]
 *         settlementAmount:
 *           type: number
 *         message:
 *           type: string
 *         submittedAt:
 *           type: string
 *           format: date-time
 */

// Input validation schemas
const startNegotiationValidation = [
  body('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format'),
  body('initialSettlement')
    .isObject()
    .withMessage('Initial settlement must be an object'),
  body('initialSettlement.amount')
    .isNumeric()
    .withMessage('Settlement amount must be a number')
    .custom(value => value >= 0)
    .withMessage('Settlement amount must be non-negative'),
  body('maxRounds')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Max rounds must be between 1 and 20'),
  body('timeoutHours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Timeout must be between 1 and 168 hours')
];

const submitResponseValidation = [
  param('negotiationId')
    .notEmpty()
    .withMessage('Negotiation ID is required')
    .isUUID()
    .withMessage('Invalid negotiation ID format'),
  body('type')
    .isIn(['accept', 'reject', 'counter'])
    .withMessage('Response type must be accept, reject, or counter'),
  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number'),
  body('message')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Message too long (max 1000 characters)'),
  body('counterOffer')
    .optional()
    .isObject()
    .withMessage('Counter offer must be an object'),
  body('counterOffer.amount')
    .if(body('type').equals('counter'))
    .notEmpty()
    .withMessage('Counter offer amount is required')
    .isNumeric()
    .withMessage('Counter offer amount must be a number')
];

const negotiationIdValidation = [
  param('negotiationId')
    .notEmpty()
    .withMessage('Negotiation ID is required')
    .isUUID()
    .withMessage('Invalid negotiation ID format')
];

const caseIdValidation = [
  param('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['active', 'completed', 'failed', 'cancelled', 'timed_out'])
    .withMessage('Invalid status filter')
];

/**
 * @swagger
 * /api/negotiations/health:
 *   get:
 *     summary: Check negotiation service health
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service health status
 */
router.get('/health', negotiationController.healthCheck);

/**
 * @swagger
 * /api/negotiations:
 *   post:
 *     summary: Start settlement negotiation
 *     tags: [Settlement Negotiations]
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
 *               - initialSettlement
 *             properties:
 *               caseId:
 *                 type: string
 *                 format: uuid
 *               initialSettlement:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                   terms:
 *                     type: object
 *                   message:
 *                     type: string
 *               maxRounds:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 10
 *               timeoutHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *                 default: 72
 *     responses:
 *       201:
 *         description: Negotiation started successfully
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
 *                     negotiationId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                     currentRound:
 *                       type: integer
 *                     deadline:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Case not found
 */
router.post('/', startNegotiationValidation, validate, negotiationController.startNegotiation);

/**
 * @swagger
 * /api/negotiations:
 *   get:
 *     summary: Get user's negotiations
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, failed, cancelled, timed_out]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Negotiations retrieved successfully
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
 *                     negotiations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SettlementNegotiation'
 *                     pagination:
 *                       type: object
 */
router.get('/', paginationValidation, validate, negotiationController.getUserNegotiations);

/**
 * @swagger
 * /api/negotiations/{negotiationId}:
 *   get:
 *     summary: Get negotiation status
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: negotiationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Negotiation status retrieved successfully
 *       404:
 *         description: Negotiation not found
 */
router.get('/:negotiationId', negotiationIdValidation, validate, negotiationController.getNegotiationStatus);

/**
 * @swagger
 * /api/negotiations/{negotiationId}/respond:
 *   post:
 *     summary: Submit negotiation response
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: negotiationId
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
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [accept, reject, counter]
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               terms:
 *                 type: object
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *               counterOffer:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                   terms:
 *                     type: object
 *                   reasoning:
 *                     type: string
 *                     maxLength: 500
 *     responses:
 *       200:
 *         description: Response submitted successfully
 *       400:
 *         description: Invalid response data
 *       404:
 *         description: Negotiation not found
 */
router.post('/:negotiationId/respond', submitResponseValidation, validate, negotiationController.submitResponse);

/**
 * @swagger
 * /api/negotiations/{negotiationId}/compromise:
 *   post:
 *     summary: Generate AI-assisted compromise
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: negotiationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Compromise generated successfully
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
 *                     compromiseId:
 *                       type: string
 *                       format: uuid
 *                     compromise:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                         terms:
 *                           type: object
 *                         reasoning:
 *                           type: string
 *                         confidence:
 *                           type: number
 *       404:
 *         description: Negotiation not found
 */
router.post('/:negotiationId/compromise', negotiationIdValidation, validate, negotiationController.generateCompromise);

/**
 * @swagger
 * /api/negotiations/{negotiationId}/history:
 *   get:
 *     summary: Get negotiation round history
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: negotiationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Round history retrieved successfully
 *       404:
 *         description: Negotiation not found
 */
router.get('/:negotiationId/history', negotiationIdValidation, validate, negotiationController.getRoundHistory);

/**
 * @swagger
 * /api/negotiations/{negotiationId}/cancel:
 *   post:
 *     summary: Cancel negotiation
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: negotiationId
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
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Negotiation cancelled successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Negotiation not found
 */
router.post('/:negotiationId/cancel', negotiationIdValidation, validate, negotiationController.cancelNegotiation);

/**
 * @swagger
 * /api/negotiations/cases/{caseId}:
 *   get:
 *     summary: Get case negotiations
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Case negotiations retrieved successfully
 *       404:
 *         description: Case not found
 */
router.get('/cases/:caseId', caseIdValidation, validate, negotiationController.getCaseNegotiations);

/**
 * @swagger
 * /api/negotiations/analytics:
 *   get:
 *     summary: Get negotiation analytics
 *     tags: [Settlement Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
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
 *                         totalNegotiations:
 *                           type: integer
 *                         successfulNegotiations:
 *                           type: integer
 *                         failedNegotiations:
 *                           type: integer
 *                         activeNegotiations:
 *                           type: integer
 *                         averageRounds:
 *                           type: number
 *                         successRate:
 *                           type: number
 */
router.get('/analytics', negotiationController.getNegotiationAnalytics);

module.exports = router;