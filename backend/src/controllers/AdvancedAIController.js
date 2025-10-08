// Advanced AI Controller - Phase 4 API endpoints for enhanced AI analysis
const logger = require('../lib/logger');
const AdvancedAIService = require('../services/AdvancedAIService');
const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');

class AdvancedAIController {
  constructor() {
    this.advancedAIService = AdvancedAIService;
  }

  /**
   * Perform comprehensive advanced AI analysis
   * POST /api/ai/advanced/analyze/:caseId
   */
  performAdvancedAnalysis = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { analysisType, options } = req.body;

    logger.info('Advanced AI analysis requested', { 
      caseId, 
      analysisType, 
      userId: req.user.sub 
    });

    // Validate case access
    await this.validateCaseAccess(caseId, req.user.sub);

    const analysisResult = await this.advancedAIService.performAdvancedAnalysis(
      caseId, 
      { ...options, userId: req.user.sub, analysisType }
    );

    res.json({
      success: true,
      data: {
        analysis_id: analysisResult.analysis_id,
        case_id: caseId,
        analysis_summary: {
          ensemble_confidence: analysisResult.analysis_result.ensemble_result?.ensemble_confidence,
          primary_recommendation: analysisResult.analysis_result.ensemble_result?.unified_recommendation,
          key_insights: analysisResult.analysis_result.ensemble_result?.key_insights,
          next_steps: analysisResult.analysis_result.ensemble_result?.next_steps
        },
        detailed_analysis: analysisResult.analysis_result,
        created_at: analysisResult.created_at
      }
    });
  });

  /**
   * Get case outcome prediction
   * POST /api/ai/advanced/predict-outcome/:caseId
   */
  predictCaseOutcome = asyncHandler(async (req, res) => {
    const { caseId } = req.params;

    logger.info('Case outcome prediction requested', { 
      caseId, 
      userId: req.user.sub 
    });

    await this.validateCaseAccess(caseId, req.user.sub);

    const caseData = await this.advancedAIService.getCaseWithEvidence(caseId);
    const outcomeAnalysis = await this.advancedAIService.predictCaseOutcome(caseData);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        prediction: outcomeAnalysis,
        generated_at: outcomeAnalysis.generated_at
      }
    });
  });

  /**
   * Find legal precedents
   * POST /api/ai/advanced/precedents/:caseId
   */
  findLegalPrecedents = asyncHandler(async (req, res) => {
    const { caseId } = req.params;

    logger.info('Legal precedent search requested', { 
      caseId, 
      userId: req.user.sub 
    });

    await this.validateCaseAccess(caseId, req.user.sub);

    const caseData = await this.advancedAIService.getCaseWithEvidence(caseId);
    const precedentAnalysis = await this.advancedAIService.findLegalPrecedents(caseData);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        precedents: precedentAnalysis,
        generated_at: precedentAnalysis.generated_at
      }
    });
  });

  /**
   * Assess dispute risks
   * POST /api/ai/advanced/risk-assessment/:caseId
   */
  assessDisputeRisk = asyncHandler(async (req, res) => {
    const { caseId } = req.params;

    logger.info('Risk assessment requested', { 
      caseId, 
      userId: req.user.sub 
    });

    await this.validateCaseAccess(caseId, req.user.sub);

    const caseData = await this.advancedAIService.getCaseWithEvidence(caseId);
    const riskAssessment = await this.advancedAIService.assessDisputeRisk(caseData);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        risk_assessment: riskAssessment,
        generated_at: riskAssessment.generated_at
      }
    });
  });

  /**
   * Generate legal strategy
   * POST /api/ai/advanced/strategy/:caseId
   */
  generateLegalStrategy = asyncHandler(async (req, res) => {
    const { caseId } = req.params;

    logger.info('Legal strategy generation requested', { 
      caseId, 
      userId: req.user.sub 
    });

    await this.validateCaseAccess(caseId, req.user.sub);

    const caseData = await this.advancedAIService.getCaseWithEvidence(caseId);
    const strategyRecommendation = await this.advancedAIService.generateLegalStrategy(caseData);

    res.json({
      success: true,
      data: {
        case_id: caseId,
        strategy: strategyRecommendation,
        generated_at: strategyRecommendation.generated_at
      }
    });
  });

  /**
   * Get historical case insights
   * GET /api/ai/advanced/insights/:caseType/:jurisdiction
   */
  getHistoricalInsights = asyncHandler(async (req, res) => {
    const { caseType, jurisdiction } = req.params;
    const { limit = 50, include_details = false } = req.query;

    logger.info('Historical insights requested', { 
      caseType, 
      jurisdiction, 
      userId: req.user.sub 
    });

    const historicalData = await this.advancedAIService.getHistoricalOutcomes(
      caseType, 
      jurisdiction
    );

    // Process historical data for insights
    const insights = this.processHistoricalInsights(historicalData, {
      limit: parseInt(limit),
      includeDetails: include_details === 'true'
    });

    res.json({
      success: true,
      data: {
        case_type: caseType,
        jurisdiction,
        insights,
        data_points: historicalData.length,
        generated_at: new Date().toISOString()
      }
    });
  });

  /**
   * Get advanced analysis history
   * GET /api/ai/advanced/history/:caseId
   */
  getAnalysisHistory = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { limit = 10, analysis_type } = req.query;

    logger.info('Analysis history requested', { 
      caseId, 
      userId: req.user.sub 
    });

    await this.validateCaseAccess(caseId, req.user.sub);

    const { data: analysisHistory, error } = await supabaseAdmin
      .from('ai_analysis')
      .select('*')
      .eq('case_id', caseId)
      .eq('analysis_type', analysis_type || 'advanced_analysis')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw new HttpError(500, 'database_error', 'Failed to fetch analysis history');
    }

    res.json({
      success: true,
      data: {
        case_id: caseId,
        analyses: analysisHistory,
        count: analysisHistory.length
      }
    });
  });

  /**
   * Compare multiple analysis results
   * POST /api/ai/advanced/compare
   */
  compareAnalyses = asyncHandler(async (req, res) => {
    const { analysis_ids, comparison_criteria } = req.body;

    if (!analysis_ids || analysis_ids.length < 2) {
      throw new HttpError(400, 'invalid_request', 'At least 2 analysis IDs required');
    }

    logger.info('Analysis comparison requested', { 
      analysisIds: analysis_ids, 
      userId: req.user.sub 
    });

    // Fetch all analyses
    const { data: analyses, error } = await supabaseAdmin
      .from('ai_analysis')
      .select('*')
      .in('analysis_id', analysis_ids);

    if (error) {
      throw new HttpError(500, 'database_error', 'Failed to fetch analyses');
    }

    // Validate access to all cases
    const caseIds = [...new Set(analyses.map(a => a.case_id))];
    await Promise.all(caseIds.map(caseId => this.validateCaseAccess(caseId, req.user.sub)));

    const comparison = this.generateAnalysisComparison(analyses, comparison_criteria);

    res.json({
      success: true,
      data: {
        comparison,
        analyses_compared: analyses.length,
        generated_at: new Date().toISOString()
      }
    });
  });

  /**
   * Get AI analysis statistics
   * GET /api/ai/advanced/statistics
   */
  getAnalysisStatistics = asyncHandler(async (req, res) => {
    const { time_period = '30d', case_type, jurisdiction } = req.query;

    logger.info('Analysis statistics requested', { 
      timePeriod: time_period,
      userId: req.user.sub 
    });

    const statistics = await this.generateAnalysisStatistics({
      timePeriod: time_period,
      caseType: case_type,
      jurisdiction,
      userId: req.user.sub
    });

    res.json({
      success: true,
      data: statistics
    });
  });

  // Helper Methods

  /**
   * Validate user access to case
   */
  async validateCaseAccess(caseId, userId) {
    const { supabaseAdmin } = require('../lib/supabaseClient');
    
    const { data: caseData, error } = await supabaseAdmin
      .from('cases')
      .select('filed_by')
      .eq('id', caseId)
      .single();

    if (error) {
      throw new HttpError(404, 'case_not_found', 'Case not found');
    }

    if (caseData.filed_by !== userId) {
      throw new HttpError(403, 'access_denied', 'Access denied to this case');
    }

    return true;
  }

  /**
   * Process historical data for insights
   */
  processHistoricalInsights(historicalData, options) {
    const insights = {
      total_cases: historicalData.length,
      outcome_distribution: {},
      average_resolution_time: 0,
      success_rates: {},
      confidence_trends: [],
      common_factors: []
    };

    if (historicalData.length === 0) return insights;

    // Calculate outcome distribution
    historicalData.forEach(caseData => {
      const status = caseData.status;
      insights.outcome_distribution[status] = (insights.outcome_distribution[status] || 0) + 1;
    });

    // Calculate success rates
    Object.keys(insights.outcome_distribution).forEach(outcome => {
      insights.success_rates[outcome] = 
        (insights.outcome_distribution[outcome] / historicalData.length * 100).toFixed(2);
    });

    // Calculate average resolution time (if data available)
    const casesWithDates = historicalData.filter(c => c.created_at);
    if (casesWithDates.length > 0) {
      const totalDays = casesWithDates.reduce((sum, caseData) => {
        const createdDate = new Date(caseData.created_at);
        const resolvedDate = new Date(); // Simplified - should use actual resolution date
        const daysDiff = Math.floor((resolvedDate - createdDate) / (1000 * 60 * 60 * 24));
        return sum + daysDiff;
      }, 0);
      insights.average_resolution_time = Math.floor(totalDays / casesWithDates.length);
    }

    return insights;
  }

  /**
   * Generate comparison between multiple analyses
   */
  generateAnalysisComparison(analyses, criteria) {
    const comparison = {
      summary: {
        total_analyses: analyses.length,
        date_range: {
          earliest: Math.min(...analyses.map(a => new Date(a.created_at).getTime())),
          latest: Math.max(...analyses.map(a => new Date(a.created_at).getTime()))
        }
      },
      confidence_comparison: {},
      outcome_predictions: {},
      risk_assessments: {},
      strategy_recommendations: {},
      trend_analysis: {}
    };

    analyses.forEach((analysis, index) => {
      const result = analysis.analysis_result;
      
      // Extract confidence scores
      if (result.ensemble_result?.ensemble_confidence) {
        comparison.confidence_comparison[`analysis_${index + 1}`] = 
          result.ensemble_result.ensemble_confidence;
      }

      // Extract outcome predictions
      if (result.outcome_analysis?.predicted_outcome) {
        comparison.outcome_predictions[`analysis_${index + 1}`] = {
          outcome: result.outcome_analysis.predicted_outcome,
          confidence: result.outcome_analysis.confidence_score
        };
      }

      // Extract risk scores
      if (result.risk_assessment?.overall_risk_score) {
        comparison.risk_assessments[`analysis_${index + 1}`] = {
          risk_score: result.risk_assessment.overall_risk_score,
          risk_category: result.risk_assessment.risk_category
        };
      }
    });

    return comparison;
  }

  /**
   * Generate analysis statistics
   */
  async generateAnalysisStatistics(options) {
    // This would typically query the database for statistics
    // Simplified implementation for now
    return {
      period: options.timePeriod,
      total_analyses: 0,
      average_confidence: 0,
      most_common_outcomes: [],
      analysis_trends: [],
      user_id: options.userId
    };
  }
}

module.exports = AdvancedAIController;