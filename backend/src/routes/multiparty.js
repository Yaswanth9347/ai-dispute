// Multi-Party Routes - Phase 3 API endpoints for multi-party workflows
const express = require('express');
const router = express.Router();
const MultiPartyController = require('../controllers/MultiPartyController');
const { requireAuth } = require('../lib/authMiddleware');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Validation schemas
const caseIdValidation = [
  param('caseId')
    .isUUID()
    .withMessage('Invalid case ID format')
];

const invitationValidation = [
  body('case_id')
    .isUUID()
    .withMessage('Valid case ID is required'),
  body('invitee_email')
    .isEmail()
    .withMessage('Valid email address is required'),
  body('invitee_name')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Invitee name must be 2-100 characters'),
  body('party_role')
    .optional()
    .isIn(['claimant', 'respondent', 'mediator', 'witness', 'expert'])
    .withMessage('Invalid party role'),
  body('invitation_message')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Invitation message must be max 500 characters')
];

const negotiationValidation = [
  body('case_id')
    .isUUID()
    .withMessage('Valid case ID is required'),
  body('negotiation_type')
    .optional()
    .isIn(['multi_party', 'bilateral', 'mediated'])
    .withMessage('Invalid negotiation type'),
  body('negotiation_deadline')
    .optional()
    .isISO8601()
    .withMessage('Invalid deadline format'),
  body('initial_proposals')
    .optional()
    .isArray()
    .withMessage('Initial proposals must be an array'),
  body('negotiation_message')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Negotiation message must be max 1000 characters')
];

const proposalValidation = [
  body('settlement_amount')
    .isNumeric()
    .withMessage('Settlement amount must be numeric'),
  body('currency')
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3-letter code'),
  body('payment_terms')
    .optional()
    .isIn(['lump_sum', 'installments', 'deferred'])
    .withMessage('Invalid payment terms'),
  body('terms_conditions')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Terms and conditions must be max 2000 characters')
];

const signatureRequestValidation = [
  body('case_id')
    .isUUID()
    .withMessage('Valid case ID is required'),
  body('document_type')
    .isString()
    .isIn(['settlement_agreement', 'evidence_acknowledgment', 'mediation_agreement', 'disclosure_agreement'])
    .withMessage('Invalid document type'),
  body('signers')
    .isArray({ min: 1 })
    .withMessage('At least one signer is required'),
  body('signers.*.email')
    .isEmail()
    .withMessage('Valid email required for each signer'),
  body('signers.*.name')
    .isString()
    .isLength({ min: 2 })
    .withMessage('Valid name required for each signer'),
  body('signing_order')
    .optional()
    .isIn(['parallel', 'sequential'])
    .withMessage('Invalid signing order'),
  body('expiry_hours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Expiry hours must be between 1 and 168 (7 days)')
];

const signDocumentValidation = [
  body('signature_image')
    .isString()
    .withMessage('Signature image data is required'),
  body('signature_type')
    .optional()
    .isIn(['draw', 'type', 'upload'])
    .withMessage('Invalid signature type'),
  body('consent_text')
    .isString()
    .withMessage('Consent text is required'),
  body('ip_address')
    .optional()
    .isIP()
    .withMessage('Invalid IP address format'),
  body('user_agent')
    .optional()
    .isString()
    .withMessage('User agent must be a string')
];

// =============================================================================
// INVITATION MANAGEMENT ROUTES
// =============================================================================

/**
 * @swagger
 * /api/multi-party/invitations:
 *   post:
 *     summary: Invite a party to join a case
 *     description: Send an invitation to a person to join a legal case as a party
 *     tags: [Multi-Party Invitations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - case_id
 *               - invitee_email
 *               - invitee_name
 *             properties:
 *               case_id:
 *                 type: string
 *                 format: uuid
 *               invitee_email:
 *                 type: string
 *                 format: email
 *               invitee_name:
 *                 type: string
 *               party_role:
 *                 type: string
 *                 enum: [claimant, respondent, mediator, witness, expert]
 *               invitation_message:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Access denied to case
 */
router.post('/invitations',
  invitationValidation,
  validate,
  MultiPartyController.createInvitation);

/**
 * @swagger
 * /api/multi-party/invitations/{token}:
 *   get:
 *     summary: Get invitation details by token
 *     description: Retrieve invitation information using the invitation token
 *     tags: [Multi-Party Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation details retrieved
 *       404:
 *         description: Invitation not found or expired
 */
router.get('/invitations/:token',
  MultiPartyController.getInvitation);

/**
 * @swagger
 * /api/multi-party/invitations/{token}/accept:
 *   post:
 *     summary: Accept an invitation
 *     description: Accept an invitation to join a case as a party
 *     tags: [Multi-Party Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/invitations/:token/accept',
  MultiPartyController.acceptInvitation);

/**
 * @swagger
 * /api/multi-party/invitations/{token}/decline:
 *   post:
 *     summary: Decline an invitation
 *     description: Decline an invitation to join a case
 *     tags: [Multi-Party Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Invitation declined successfully
 */
router.post('/invitations/:token/decline',
  MultiPartyController.declineInvitation);

/**
 * @swagger
 * /api/multi-party/cases/{caseId}/invitations:
 *   get:
 *     summary: Get all invitations for a case
 *     description: Retrieve all invitations sent for a specific case
 *     tags: [Multi-Party Invitations]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Case invitations retrieved successfully
 *       403:
 *         description: Access denied to case
 */
router.get('/cases/:caseId/invitations',
  caseIdValidation,
  validate,
  MultiPartyController.getCaseInvitations);

/**
 * @swagger
 * /api/multi-party/invitations/{invitationId}/resend:
 *   post:
 *     summary: Resend an invitation
 *     description: Resend a pending invitation and extend its expiry
 *     tags: [Multi-Party Invitations]
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invitation resent successfully
 */
router.post('/invitations/:invitationId/resend',
  MultiPartyController.resendInvitation);

/**
 * @swagger
 * /api/multi-party/invitations/{invitationId}:
 *   delete:
 *     summary: Cancel an invitation
 *     description: Cancel a pending invitation
 *     tags: [Multi-Party Invitations]
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invitation cancelled successfully
 */
router.delete('/invitations/:invitationId',
  MultiPartyController.cancelInvitation);

// =============================================================================
// SETTLEMENT NEGOTIATION ROUTES
// =============================================================================

/**
 * @swagger
 * /api/multi-party/negotiations:
 *   post:
 *     summary: Start settlement negotiation
 *     description: Initiate a multi-party settlement negotiation session
 *     tags: [Settlement Negotiation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - case_id
 *             properties:
 *               case_id:
 *                 type: string
 *                 format: uuid
 *               negotiation_type:
 *                 type: string
 *                 enum: [multi_party, bilateral, mediated]
 *               initial_proposals:
 *                 type: array
 *                 items:
 *                   type: object
 *               negotiation_deadline:
 *                 type: string
 *                 format: date-time
 *               negotiation_message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Negotiation started successfully
 */
router.post('/negotiations',
  negotiationValidation,
  validate,
  MultiPartyController.startNegotiation);

/**
 * @swagger
 * /api/multi-party/negotiations/{negotiationId}/proposals:
 *   post:
 *     summary: Submit negotiation proposal
 *     description: Submit a settlement proposal during negotiation
 *     tags: [Settlement Negotiation]
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
 *               - settlement_amount
 *               - currency
 *             properties:
 *               settlement_amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               payment_terms:
 *                 type: string
 *               terms_conditions:
 *                 type: string
 *     responses:
 *       201:
 *         description: Proposal submitted successfully
 */
router.post('/negotiations/:negotiationId/proposals',
  proposalValidation,
  validate,
  MultiPartyController.submitNegotiationProposal);

/**
 * @swagger
 * /api/multi-party/negotiations/{negotiationId}:
 *   get:
 *     summary: Get negotiation status
 *     description: Get current status and details of a negotiation session
 *     tags: [Settlement Negotiation]
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
 */
router.get('/negotiations/:negotiationId',
  MultiPartyController.getNegotiationStatus);

/**
 * @swagger
 * /api/multi-party/settlements/{proposalId}/accept:
 *   post:
 *     summary: Accept settlement proposal
 *     description: Accept a settlement proposal and initiate signing process
 *     tags: [Settlement Negotiation]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Settlement accepted successfully
 */
router.post('/settlements/:proposalId/accept',
  MultiPartyController.acceptSettlement);

/**
 * @swagger
 * /api/multi-party/cases/{caseId}/negotiations:
 *   get:
 *     summary: Get case negotiations
 *     description: Get all negotiation sessions for a case
 *     tags: [Settlement Negotiation]
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
 */
router.get('/cases/:caseId/negotiations',
  caseIdValidation,
  validate,
  MultiPartyController.getCaseNegotiations);

// =============================================================================
// DIGITAL SIGNATURE ROUTES
// =============================================================================

/**
 * @swagger
 * /api/multi-party/signatures:
 *   post:
 *     summary: Create signature request
 *     description: Create a request for multiple parties to sign a document
 *     tags: [Digital Signatures]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - case_id
 *               - document_type
 *               - signers
 *             properties:
 *               case_id:
 *                 type: string
 *                 format: uuid
 *               document_type:
 *                 type: string
 *               signers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *               signing_order:
 *                 type: string
 *                 enum: [parallel, sequential]
 *     responses:
 *       201:
 *         description: Signature request created successfully
 */
router.post('/signatures',
  signatureRequestValidation,
  validate,
  MultiPartyController.createSignatureRequest);

/**
 * @swagger
 * /api/multi-party/signatures/{token}/sign:
 *   post:
 *     summary: Sign document
 *     description: Digitally sign a document using signature token
 *     tags: [Digital Signatures]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signature_image
 *               - consent_text
 *             properties:
 *               signature_image:
 *                 type: string
 *               signature_type:
 *                 type: string
 *               consent_text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document signed successfully
 */
router.post('/signatures/:token/sign',
  signDocumentValidation,
  validate,
  MultiPartyController.signDocument);

/**
 * @swagger
 * /api/multi-party/signatures/{requestId}:
 *   get:
 *     summary: Get signature request
 *     description: Get details of a signature request
 *     tags: [Digital Signatures]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Signature request retrieved successfully
 */
router.get('/signatures/:requestId',
  MultiPartyController.getSignatureRequest);

/**
 * @swagger
 * /api/multi-party/cases/{caseId}/signatures:
 *   get:
 *     summary: Get case signature requests
 *     description: Get all signature requests for a case
 *     tags: [Digital Signatures]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Case signature requests retrieved successfully
 */
router.get('/cases/:caseId/signatures',
  caseIdValidation,
  validate,
  MultiPartyController.getCaseSignatureRequests);

/**
 * @swagger
 * /api/multi-party/signatures/{requestId}:
 *   delete:
 *     summary: Cancel signature request
 *     description: Cancel a pending signature request
 *     tags: [Digital Signatures]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Signature request cancelled successfully
 */
router.delete('/signatures/:requestId',
  MultiPartyController.cancelSignatureRequest);

/**
 * @swagger
 * /api/multi-party/users/{userId}/signatures/pending:
 *   get:
 *     summary: Get user pending signatures
 *     description: Get all pending signature requests for a user
 *     tags: [Digital Signatures]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pending signatures retrieved successfully
 */
router.get('/users/:userId/signatures/pending',
  MultiPartyController.getUserPendingSignatures);

// =============================================================================
// REAL-TIME COMMUNICATION ROUTES
// =============================================================================

/**
 * @swagger
 * /api/multi-party/realtime/stats:
 *   get:
 *     summary: Get real-time service statistics
 *     description: Get current statistics about real-time connections
 *     tags: [Real-Time Communication]
 *     responses:
 *       200:
 *         description: Real-time statistics retrieved successfully
 */
router.get('/realtime/stats',
  MultiPartyController.getRealTimeStats);

/**
 * @swagger
 * /api/multi-party/cases/{caseId}/online-users:
 *   get:
 *     summary: Get online users for case
 *     description: Get list of users currently online for a specific case
 *     tags: [Real-Time Communication]
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Online users retrieved successfully
 */
router.get('/cases/:caseId/online-users',
  caseIdValidation,
  validate,
  MultiPartyController.getCaseOnlineUsers);

// Export router
module.exports = router;