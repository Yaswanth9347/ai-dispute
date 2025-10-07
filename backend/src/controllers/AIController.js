// AI Controller - RESTful API endpoints for AI analysis features
const AIAnalysisService = require('../services/AIAnalysisService');
const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');

class AIController {
  // POST /api/ai/analyze-case/:caseId
  analyzeCase = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await AIAnalysisService.analyzeCase(caseId, userId);

    if (!result.success) {
      throw new HttpError(500, result.error || 'Case analysis failed');
    }

    res.status(200).json({
      success: true,
      message: 'Case analysis completed successfully',
      data: {
        analysis_id: result.analysis_id,
        analysis_data: result.analysis_data,
        metadata: result.metadata
      }
    });
  });

  // POST /api/ai/settlement-proposals/:caseId
  generateSettlementProposals = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;
    const preferences = req.body.preferences || {};

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await AIAnalysisService.generateSettlementProposals(caseId, userId, preferences);

    if (!result.success) {
      throw new HttpError(500, result.error || 'Settlement proposal generation failed');
    }

    res.status(200).json({
      success: true,
      message: `Generated ${result.proposals.length} settlement proposals`,
      data: {
        proposals: result.proposals,
        ai_insights: result.ai_insights,
        case_id: result.case_id
      }
    });
  });

  // POST /api/ai/analyze-evidence/:evidenceId
  analyzeEvidence = asyncHandler(async (req, res) => {
    const { evidenceId } = req.params;
    const userId = req.user.id;

    if (!evidenceId) {
      throw new HttpError(400, 'Evidence ID is required');
    }

    const result = await AIAnalysisService.analyzeEvidence(evidenceId, userId);

    if (!result.success) {
      throw new HttpError(500, result.error || 'Evidence analysis failed');
    }

    res.status(200).json({
      success: true,
      message: 'Evidence analysis completed successfully',
      data: {
        analysis_id: result.analysis_id,
        evidence_analysis: result.evidence_analysis,
        evidence_id: result.evidence_id
      }
    });
  });

  // POST /api/ai/legal-research/:caseId
  conductLegalResearch = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;
    const { research_query } = req.body;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await AIAnalysisService.conductLegalResearch(caseId, userId, research_query);

    if (!result.success) {
      throw new HttpError(500, result.error || 'Legal research failed');
    }

    res.status(200).json({
      success: true,
      message: 'Legal research completed successfully',
      data: {
        analysis_id: result.analysis_id,
        research_data: result.research_data,
        case_id: result.case_id
      }
    });
  });

  // POST /api/ai/risk-assessment/:caseId
  assessRisks = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await AIAnalysisService.assessRisks(caseId, userId);

    if (!result.success) {
      throw new HttpError(500, result.error || 'Risk assessment failed');
    }

    res.status(200).json({
      success: true,
      message: 'Risk assessment completed successfully',
      data: {
        analysis_id: result.analysis_id,
        risk_assessment: result.risk_assessment,
        case_id: result.case_id
      }
    });
  });

  // GET /api/ai/analyses/:caseId
  getCaseAnalyses = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await AIAnalysisService.getCaseAnalyses(caseId, userId);

    if (!result.success) {
      throw new HttpError(500, result.error || 'Failed to retrieve case analyses');
    }

    res.status(200).json({
      success: true,
      message: `Retrieved ${result.count} analyses for case ${caseId}`,
      data: {
        analyses: result.analyses,
        case_id: result.case_id,
        count: result.count
      }
    });
  });

  // POST /api/ai/bulk-analyze
  bulkAnalyze = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { case_ids, analysis_types } = req.body;

    if (!case_ids || !Array.isArray(case_ids) || case_ids.length === 0) {
      throw new HttpError(400, 'case_ids array is required');
    }

    if (!analysis_types || !Array.isArray(analysis_types) || analysis_types.length === 0) {
      throw new HttpError(400, 'analysis_types array is required');
    }

    const validAnalysisTypes = ['case_analysis', 'risk_assessment', 'legal_research'];
    const invalidTypes = analysis_types.filter(type => !validAnalysisTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      throw new HttpError(400, `Invalid analysis types: ${invalidTypes.join(', ')}`);
    }

    const results = [];

    for (const caseId of case_ids) {
      const caseResults = { case_id: caseId, analyses: {} };

      for (const analysisType of analysis_types) {
        try {
          let result;

          switch (analysisType) {
            case 'case_analysis':
              result = await AIAnalysisService.analyzeCase(caseId, userId);
              break;
            case 'risk_assessment':
              result = await AIAnalysisService.assessRisks(caseId, userId);
              break;
            case 'legal_research':
              result = await AIAnalysisService.conductLegalResearch(caseId, userId);
              break;
          }

          caseResults.analyses[analysisType] = {
            success: result.success,
            analysis_id: result.analysis_id,
            error: result.error
          };

        } catch (error) {
          caseResults.analyses[analysisType] = {
            success: false,
            error: error.message
          };
        }
      }

      results.push(caseResults);
    }

    const successCount = results.reduce((count, result) => {
      return count + Object.values(result.analyses).filter(analysis => analysis.success).length;
    }, 0);

    const totalCount = case_ids.length * analysis_types.length;

    res.status(200).json({
      success: true,
      message: `Bulk analysis completed: ${successCount}/${totalCount} analyses successful`,
      data: {
        results,
        summary: {
          total_cases: case_ids.length,
          analysis_types: analysis_types,
          successful_analyses: successCount,
          total_analyses: totalCount,
          success_rate: Math.round((successCount / totalCount) * 100)
        }
      }
    });
  });

  // GET /api/ai/analysis/:analysisId
  getAnalysisById = asyncHandler(async (req, res) => {
    const { analysisId } = req.params;
    const userId = req.user.id;

    if (!analysisId) {
      throw new HttpError(400, 'Analysis ID is required');
    }

    // Import AIAnalysis model to fetch specific analysis
    const AIAnalysis = require('../models/AIAnalysis');
    const Case = require('../models/Case');

    const analysis = await AIAnalysis.findById(analysisId);

    if (!analysis) {
      throw new HttpError(404, 'Analysis not found');
    }

    // Check access to the case
    if (!await Case.hasAccess(analysis.case_id, userId)) {
      throw new HttpError(403, 'Access denied to this analysis');
    }

    res.status(200).json({
      success: true,
      message: 'Analysis retrieved successfully',
      data: {
        analysis
      }
    });
  });

  // POST /api/ai/reanalyze/:analysisId
  reAnalyze = asyncHandler(async (req, res) => {
    const { analysisId } = req.params;
    const userId = req.user.id;

    if (!analysisId) {
      throw new HttpError(400, 'Analysis ID is required');
    }

    // Import required models
    const AIAnalysis = require('../models/AIAnalysis');
    const Case = require('../models/Case');

    const originalAnalysis = await AIAnalysis.findById(analysisId);

    if (!originalAnalysis) {
      throw new HttpError(404, 'Original analysis not found');
    }

    // Check access
    if (!await Case.hasAccess(originalAnalysis.case_id, userId)) {
      throw new HttpError(403, 'Access denied to this analysis');
    }

    let result;

    // Re-run the same type of analysis
    switch (originalAnalysis.analysis_type) {
      case 'case_analysis':
        result = await AIAnalysisService.analyzeCase(originalAnalysis.case_id, userId);
        break;
      case 'risk_assessment':
        result = await AIAnalysisService.assessRisks(originalAnalysis.case_id, userId);
        break;
      case 'legal_research':
        result = await AIAnalysisService.conductLegalResearch(originalAnalysis.case_id, userId);
        break;
      case 'evidence_analysis':
        if (originalAnalysis.evidence_id) {
          result = await AIAnalysisService.analyzeEvidence(originalAnalysis.evidence_id, userId);
        } else {
          throw new HttpError(400, 'Cannot re-analyze evidence analysis without evidence ID');
        }
        break;
      default:
        throw new HttpError(400, `Unsupported analysis type for re-analysis: ${originalAnalysis.analysis_type}`);
    }

    if (!result.success) {
      throw new HttpError(500, result.error || 'Re-analysis failed');
    }

    res.status(200).json({
      success: true,
      message: 'Re-analysis completed successfully',
      data: {
        new_analysis_id: result.analysis_id,
        original_analysis_id: analysisId,
        analysis_type: originalAnalysis.analysis_type,
        case_id: originalAnalysis.case_id
      }
    });
  });

  // GET /api/ai/health
  healthCheck = asyncHandler(async (req, res) => {
    const healthStatus = await AIAnalysisService.healthCheck();

    const httpStatus = healthStatus.status === 'operational' ? 200 : 503;

    res.status(httpStatus).json({
      success: healthStatus.status === 'operational',
      message: `AI service is ${healthStatus.status}`,
      data: healthStatus
    });
  });
}

module.exports = new AIController();