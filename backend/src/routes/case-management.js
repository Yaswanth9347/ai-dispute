// Case Management Routes - Enhanced case operations with 2-part layout
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, param, query, validationResult } = require('express-validator');
const CaseManagementController = require('../controllers/CaseManagementController');
const { authenticate } = require('../middleware/auth');



// Configure multer for evidence file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../storage/evidence');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `evidence-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'audio/mpeg', 'audio/wav',
      'video/mp4', 'video/avi'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Error handler for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// =============================================================================
// CASE LISTING & MANAGEMENT
// =============================================================================

// GET /api/case-management/cases - Get cases with advanced filtering
router.get('/cases', authenticate, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['filed', 'open', 'statement_phase', 'ai_analysis', 'settlement_options', 'consensus_pending', 'settled', 'forwarded_to_court', 'closed']),
  query('role').optional().isIn(['complainer', 'defender', 'all']),
  query('sort').optional().isIn(['created_at', 'updated_at', 'title', 'status', 'priority']),
  query('order').optional().isIn(['asc', 'desc'])
], handleValidationErrors, (req, res) => CaseManagementController.getCases(req, res));

// GET /api/case-management/cases/:caseId - Get detailed case view with 2-part layout
router.get('/cases/:caseId', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required')
], handleValidationErrors, (req, res) => CaseManagementController.getCaseDetail(req, res));

// =============================================================================
// STATEMENT MANAGEMENT
// =============================================================================

// POST /api/case-management/cases/:caseId/statements - Submit statement
router.post('/cases/:caseId/statements', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required'),
  body('content')
    .notEmpty()
    .withMessage('Statement content is required')
    .isLength({ min: 50, max: 10000 })
    .withMessage('Statement must be between 50 and 10,000 characters'),
  body('evidenceIds')
    .optional()
    .isArray()
    .withMessage('Evidence IDs must be an array'),
  body('evidenceIds.*')
    .optional()
    .isUUID()
    .withMessage('Each evidence ID must be a valid UUID')
], handleValidationErrors, (req, res) => CaseManagementController.submitStatement(req, res));

// GET /api/case-management/cases/:caseId/statements - Get all statements for case
router.get('/cases/:caseId/statements', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required')
], handleValidationErrors, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;

    const Statement = require('../models/Statement');
    const statements = await Statement.getCaseStatements(caseId, userId);
    const stats = await Statement.getStatementStats(caseId);

    res.json({
      success: true,
      data: {
        statements,
        statistics: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch statements'
    });
  }
});

// PUT /api/case-management/statements/:statementId - Edit statement (within time limit)
router.put('/statements/:statementId', authenticate, [
  param('statementId').isUUID().withMessage('Valid statement ID required'),
  body('content')
    .notEmpty()
    .withMessage('Statement content is required')
    .isLength({ min: 50, max: 10000 })
    .withMessage('Statement must be between 50 and 10,000 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const { statementId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const Statement = require('../models/Statement');
    const updatedStatement = await Statement.updateStatement(statementId, userId, { content });

    res.json({
      success: true,
      message: 'Statement updated successfully',
      data: updatedStatement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update statement'
    });
  }
});

// =============================================================================
// EVIDENCE MANAGEMENT
// =============================================================================

// POST /api/case-management/cases/:caseId/evidence - Upload evidence files
router.post('/cases/:caseId/evidence', authenticate, upload.array('files', 10), [
  param('caseId').isUUID().withMessage('Valid case ID required'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
  body('evidenceType').optional().isIn(['document', 'image', 'video', 'audio', 'other']),
  body('statementId').optional().isUUID().withMessage('Statement ID must be valid UUID')
], handleValidationErrors, (req, res) => CaseManagementController.uploadEvidence(req, res));

// GET /api/case-management/cases/:caseId/evidence - Get evidence for case
router.get('/cases/:caseId/evidence', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required'),
  query('party').optional().isIn(['complainer', 'defender']).withMessage('Party must be complainer or defender'),
  query('type').optional().isIn(['document', 'image', 'video', 'audio', 'other'])
], handleValidationErrors, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { party, type } = req.query;

    const Evidence = require('../models/Evidence');
    let evidence;

    if (party) {
      evidence = await Evidence.getEvidenceByParty(caseId, party);
    } else {
      evidence = await Evidence.getCaseEvidence(caseId);
    }

    if (type) {
      evidence = evidence.filter(e => e.evidence_type === type);
    }

    const stats = await Evidence.getEvidenceStats(caseId);

    res.json({
      success: true,
      data: {
        evidence,
        statistics: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch evidence'
    });
  }
});

// GET /api/case-management/evidence/:evidenceId/download - Download evidence file
router.get('/evidence/:evidenceId/download', authenticate, [
  param('evidenceId').isUUID().withMessage('Valid evidence ID required')
], handleValidationErrors, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const userId = req.user.id;

    const Evidence = require('../models/Evidence');
    const downloadInfo = await Evidence.getSecureDownloadUrl(evidenceId, userId);

    res.json({
      success: true,
      data: downloadInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get download URL'
    });
  }
});

// DELETE /api/case-management/evidence/:evidenceId - Delete evidence (within time limit)
router.delete('/evidence/:evidenceId', authenticate, [
  param('evidenceId').isUUID().withMessage('Valid evidence ID required')
], handleValidationErrors, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const userId = req.user.id;

    const Evidence = require('../models/Evidence');
    await Evidence.deleteEvidence(evidenceId, userId);

    res.json({
      success: true,
      message: 'Evidence deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete evidence'
    });
  }
});

// =============================================================================
// CASE ACTIONS & WORKFLOW
// =============================================================================

// POST /api/case-management/cases/:caseId/start-statement-phase - Start 48-hour statement timer
router.post('/cases/:caseId/start-statement-phase', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required'),
  body('hours').optional().isInt({ min: 1, max: 168 }).withMessage('Hours must be between 1 and 168 (1 week)')
], handleValidationErrors, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { hours = 48 } = req.body;
    const userId = req.user.id;

    const Case = require('../models/Case');
    const caseData = await Case.findById(caseId);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Only case filer can start statement phase
    if (caseData.filed_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the case filer can start the statement phase'
      });
    }

    const result = await Case.startStatementPhase(caseId, hours);

    res.json({
      success: true,
      message: `Statement collection phase started (${hours} hours)`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start statement phase'
    });
  }
});

// POST /api/case-management/cases/:caseId/extend-deadline - Extend statement deadline
router.post('/cases/:caseId/extend-deadline', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required'),
  body('hours').isInt({ min: 1, max: 72 }).withMessage('Extension must be between 1 and 72 hours')
], handleValidationErrors, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { hours } = req.body;
    const userId = req.user.id;

    const Case = require('../models/Case');
    const caseData = await Case.findById(caseId);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Only case filer can extend deadline
    if (caseData.filed_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the case filer can extend the deadline'
      });
    }

    if (!caseData.statement_deadline || caseData.status !== 'statement_phase') {
      return res.status(400).json({
        success: false,
        message: 'Cannot extend deadline for this case'
      });
    }

    const newDeadline = new Date(caseData.statement_deadline);
    newDeadline.setHours(newDeadline.getHours() + hours);

    await Case.updateById(caseId, {
      statement_deadline: newDeadline.toISOString()
    });

    // Notify both parties
    const RealTimeService = require('../services/RealTimeService');
    RealTimeService.broadcastToCaseRoom(caseId, 'deadline_extended', {
      newDeadline: newDeadline.toISOString(),
      hoursExtended: hours
    });

    res.json({
      success: true,
      message: `Deadline extended by ${hours} hours`,
      data: {
        newDeadline: newDeadline.toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to extend deadline'
    });
  }
});

// GET /api/case-management/cases/:caseId/timeline - Get case timeline
router.get('/cases/:caseId/timeline', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required')
], handleValidationErrors, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;

    const Case = require('../models/Case');
    const hasAccess = await Case.checkUserAccess(caseId, userId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this case'
      });
    }

    const timeline = await CaseManagementController.getCaseTimeline(caseId);

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch timeline'
    });
  }
});

// =============================================================================
// REAL-TIME STATUS & UPDATES
// =============================================================================

// GET /api/case-management/cases/:caseId/status - Get real-time case status
router.get('/cases/:caseId/status', authenticate, [
  param('caseId').isUUID().withMessage('Valid case ID required')
], handleValidationErrors, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;

    const Case = require('../models/Case');
    const Statement = require('../models/Statement');
    const caseData = await Case.findById(caseId);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const hasAccess = await Case.checkUserAccess(caseId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const statementStatus = await Statement.checkStatementsComplete(caseId);
    const timeRemaining = CaseManagementController.calculateTimeRemaining(caseData);
    const canTakeAction = CaseManagementController.canUserTakeAction(caseData, userId, statementStatus);

    res.json({
      success: true,
      data: {
        caseStatus: caseData.status,
        currentPhase: CaseManagementController.getCurrentPhase(caseData),
        statementStatus,
        timeRemaining,
        canTakeAction,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch case status'
    });
  }
});

// =============================================================================
// BULK OPERATIONS
// =============================================================================

// POST /api/case-management/cases/bulk-actions - Bulk case actions
router.post('/cases/bulk-actions', authenticate, [
  body('caseIds').isArray({ min: 1 }).withMessage('Case IDs array is required'),
  body('caseIds.*').isUUID().withMessage('Each case ID must be valid'),
  body('action').isIn(['archive', 'close', 'reopen']).withMessage('Invalid action')
], handleValidationErrors, async (req, res) => {
  try {
    const { caseIds, action } = req.body;
    const userId = req.user.id;

    const results = [];
    const Case = require('../models/Case');

    for (const caseId of caseIds) {
      try {
        const caseData = await Case.findById(caseId);
        
        if (!caseData || caseData.filed_by !== userId) {
          results.push({
            caseId,
            success: false,
            error: 'Access denied or case not found'
          });
          continue;
        }

        let newStatus;
        switch (action) {
          case 'archive':
            newStatus = 'closed';
            break;
          case 'close':
            newStatus = 'closed';
            break;
          case 'reopen':
            newStatus = 'open';
            break;
        }

        await Case.updateStatus(caseId, newStatus, userId, `Bulk ${action} operation`);
        
        results.push({
          caseId,
          success: true,
          newStatus
        });
      } catch (error) {
        results.push({
          caseId,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: successful > 0,
      message: `Bulk operation completed: ${successful} successful, ${failed} failed`,
      data: {
        results,
        summary: { successful, failed }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Bulk operation failed'
    });
  }
});

module.exports = router;