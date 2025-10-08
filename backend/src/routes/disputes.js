// Dispute Routes - Complete dispute resolution workflow
const express = require('express');
const router = express.Router();
const DisputeController = require('../controllers/DisputeController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Workflow management
router.post('/:caseId/workflow/initialize', DisputeController.initializeWorkflow);
router.get('/:caseId/workflow', DisputeController.getWorkflow);
router.get('/:caseId/workflow/statistics', DisputeController.getWorkflowStatistics);

// Party invitation
router.post('/:caseId/invite-respondent', DisputeController.inviteRespondent);

// Statement management
router.post('/:caseId/statements', DisputeController.submitStatement);
router.post('/:caseId/statements/finalize', DisputeController.finalizeStatement);
router.get('/:caseId/statements', DisputeController.getStatements);
router.get('/:caseId/statements/status', DisputeController.getStatementStatus);

// AI analysis and settlement options
router.post('/:caseId/analyze', DisputeController.generateSettlementOptions);
router.post('/:caseId/ai-options', DisputeController.generateAIOptions);
router.get('/:caseId/settlement-options', DisputeController.getSettlementOptions);

// Consensus and selection
router.post('/:caseId/select-option', DisputeController.selectOption);
router.get('/:caseId/consensus-status', DisputeController.getConsensusStatus);

// E-Signature
router.post('/:caseId/request-signature', DisputeController.requestSignature);
router.post('/signatures/:signatureId/verify', DisputeController.verifySignature);
router.post('/signatures/:signatureId/resend-otp', DisputeController.resendOTP);
router.get('/:caseId/signature-status', DisputeController.getSignatureStatus);

// Court forwarding
router.post('/:caseId/forward-to-court', DisputeController.forwardToCourt);
router.post('/:caseId/auto-forward-to-court', DisputeController.autoForwardToCourt);

// Evidence analysis
router.post('/:caseId/evidence/:documentId/analyze', DisputeController.analyzeEvidence);
router.get('/:caseId/evidence/analysis', DisputeController.getCaseEvidenceAnalysis);
router.post('/:caseId/evidence/analyze-all', DisputeController.analyzeAllEvidence);

module.exports = router;
