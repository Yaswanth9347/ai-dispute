// Court Integration Controller - Phase 5.2 API Layer
const courtIntegrationService = require('../services/CourtIntegrationService');
const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');
const { supabase } = require('../lib/supabaseClient');

class CourtController {
  // File case with court system
  fileCaseWithCourt = asyncHandler(async (req, res) => {
    const {
      caseId,
      courtSystemId,
      documentIds = [],
      filingType = 'initial_complaint',
      expedited = false,
      serviceMethod = 'electronic',
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!caseId || !courtSystemId) {
      throw new HttpError(400, 'Case ID and Court System ID are required');
    }

    // Validate user has access to the case
    const { data: caseAccess } = await supabase
      .from('cases')
      .select('id, created_by')
      .eq('id', caseId)
      .single();

    if (!caseAccess) {
      throw new HttpError(404, 'Case not found');
    }

    // For now, allow access if user is authenticated
    // In production, implement proper authorization based on case parties/permissions

    const result = await courtIntegrationService.fileCaseWithCourt({
      caseId,
      courtSystemId,
      documentIds,
      filingType,
      filedBy: req.user.sub,
      expedited,
      serviceMethod,
      metadata
    });

    res.status(201).json({
      success: true,
      message: 'Court filing submitted successfully',
      data: result
    });
  });

  // List available court systems
  listCourtSystems = asyncHandler(async (req, res) => {
    const { jurisdiction, type, integration_type } = req.query;
    
    const filters = {};
    if (jurisdiction) filters.jurisdiction = jurisdiction;
    if (type) filters.type = type;
    if (integration_type) filters.integration_type = integration_type;

    const courtSystems = await courtIntegrationService.listCourtSystems(filters);

    res.json({
      success: true,
      message: 'Court systems retrieved successfully',
      data: {
        courtSystems,
        count: courtSystems.length,
        filters: filters
      }
    });
  });

  // Get court system details
  getCourtSystem = asyncHandler(async (req, res) => {
    const { courtSystemId } = req.params;

    if (!courtSystemId) {
      throw new HttpError(400, 'Court System ID is required');
    }

    const courtSystem = await courtIntegrationService.getCourtSystem(courtSystemId);

    res.json({
      success: true,
      message: 'Court system retrieved successfully',
      data: courtSystem
    });
  });

  // Get filing status
  getFilingStatus = asyncHandler(async (req, res) => {
    const { filingId } = req.params;

    if (!filingId) {
      throw new HttpError(400, 'Filing ID is required');
    }

    const filing = await courtIntegrationService.getFilingStatus(filingId);

    res.json({
      success: true,
      message: 'Filing status retrieved successfully',
      data: filing
    });
  });

  // Get case filing history
  getCaseFilingHistory = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { limit = 50 } = req.query;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    // Validate user has access to the case
    const { data: caseAccess } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .single();

    if (!caseAccess) {
      throw new HttpError(404, 'Case not found');
    }

    const { data: filings, error } = await supabase
      .from('court_filings')
      .select(`
        *,
        court_systems!inner(name, jurisdiction, court_type)
      `)
      .eq('case_id', caseId)
      .order('filing_date', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw new HttpError(500, 'Failed to retrieve filing history');
    }

    res.json({
      success: true,
      message: 'Filing history retrieved successfully',
      data: {
        filings: filings || [],
        caseId,
        count: filings?.length || 0
      }
    });
  });

  // Update filing status (for court system callbacks)
  updateFilingStatus = asyncHandler(async (req, res) => {
    const { filingId } = req.params;
    const {
      status,
      courtConfirmationNumber,
      caseNumber,
      courtResponse,
      estimatedProcessingTime,
      nextSteps
    } = req.body;

    if (!filingId) {
      throw new HttpError(400, 'Filing ID is required');
    }

    if (!status) {
      throw new HttpError(400, 'Status is required');
    }

    // Verify filing exists
    const filing = await courtIntegrationService.getFilingStatus(filingId);
    if (!filing) {
      throw new HttpError(404, 'Filing not found');
    }

    // Update filing record
    await courtIntegrationService.updateFilingRecord(filingId, {
      filing_status: status,
      court_confirmation_number: courtConfirmationNumber,
      court_case_number: caseNumber,
      court_response: courtResponse,
      estimated_processing_time: estimatedProcessingTime,
      next_steps: nextSteps,
      status_updated_at: new Date().toISOString()
    });

    // If case number is assigned, update the main case record
    if (caseNumber) {
      await supabase
        .from('cases')
        .update({
          case_number: caseNumber,
          court_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', filing.case_id);
    }

    res.json({
      success: true,
      message: 'Filing status updated successfully',
      data: {
        filingId,
        status,
        caseNumber,
        updatedAt: new Date().toISOString()
      }
    });
  });

  // Cancel court filing
  cancelFiling = asyncHandler(async (req, res) => {
    const { filingId } = req.params;
    const { reason } = req.body;

    if (!filingId) {
      throw new HttpError(400, 'Filing ID is required');
    }

    // Get filing details
    const filing = await courtIntegrationService.getFilingStatus(filingId);
    if (!filing) {
      throw new HttpError(404, 'Filing not found');
    }

    // Check if filing can be cancelled
    if (['submitted', 'accepted', 'processed'].includes(filing.filing_status)) {
      throw new HttpError(400, 'Cannot cancel filing that has already been processed by the court');
    }

    // Update filing status to cancelled
    await courtIntegrationService.updateFilingRecord(filingId, {
      filing_status: 'cancelled',
      cancellation_reason: reason,
      cancelled_by: req.user.sub,
      cancelled_at: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Filing cancelled successfully',
      data: {
        filingId,
        status: 'cancelled',
        reason,
        cancelledAt: new Date().toISOString()
      }
    });
  });

  // Get required documents for filing type
  getRequiredDocuments = asyncHandler(async (req, res) => {
    const { courtSystemId, filingType } = req.params;

    if (!courtSystemId || !filingType) {
      throw new HttpError(400, 'Court System ID and Filing Type are required');
    }

    const courtSystem = await courtIntegrationService.getCourtSystem(courtSystemId);
    
    // Get required forms for this filing type
    const requiredForms = courtIntegrationService.getRequiredForms(courtSystem, filingType);

    // Get available templates for these forms
    const { data: availableTemplates, error } = await supabase
      .from('document_templates')
      .select('*')
      .in('type', requiredForms)
      .eq('category', 'court_form')
      .eq('is_active', true);

    if (error) {
      throw new HttpError(500, 'Failed to retrieve required documents');
    }

    res.json({
      success: true,
      message: 'Required documents retrieved successfully',
      data: {
        courtSystem: courtSystem.name,
        filingType,
        requiredForms,
        availableTemplates: availableTemplates || [],
        missingTemplates: requiredForms.filter(form => 
          !availableTemplates?.some(template => template.type === form)
        )
      }
    });
  });

  // Download filing package
  downloadFilingPackage = asyncHandler(async (req, res) => {
    const { filingId } = req.params;

    if (!filingId) {
      throw new HttpError(400, 'Filing ID is required');
    }

    const filing = await courtIntegrationService.getFilingStatus(filingId);
    if (!filing) {
      throw new HttpError(404, 'Filing not found');
    }

    if (!filing.package_path) {
      throw new HttpError(404, 'Filing package not found');
    }

    try {
      const fs = require('fs');
      
      // Check if file exists
      if (!fs.existsSync(filing.package_path)) {
        throw new HttpError(404, 'Filing package file not found');
      }

      // Set appropriate headers
      const fileName = `filing_package_${filing.id}.zip`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      
      // Stream the file
      const fileBuffer = fs.readFileSync(filing.package_path);
      res.send(fileBuffer);
      
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to download filing package');
    }
  });

  // Get filing statistics
  getFilingStatistics = asyncHandler(async (req, res) => {
    const { courtSystemId, timeframe = '30d' } = req.query;
    
    let dateFilter = new Date();
    switch (timeframe) {
      case '7d':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      case '90d':
        dateFilter.setDate(dateFilter.getDate() - 90);
        break;
      case '1y':
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
        break;
      default:
        dateFilter.setDate(dateFilter.getDate() - 30);
    }

    let query = supabase
      .from('court_filings')
      .select('*')
      .gte('filing_date', dateFilter.toISOString());

    if (courtSystemId) {
      query = query.eq('court_system_id', courtSystemId);
    }

    const { data: filings, error } = await query;

    if (error) {
      throw new HttpError(500, 'Failed to fetch filing statistics');
    }

    // Calculate statistics
    const stats = {
      total_filings: filings.length,
      by_status: {},
      by_type: {},
      by_court_system: {},
      expedited_filings: 0,
      average_processing_time: 0,
      recent_activity: []
    };

    filings.forEach(filing => {
      // By status
      stats.by_status[filing.filing_status] = (stats.by_status[filing.filing_status] || 0) + 1;
      
      // By type
      stats.by_type[filing.filing_type] = (stats.by_type[filing.filing_type] || 0) + 1;
      
      // By court system
      stats.by_court_system[filing.court_system_id] = (stats.by_court_system[filing.court_system_id] || 0) + 1;
      
      // Expedited filings
      if (filing.expedited) {
        stats.expedited_filings++;
      }
    });

    // Recent activity (last 10 filings)
    stats.recent_activity = filings
      .sort((a, b) => new Date(b.filing_date) - new Date(a.filing_date))
      .slice(0, 10)
      .map(filing => ({
        id: filing.id,
        filingType: filing.filing_type,
        status: filing.filing_status,
        filingDate: filing.filing_date,
        expedited: filing.expedited
      }));

    res.json({
      success: true,
      message: 'Filing statistics retrieved successfully',
      data: {
        timeframe,
        courtSystemId: courtSystemId || 'all',
        statistics: stats
      }
    });
  });

  // Service health check
  healthCheck = asyncHandler(async (req, res) => {
    const health = await courtIntegrationService.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  });
}

module.exports = new CourtController();