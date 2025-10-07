// Active Negotiation Routes - Real-time Settlement Negotiation API
// Multi-party negotiation sessions with AI assistance and real-time updates

const express = require('express');
const ActiveNegotiationController = require('../controllers/ActiveNegotiationController');
const { requireAuth } = require('../lib/authMiddleware');
const validate = require('../middleware/validate');
const { body, param, query } = require('express-validator');

const router = express.Router();
const negotiationController = new ActiveNegotiationController();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation schemas
const startNegotiationValidation = [
  body('caseId')
    .notEmpty()
    .withMessage('Case ID is required')
    .isUUID()
    .withMessage('Invalid case ID format'),
  body('initialOffer')
    .isObject()
    .withMessage('Initial offer must be an object'),
  body('initialOffer.financial_terms.amount')
    .optional()
    .isNumeric()
    .withMessage('Offer amount must be a number')
    .custom(value => value >= 0)
    .withMessage('Offer amount must be non-negative'),
  body('initialOffer.amount')
    .optional()
    .isNumeric()
    .withMessage('Offer amount must be a number')
    .custom(value => value >= 0)
    .withMessage('Offer amount must be non-negative'),
  body('participants')
    .optional()
    .isArray()
    .withMessage('Participants must be an array'),
  body('maxRounds')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Max rounds must be between 1 and 50'),
  body('deadlineHours')
    .optional()
    .isInt({ min: 1, max: 720 })
    .withMessage('Deadline must be between 1 and 720 hours (30 days)'),
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid ISO 8601 date'),
  body('allowCounterOffers')
    .optional()
    .isBoolean()
    .withMessage('Allow counter offers must be a boolean')
];

const submitResponseValidation = [
  param('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isUUID()
    .withMessage('Invalid session ID format'),
  body('response')
    .isIn(['accept', 'reject', 'counter'])
    .withMessage('Response must be accept, reject, or counter'),
  body('counterOffer')
    .if(body('response').equals('counter'))
    .isObject()
    .withMessage('Counter offer required for counter response'),
  body('counterOffer.amount')
    .if(body('response').equals('counter'))
    .isNumeric()
    .withMessage('Counter offer amount must be a number')
    .custom((value, { req }) => req.body.response !== 'counter' || value >= 0)
    .withMessage('Counter offer amount must be non-negative'),
  body('message')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Message too long (max 1000 characters)')
];

const sessionValidation = [
  param('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isUUID()
    .withMessage('Invalid session ID format')
];

const extendDeadlineValidation = [
  param('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isUUID()
    .withMessage('Invalid session ID format'),
  body('additionalHours')
    .isInt({ min: 1, max: 168 })
    .withMessage('Additional hours must be between 1 and 168 (1 week)'),
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason too long (max 500 characters)')
];

const paginationValidation = [
  query('status')
    .optional()
    .isIn(['active', 'completed_accepted', 'completed_failed', 'completed_max_rounds', 'cancelled', 'expired'])
    .withMessage('Invalid status filter'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const analyticsValidation = [
  query('timeframe')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Timeframe must be 7d, 30d, 90d, or 1y'),
  query('caseId')
    .optional()
    .isUUID()
    .withMessage('Invalid case ID format')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     NegotiationSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         caseId:
 *           type: string
 *           format: uuid
 *         initiatorId:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [active, completed_accepted, completed_failed, completed_max_rounds, cancelled, expired]
 *         currentRound:
 *           type: integer
 *         maxRounds:
 *           type: integer
 *         deadline:
 *           type: string
 *           format: date-time
 *         allowCounterOffers:
 *           type: boolean
 *         initialOffer:
 *           type: object
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
 *               hasResponded:
 *                 type: boolean
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
 *         sessionId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         response:
 *           type: string
 *           enum: [accept, reject, counter]
 *         counterOffer:
 *           type: object
 *         message:
 *           type: string
 *         roundNumber:
 *           type: integer
 *         submittedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/active-negotiations/health:
 *   get:
 *     summary: Check active negotiation service health
 *     tags: [Active Negotiations]
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
 *                     activeNegotiations:
 *                       type: integer
 *                     totalSessions:
 *                       type: integer
 */
router.get('/health', negotiationController.healthCheck.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations:
 *   post:
 *     summary: Start new active negotiation session
 *     tags: [Active Negotiations]
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
 *               - initialOffer
 *             properties:
 *               caseId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the case to negotiate
 *               initialOffer:
 *                 type: object
 *                 required:
 *                   - amount
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                     description: Initial settlement amount
 *                   terms:
 *                     type: object
 *                     description: Additional settlement terms
 *                   message:
 *                     type: string
 *                     description: Message to accompanying parties
 *               maxRounds:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 default: 10
 *                 description: Maximum negotiation rounds
 *               deadlineHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 720
 *                 default: 72
 *                 description: Negotiation deadline in hours
 *               allowCounterOffers:
 *                 type: boolean
 *                 default: true
 *                 description: Whether counter offers are allowed
 *     responses:
 *       201:
 *         description: Negotiation session started successfully
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
 *                     sessionId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                     currentRound:
 *                       type: integer
 *                     deadline:
 *                       type: string
 *                       format: date-time
 */
router.post('/sessions', startNegotiationValidation, validate, negotiationController.startNegotiation.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations:
 *   get:
 *     summary: Get user's active negotiations
 *     tags: [Active Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed_accepted, completed_failed, completed_max_rounds, cancelled, expired]
 *         description: Filter by negotiation status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: User negotiations retrieved successfully
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
 *                         $ref: '#/components/schemas/NegotiationSession'
 *                     pagination:
 *                       type: object
 *                     statistics:
 *                       type: object
 */
router.get('/sessions', paginationValidation, validate, negotiationController.getUserNegotiations.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations/{sessionId}:
 *   get:
 *     summary: Get negotiation session status and details
 *     tags: [Active Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Negotiation session ID
 *     responses:
 *       200:
 *         description: Session status retrieved successfully
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
 *                     session:
 *                       $ref: '#/components/schemas/NegotiationSession'
 *                     activity:
 *                       type: array
 *                     pendingResponses:
 *                       type: integer
 *                     timeRemaining:
 *                       type: object
 *                     canSubmitResponse:
 *                       type: boolean
 *       404:
 *         description: Negotiation session not found
 *       403:
 *         description: Access denied
 */
router.get('/sessions/:sessionId', sessionValidation, validate, negotiationController.getSessionStatus.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations/{sessionId}/respond:
 *   post:
 *     summary: Submit response to active negotiation
 *     tags: [Active Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Negotiation session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *                 enum: [accept, reject, counter]
 *                 description: Type of response
 *               counterOffer:
 *                 type: object
 *                 description: Required if response is 'counter'
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                     description: Counter offer amount
 *                   terms:
 *                     type: object
 *                     description: Counter offer terms
 *                   reasoning:
 *                     type: string
 *                     description: Reasoning for counter offer
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional message to other parties
 *     responses:
 *       200:
 *         description: Response submitted successfully
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
 *                     responseId:
 *                       type: string
 *                       format: uuid
 *                     sessionStatus:
 *                       type: string
 *                     currentRound:
 *                       type: integer
 *                     requiresResponse:
 *                       type: boolean
 *       400:
 *         description: Invalid response or negotiation expired
 *       403:
 *         description: Not authorized to respond
 *       404:
 *         description: Negotiation session not found
 */
router.post('/sessions/:sessionId/responses', submitResponseValidation, validate, negotiationController.submitResponse.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations/{sessionId}/compromise:
 *   post:
 *     summary: Generate AI-assisted compromise proposal
 *     tags: [Active Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Negotiation session ID
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
 *                         paymentSchedule:
 *                           type: string
 *                     reasoning:
 *                       type: string
 *                     confidence:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 1
 *                     recommendedAction:
 *                       type: string
 *       403:
 *         description: Not authorized to generate compromise
 *       404:
 *         description: Negotiation session not found
 */
router.post('/sessions/:sessionId/compromise', sessionValidation, validate, negotiationController.generateCompromise.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations/{sessionId}/extend:
 *   post:
 *     summary: Extend negotiation deadline
 *     tags: [Active Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Negotiation session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - additionalHours
 *             properties:
 *               additionalHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *                 description: Additional hours to extend deadline
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for extension
 *     responses:
 *       200:
 *         description: Deadline extended successfully
 *       403:
 *         description: Not authorized to extend deadline
 *       404:
 *         description: Negotiation session not found
 */
router.post('/sessions/:sessionId/extend-deadline', extendDeadlineValidation, validate, negotiationController.extendDeadline.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations/{sessionId}/cancel:
 *   post:
 *     summary: Cancel active negotiation
 *     tags: [Active Negotiations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Negotiation session ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Negotiation cancelled successfully
 *       403:
 *         description: Only initiator can cancel negotiation
 *       404:
 *         description: Negotiation session not found
 */
router.delete('/sessions/:sessionId', sessionValidation, validate, negotiationController.cancelNegotiation.bind(negotiationController));

/**
 * @swagger
 * /api/active-negotiations/analytics:
 *   get:
 *     summary: Get negotiation analytics
 *     tags: [Active Negotiations]
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
 *         name: caseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific case
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
 *                         activeNegotiations:
 *                           type: integer
 *                         completedAccepted:
 *                           type: integer
 *                         completedFailed:
 *                           type: integer
 *                         successRate:
 *                           type: number
 *                         averageRounds:
 *                           type: number
 *                         averageResolutionTime:
 *                           type: number
 */
router.get('/analytics', analyticsValidation, validate, negotiationController.getNegotiationAnalytics.bind(negotiationController));

module.exports = router;