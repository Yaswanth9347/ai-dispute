// Document & Resolution Routes - API endpoints for document management and case resolution
const express = require('express');
const router = express.Router();
const DocumentResolutionController = require('../controllers/DocumentResolutionController');
const { requireAuth } = require('../lib/authMiddleware');

// Apply authentication to all routes
router.use(requireAuth);

// Settlement Agreement Routes
router.post('/cases/:caseId/settlement/generate', 
  DocumentResolutionController.generateSettlementAgreement
);

// Document Signing Routes
router.post('/documents/:documentId/sign', 
  DocumentResolutionController.signDocument
);

router.get('/documents/:documentId/verify-signature', 
  DocumentResolutionController.verifySignature
);

router.post('/documents/:documentId/reminder', 
  DocumentResolutionController.sendSignatureReminder
);

// Case Resolution Routes
router.post('/cases/:caseId/close/settlement', 
  DocumentResolutionController.closeCaseWithSettlement
);

router.post('/cases/:caseId/refer-to-court', 
  DocumentResolutionController.referToCourtRoute
);

router.post('/cases/:caseId/withdraw', 
  DocumentResolutionController.withdrawCase
);

// Document Generation Routes
router.post('/cases/:caseId/summary/generate', 
  DocumentResolutionController.generateCaseSummary
);

// Template Management Routes
router.get('/templates', 
  DocumentResolutionController.getDocumentTemplates
);

router.post('/templates/:templateName/render', 
  DocumentResolutionController.renderDocumentTemplate
);

// Statistics and Reporting
router.get('/statistics', 
  DocumentResolutionController.getStatistics
);

module.exports = router;