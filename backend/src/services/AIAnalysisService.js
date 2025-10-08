// AI Analysis Service - High-level AI operations for dispute resolution
const GeminiService = require('./GeminiService');
const AIAnalysis = require('../models/AIAnalysis');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const SettlementProposal = require('../models/SettlementProposal');
const { logger } = require('../lib/logger');

class AIAnalysisService {
  constructor() {
    this.gemini = GeminiService;
  }

  // Comprehensive case analysis with AI insights
  async analyzeCase(caseId, userId) {
    try {
      logger.info(`Starting AI analysis for case ${caseId}`);

      // Get case with all related data
      const caseData = await Case.findById(caseId, { 
        include: ['parties', 'evidence', 'statements'] 
      });

      if (!caseData) {
        throw new Error('Case not found');
      }

      // Check access permissions
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied to case');
      }

      // Generate AI analysis
      const aiResponse = await this.gemini.analyzeCaseContext(caseData);
      
      if (!aiResponse.success) {
        throw new Error(`AI analysis failed: ${aiResponse.error}`);
      }

      // Parse AI response (assuming JSON format)
      let analysisData;
      try {
        analysisData = JSON.parse(aiResponse.content);
      } catch (parseError) {
        // If JSON parsing fails, store raw content
        analysisData = {
          summary: aiResponse.content,
          confidence_score: 0.7,
          analysis_type: 'raw_text'
        };
      }

      // Save analysis to database
      const analysis = await AIAnalysis.create({
        case_id: caseId,
        analysis_type: 'case_analysis',
        ai_model: 'gemini-2.0-flash',
        input_data: {
          case_title: caseData.title,
          case_type: caseData.case_type,
          dispute_amount: caseData.dispute_amount,
          parties_count: caseData.parties?.length || 0,
          evidence_count: caseData.evidence?.length || 0
        },
        output_data: analysisData,
        confidence_score: analysisData.confidence_score || 0.8,
        processing_time: Date.now() - new Date().getTime(),
        created_by: userId,
        status: 'completed'
      });

      logger.info(`AI analysis completed for case ${caseId}, analysis ID: ${analysis.id}`);

      return {
        success: true,
        analysis_id: analysis.id,
        analysis_data: analysisData,
        metadata: {
          case_id: caseId,
          model_used: 'gemini-2.0-flash',
          confidence_score: analysisData.confidence_score || 0.8,
          created_at: analysis.created_at
        }
      };

    } catch (error) {
      logger.error(`AI case analysis failed for case ${caseId}:`, error);
      
      // Save failed analysis record
      await AIAnalysis.create({
        case_id: caseId,
        analysis_type: 'case_analysis',
        ai_model: 'gemini-2.0-flash',
        input_data: { case_id: caseId },
        output_data: { error: error.message },
        confidence_score: 0,
        status: 'failed',
        created_by: userId
      });

      return {
        success: false,
        error: error.message,
        case_id: caseId
      };
    }
  }

  // Generate settlement proposals with AI
  async generateSettlementProposals(caseId, userId, preferences = {}) {
    try {
      logger.info(`Generating settlement proposals for case ${caseId}`);

      // Get case data and latest analysis
      const caseData = await Case.findById(caseId, { 
        include: ['parties', 'evidence'] 
      });

      if (!caseData || !await Case.hasAccess(caseId, userId)) {
        throw new Error('Case not found or access denied');
      }

      // Get latest case analysis if available
      const latestAnalysis = await AIAnalysis.findOne({
        case_id: caseId,
        analysis_type: 'case_analysis',
        status: 'completed'
      }, { order: [['created_at', 'DESC']] });

      const analysisResult = latestAnalysis?.output_data || null;

      // Generate AI settlement proposals
      const aiResponse = await this.gemini.generateSettlementProposal(caseData, analysisResult);
      
      if (!aiResponse.success) {
        throw new Error(`Settlement generation failed: ${aiResponse.error}`);
      }

      // Parse proposals
      let proposalsData;
      try {
        proposalsData = JSON.parse(aiResponse.content);
      } catch (parseError) {
        throw new Error('Failed to parse AI settlement proposals');
      }

      // Save proposals to database
      const savedProposals = [];
      
      if (proposalsData.proposals && Array.isArray(proposalsData.proposals)) {
        for (const proposal of proposalsData.proposals) {
          const settlementProposal = await SettlementProposal.create({
            case_id: caseId,
            proposal_type: proposal.type || 'ai_generated',
            settlement_amount: proposal.settlement_amount || 0,
            currency: caseData.currency || 'USD',
            payment_terms: proposal.payment_terms || 'lump_sum',
            terms_conditions: proposal.terms_conditions || proposal.non_monetary_terms,
            acceptance_deadline: this.calculateDeadline(proposal.timeline),
            ai_confidence: proposal.likelihood || 0.75,
            ai_rationale: proposal.rationale,
            status: 'pending',
            created_by: userId
          });

          savedProposals.push(settlementProposal);
        }
      }

      // Save analysis record
      await AIAnalysis.create({
        case_id: caseId,
        analysis_type: 'settlement_proposals',
        ai_model: 'gemini-2.0-flash',
        input_data: {
          case_id: caseId,
          preferences,
          analysis_available: !!analysisResult
        },
        output_data: proposalsData,
        confidence_score: 0.8,
        status: 'completed',
        created_by: userId
      });

      logger.info(`Generated ${savedProposals.length} settlement proposals for case ${caseId}`);

      return {
        success: true,
        proposals: savedProposals,
        ai_insights: proposalsData,
        case_id: caseId
      };

    } catch (error) {
      logger.error(`Settlement generation failed for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message,
        case_id: caseId
      };
    }
  }

  // Analyze evidence using AI
  async analyzeEvidence(evidenceId, userId) {
    try {
      logger.info(`Starting AI evidence analysis for evidence ${evidenceId}`);

      // Get evidence data
      const evidence = await Evidence.findById(evidenceId);
      if (!evidence) {
        throw new Error('Evidence not found');
      }

      // Check case access
      if (!await Case.hasAccess(evidence.case_id, userId)) {
        throw new Error('Access denied to case');
      }

      // Generate AI analysis of evidence
      const aiResponse = await this.gemini.analyzeEvidence(evidence);
      
      if (!aiResponse.success) {
        throw new Error(`Evidence analysis failed: ${aiResponse.error}`);
      }

      // Parse analysis result
      let analysisData;
      try {
        analysisData = JSON.parse(aiResponse.content);
      } catch (parseError) {
        analysisData = {
          content_summary: aiResponse.content,
          analysis_type: 'raw_text'
        };
      }

      // Update evidence with AI analysis
      await Evidence.update(evidenceId, {
        ai_analysis: analysisData,
        ai_processed: true,
        ai_processed_at: new Date().toISOString()
      });

      // Save analysis record
      const analysis = await AIAnalysis.create({
        case_id: evidence.case_id,
        evidence_id: evidenceId,
        analysis_type: 'evidence_analysis',
        ai_model: 'gemini-2.0-flash',
        input_data: {
          evidence_id: evidenceId,
          file_name: evidence.file_name,
          mime_type: evidence.mime_type
        },
        output_data: analysisData,
        confidence_score: analysisData.confidence_score || 0.75,
        status: 'completed',
        created_by: userId
      });

      logger.info(`AI evidence analysis completed for evidence ${evidenceId}`);

      return {
        success: true,
        analysis_id: analysis.id,
        evidence_analysis: analysisData,
        evidence_id: evidenceId
      };

    } catch (error) {
      logger.error(`AI evidence analysis failed for evidence ${evidenceId}:`, error);
      return {
        success: false,
        error: error.message,
        evidence_id: evidenceId
      };
    }
  }

  // Legal research using AI
  async conductLegalResearch(caseId, userId, researchQuery = null) {
    try {
      logger.info(`Conducting legal research for case ${caseId}`);

      // Get case data
      const caseData = await Case.findById(caseId);
      if (!caseData || !await Case.hasAccess(caseId, userId)) {
        throw new Error('Case not found or access denied');
      }

      // Get latest analysis for legal issues
      const latestAnalysis = await AIAnalysis.findOne({
        case_id: caseId,
        analysis_type: 'case_analysis',
        status: 'completed'
      }, { order: [['created_at', 'DESC']] });

      const legalIssues = latestAnalysis?.output_data?.legal_issues || [researchQuery || 'General legal research'];

      // Conduct AI legal research
      const aiResponse = await this.gemini.legalResearch(
        caseData.case_type,
        caseData.jurisdiction,
        legalIssues
      );

      if (!aiResponse.success) {
        throw new Error(`Legal research failed: ${aiResponse.error}`);
      }

      // Parse research results
      let researchData;
      try {
        researchData = JSON.parse(aiResponse.content);
      } catch (parseError) {
        researchData = {
          research_summary: aiResponse.content,
          analysis_type: 'raw_text'
        };
      }

      // Save research analysis
      const analysis = await AIAnalysis.create({
        case_id: caseId,
        analysis_type: 'legal_research',
        ai_model: 'gemini-2.0-flash',
        input_data: {
          case_type: caseData.case_type,
          jurisdiction: caseData.jurisdiction,
          legal_issues: legalIssues,
          research_query: researchQuery
        },
        output_data: researchData,
        confidence_score: 0.85,
        status: 'completed',
        created_by: userId
      });

      logger.info(`Legal research completed for case ${caseId}`);

      return {
        success: true,
        analysis_id: analysis.id,
        research_data: researchData,
        case_id: caseId
      };

    } catch (error) {
      logger.error(`Legal research failed for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message,
        case_id: caseId
      };
    }
  }

  // Risk assessment using AI
  async assessRisks(caseId, userId) {
    try {
      logger.info(`Conducting risk assessment for case ${caseId}`);

      // Get case data
      const caseData = await Case.findById(caseId, { 
        include: ['evidence'] 
      });

      if (!caseData || !await Case.hasAccess(caseId, userId)) {
        throw new Error('Case not found or access denied');
      }

      // Calculate evidence strength score
      const evidenceCount = caseData.evidence?.length || 0;
      const processedEvidence = caseData.evidence?.filter(e => e.ai_processed).length || 0;
      const evidenceStrength = evidenceCount > 0 ? `${processedEvidence}/${evidenceCount} evidence processed` : 'No evidence';

      // Generate AI risk assessment
      const aiResponse = await this.gemini.assessRisks(caseData, evidenceStrength);
      
      if (!aiResponse.success) {
        throw new Error(`Risk assessment failed: ${aiResponse.error}`);
      }

      // Parse risk assessment
      let riskData;
      try {
        riskData = JSON.parse(aiResponse.content);
      } catch (parseError) {
        riskData = {
          risk_summary: aiResponse.content,
          analysis_type: 'raw_text'
        };
      }

      // Save risk analysis
      const analysis = await AIAnalysis.create({
        case_id: caseId,
        analysis_type: 'risk_assessment',
        ai_model: 'gemini-2.0-flash',
        input_data: {
          case_id: caseId,
          evidence_strength: evidenceStrength,
          dispute_amount: caseData.dispute_amount
        },
        output_data: riskData,
        confidence_score: 0.8,
        status: 'completed',
        created_by: userId
      });

      logger.info(`Risk assessment completed for case ${caseId}`);

      return {
        success: true,
        analysis_id: analysis.id,
        risk_assessment: riskData,
        case_id: caseId
      };

    } catch (error) {
      logger.error(`Risk assessment failed for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message,
        case_id: caseId
      };
    }
  }

  // Helper method to calculate deadline dates
  calculateDeadline(timelineText) {
    if (!timelineText) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const days = timelineText.match(/(\d+)\s*days?/i);
    const weeks = timelineText.match(/(\d+)\s*weeks?/i);
    const months = timelineText.match(/(\d+)\s*months?/i);

    let daysToAdd = 30; // default

    if (days) daysToAdd = parseInt(days[1]);
    else if (weeks) daysToAdd = parseInt(weeks[1]) * 7;
    else if (months) daysToAdd = parseInt(months[1]) * 30;

    return new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  // Get all AI analyses for a case
  async getCaseAnalyses(caseId, userId) {
    try {
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied to case');
      }

      const analyses = await AIAnalysis.findAll({
        case_id: caseId,
        status: 'completed'
      }, { 
        order: [['created_at', 'DESC']] 
      });

      return {
        success: true,
        analyses,
        case_id: caseId,
        count: analyses.length
      };

    } catch (error) {
      logger.error(`Failed to get case analyses for case ${caseId}:`, error);
      return {
        success: false,
        error: error.message,
        case_id: caseId
      };
    }
  }

  // AI service health check
  async healthCheck() {
    try {
      const geminiHealth = await this.gemini.healthCheck();
      
      return {
        service: 'AIAnalysisService',
        status: geminiHealth.status === 'healthy' ? 'operational' : 'degraded',
        gemini_status: geminiHealth.status,
        timestamp: new Date().toISOString(),
        capabilities: [
          'case_analysis',
          'settlement_proposals',
          'evidence_analysis',
          'legal_research',
          'risk_assessment'
        ]
      };
    } catch (error) {
      return {
        service: 'AIAnalysisService',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new AIAnalysisService();