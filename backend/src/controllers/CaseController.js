// Case Controller - Handle case-related API endpoints
const CaseService = require('../services/CaseService');
const asyncHandler = require('../lib/asyncHandler');
const { requireAuth } = require('../lib/authMiddleware');

class CaseController {
  // GET /api/cases - Get user's cases
  getCases = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { status, limit, offset, search } = req.query;

    const filters = {
      status,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      search
    };

    const cases = await CaseService.getUserCases(userId, filters);

    res.json({
      success: true,
      data: cases,
      count: cases.length
    });
  });

  // POST /api/cases - Create new case
  createCase = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const caseData = req.body;

    // Validate required fields
    if (!caseData.title) {
      return res.status(400).json({
        success: false,
        error: 'Case title is required'
      });
    }

    const newCase = await CaseService.createCase(caseData, userId);

    res.status(201).json({
      success: true,
      data: newCase,
      message: 'Case created successfully'
    });
  });

  // GET /api/cases/:id - Get case details
  getCaseById = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const caseId = req.params.id;

    const caseDetails = await CaseService.getCaseDetails(caseId, userId);

    res.json({
      success: true,
      data: caseDetails
    });
  });

  // PUT /api/cases/:id - Update case
  updateCase = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const caseId = req.params.id;
    const updates = req.body;

    const updatedCase = await CaseService.updateCase(caseId, updates, userId);

    res.json({
      success: true,
      data: updatedCase,
      message: 'Case updated successfully'
    });
  });

  // POST /api/cases/:id/progress - Progress case to next status
  progressCase = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const caseId = req.params.id;
    const { reason } = req.body;

    const updatedCase = await CaseService.progressCase(caseId, userId, reason);

    res.json({
      success: true,
      data: updatedCase,
      message: 'Case status updated'
    });
  });

  // POST /api/cases/:id/parties - Add party to case
  addParty = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const caseId = req.params.id;
    const partyData = req.body;

    // Validate required fields
    if (!partyData.contact_email || !partyData.role) {
      return res.status(400).json({
        success: false,
        error: 'Contact email and role are required'
      });
    }

    const party = await CaseService.addPartyToCase(caseId, partyData, userId);

    res.status(201).json({
      success: true,
      data: party,
      message: 'Party added to case successfully'
    });
  });

  // GET /api/dashboard/stats - Get dashboard statistics
  getDashboardStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const stats = await CaseService.getDashboardStats(userId);

    res.json({
      success: true,
      data: stats
    });
  });

  // Apply authentication middleware to all methods
  applyAuth() {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(name => name !== 'constructor' && name !== 'applyAuth' && typeof this[name] === 'function');
    
    methodNames.forEach(methodName => {
      this[methodName] = requireAuth(this[methodName]);
    });
  }
}

// Create instance and apply auth
const caseController = new CaseController();
caseController.applyAuth();

module.exports = caseController;