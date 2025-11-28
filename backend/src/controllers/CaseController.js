// Case Controller - Handle case-related API endpoints
const CaseService = require('../services/CaseService');
const DefenderOnboardingService = require('../services/DefenderOnboardingService');
const CourtReferralPackageService = require('../services/CourtReferralPackageService');
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

  // POST /api/cases/:id/onboard-defender - Auto-create defender account
  onboardDefender = asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const { defenderDetails, complainerName } = req.body;

    // Validate required fields
    if (!defenderDetails || !defenderDetails.email || !defenderDetails.name) {
      return res.status(400).json({
        success: false,
        error: 'Defender email and name are required'
      });
    }

    const result = await DefenderOnboardingService.createDefenderAccount(
      caseId,
      defenderDetails,
      complainerName || req.user.full_name
    );

    res.status(201).json({
      success: true,
      data: result,
      message: result.isNewUser 
        ? 'Defender account created and notified successfully' 
        : 'Existing defender linked to case and notified'
    });
  });

  // POST /api/cases/:id/resend-credentials - Resend defender credentials
  resendDefenderCredentials = asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    await DefenderOnboardingService.resendCredentials(caseId, email);

    res.json({
      success: true,
      message: 'Credentials resent successfully'
    });
  });

  // GET /api/cases/:id/argument-status - Get argument completion status
  getArgumentStatus = asyncHandler(async (req, res) => {
    const caseId = req.params.id;

    const { data, error } = await require('../lib/supabaseClient').supabase
      .from('case_argument_status')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      data: data || {
        complainer: { isComplete: false },
        defender: { isComplete: false },
        analysisTriggered: false
      }
    });
  });

  // POST /api/cases/:id/confirm-arguments - Confirm arguments completion
  confirmArguments = asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const userId = req.user.id;
    const { isComplete, role } = req.body;

    if (typeof isComplete !== 'boolean' || !role) {
      return res.status(400).json({
        success: false,
        error: 'isComplete (boolean) and role are required'
      });
    }

    const { supabase } = require('../lib/supabaseClient');

    // Update or insert argument status
    const { data: existing } = await supabase
      .from('case_argument_status')
      .select('*')
      .eq('case_id', caseId)
      .single();

    const updateData = {
      [`${role}_complete`]: isComplete,
      [`${role}_confirmed_at`]: new Date().toISOString(),
      [`${role}_user_id`]: userId,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      await supabase
        .from('case_argument_status')
        .update(updateData)
        .eq('case_id', caseId);
    } else {
      await supabase
        .from('case_argument_status')
        .insert({
          case_id: caseId,
          ...updateData,
          created_at: new Date().toISOString()
        });
    }

    // Log timeline event
    await supabase
      .from('case_timeline')
      .insert({
        case_id: caseId,
        event_type: 'arguments_confirmed',
        user_id: userId,
        description: `${role} confirmed arguments completion`,
        created_at: new Date().toISOString()
      });

    res.json({
      success: true,
      message: 'Arguments confirmation recorded',
      data: { role, isComplete }
    });
  });

  // POST /api/cases/:id/trigger-sheriff-analysis - Trigger AI Sheriff analysis
  triggerSheriffAnalysis = asyncHandler(async (req, res) => {
    const caseId = req.params.id;

    const { supabase } = require('../lib/supabaseClient');

    // Check if both parties confirmed
    const { data: status } = await supabase
      .from('case_argument_status')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (!status || !status.complainer_complete || !status.defender_complete) {
      return res.status(400).json({
        success: false,
        error: 'Both parties must confirm arguments completion first'
      });
    }

    // Mark analysis as triggered
    await supabase
      .from('case_argument_status')
      .update({
        analysis_triggered: true,
        analysis_triggered_at: new Date().toISOString()
      })
      .eq('case_id', caseId);

    // Update case status
    await supabase
      .from('cases')
      .update({
        status: 'ai_analyzing',
        updated_at: new Date().toISOString()
      })
      .eq('id', caseId);

    // Trigger AI analysis (this would typically be done via a queue/background job)
    const AIController = require('./AIController');
    try {
      await AIController.analyzeCaseForSettlement(caseId);
    } catch (error) {
      console.error('Error triggering AI analysis:', error);
    }

    res.json({
      success: true,
      message: 'AI Sheriff analysis triggered successfully'
    });
  });

  // POST /api/cases/:id/create-court-package - Create court referral package
  createCourtPackage = asyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const userId = req.user.id;

    // Verify user has permission
    const { data: caseData } = await require('../lib/supabaseClient').supabase
      .from('cases')
      .select('filed_by, defender_user_id')
      .eq('id', caseId)
      .single();

    if (!caseData || (caseData.filed_by !== userId && caseData.defender_user_id !== userId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create court package for this case'
      });
    }

    const result = await CourtReferralPackageService.createCourtPackage(caseId);

    res.json({
      success: true,
      data: result,
      message: 'Court referral package created successfully'
    });
  });

  // GET /api/cases/:id/court-package - Get court package info
  getCourtPackage = asyncHandler(async (req, res) => {
    const caseId = req.params.id;

    const packageInfo = await CourtReferralPackageService.getPackageByCaseId(caseId);

    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        error: 'No court package found for this case'
      });
    }

    res.json({
      success: true,
      data: packageInfo
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