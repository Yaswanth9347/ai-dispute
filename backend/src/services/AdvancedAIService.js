// Advanced AI Service - Phase 4 enhanced AI analysis and predictions
const logger = require('../lib/logger');
const { supabaseAdmin } = require('../lib/supabaseClient');
const geminiService = require('./GeminiService');
const aiAnalysisService = require('./AIAnalysisService');

class AdvancedAIService {
  constructor() {
    this.geminiService = geminiService;
    this.aiAnalysisService = aiAnalysisService;
    
    // AI Model configurations
    this.models = {
      OUTCOME_PREDICTION: 'gemini-2.0-flash-exp',
      PRECEDENT_MATCHING: 'gemini-2.0-flash-exp',
      RISK_ASSESSMENT: 'gemini-2.0-flash-exp',
      ENSEMBLE_ANALYSIS: 'gemini-2.0-flash-exp'
    };

    // Confidence thresholds
    this.confidenceThresholds = {
      HIGH: 0.85,
      MEDIUM: 0.65,
      LOW: 0.45
    };

    // Legal categories for Indian civil law
    this.legalCategories = [
      'contract_dispute',
      'property_dispute', 
      'consumer_complaint',
      'employment_dispute',
      'family_matter',
      'tort_claim',
      'commercial_dispute',
      'landlord_tenant',
      'debt_recovery',
      'insurance_claim'
    ];
  }

  /**
   * Perform advanced case analysis with multiple AI models
   */
  async performAdvancedAnalysis(caseId, options = {}) {
    try {
      logger.info('Starting advanced AI analysis', { caseId });

      // Get case details and evidence
      const caseData = await this.getCaseWithEvidence(caseId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      // Parallel analysis with multiple approaches
      const analysisPromises = [
        this.predictCaseOutcome(caseData),
        this.findLegalPrecedents(caseData),
        this.assessDisputeRisk(caseData),
        this.generateLegalStrategy(caseData)
      ];

      const [
        outcomeAnalysis,
        precedentAnalysis, 
        riskAssessment,
        strategyRecommendation
      ] = await Promise.all(analysisPromises);

      // Ensemble analysis - combine results
      const ensembleResult = await this.performEnsembleAnalysis({
        caseData,
        outcomeAnalysis,
        precedentAnalysis,
        riskAssessment,
        strategyRecommendation
      });

      // Save comprehensive analysis
      const analysisResult = await this.saveAdvancedAnalysis(caseId, {
        outcome_analysis: outcomeAnalysis,
        precedent_analysis: precedentAnalysis,
        risk_assessment: riskAssessment,
        strategy_recommendation: strategyRecommendation,
        ensemble_result: ensembleResult,
        analysis_timestamp: new Date().toISOString(),
        model_versions: this.models
      });

      logger.info('Advanced AI analysis completed', { 
        caseId, 
        analysisId: analysisResult.analysis_id 
      });

      return analysisResult;

    } catch (error) {
      logger.error('Error in advanced AI analysis:', error);
      throw error;
    }
  }

  /**
   * Predict case outcome using AI models
   */
  async predictCaseOutcome(caseData) {
    try {
      const prompt = `
As an expert legal AI analyzing Indian civil disputes, predict the likely outcome of this case:

CASE DETAILS:
Title: ${caseData.case_title}
Type: ${caseData.case_type}
Description: ${caseData.case_description}
Jurisdiction: ${caseData.jurisdiction}

EVIDENCE SUMMARY:
${caseData.evidence?.map(e => `- ${e.file_name}: ${e.analysis_summary || 'No analysis available'}`).join('\n') || 'No evidence available'}

ANALYSIS REQUIREMENTS:
1. Predict the most likely outcome (plaintiff success, defendant success, settlement, dismissal)
2. Provide confidence score (0-100%)
3. Key factors influencing the outcome
4. Potential settlement range (if applicable)
5. Timeline estimation for resolution
6. Strength of evidence assessment
7. Legal precedent relevance

Respond in JSON format:
{
  "predicted_outcome": "string",
  "confidence_score": number,
  "probability_breakdown": {
    "plaintiff_success": number,
    "defendant_success": number, 
    "settlement_likely": number,
    "case_dismissal": number
  },
  "key_factors": ["factor1", "factor2"],
  "settlement_range": {
    "min_amount": number,
    "max_amount": number,
    "currency": "INR"
  },
  "timeline_estimate": {
    "min_months": number,
    "max_months": number
  },
  "evidence_strength": "strong|moderate|weak",
  "legal_precedent_relevance": "high|medium|low",
  "reasoning": "detailed explanation"
}`;

      const response = await this.geminiService.generateContent(prompt);
      const result = this.parseJSONResponse(response);

      return {
        ...result,
        analysis_type: 'outcome_prediction',
        model_used: this.models.OUTCOME_PREDICTION,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error predicting case outcome:', error);
      throw error;
    }
  }

  /**
   * Find relevant legal precedents
   */
  async findLegalPrecedents(caseData) {
    try {
      const prompt = `
As a legal research AI specializing in Indian law, find relevant legal precedents for this case:

CASE DETAILS:
Title: ${caseData.case_title}
Type: ${caseData.case_type}
Description: ${caseData.case_description}
Jurisdiction: ${caseData.jurisdiction}

RESEARCH REQUIREMENTS:
1. Identify 3-5 most relevant Indian legal precedents
2. Include Supreme Court and High Court cases
3. Focus on similar fact patterns and legal issues
4. Provide case citations and brief summaries
5. Explain relevance to current case
6. Identify distinguishing factors
7. Extract applicable legal principles

Respond in JSON format:
{
  "precedents": [
    {
      "case_name": "string",
      "citation": "string", 
      "court": "string",
      "year": number,
      "facts_summary": "string",
      "legal_principle": "string",
      "relevance_score": number,
      "similar_factors": ["factor1", "factor2"],
      "distinguishing_factors": ["factor1", "factor2"],
      "outcome": "string"
    }
  ],
  "legal_principles": ["principle1", "principle2"],
  "applicable_statutes": ["statute1", "statute2"],
  "jurisdiction_specific_rules": ["rule1", "rule2"],
  "precedent_strength": "strong|moderate|weak",
  "research_confidence": number,
  "additional_research_needed": ["area1", "area2"]
}`;

      const response = await this.geminiService.generateContent(prompt);
      const result = this.parseJSONResponse(response);

      return {
        ...result,
        analysis_type: 'precedent_matching',
        model_used: this.models.PRECEDENT_MATCHING, 
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error finding legal precedents:', error);
      throw error;
    }
  }

  /**
   * Assess dispute risk factors
   */
  async assessDisputeRisk(caseData) {
    try {
      const prompt = `
As a legal risk assessment AI, analyze the risks associated with this dispute:

CASE DETAILS:
Title: ${caseData.case_title}
Type: ${caseData.case_type}
Description: ${caseData.case_description}
Jurisdiction: ${caseData.jurisdiction}

RISK ASSESSMENT AREAS:
1. Financial risks (costs, damages, fees)
2. Time and resource risks
3. Reputational risks
4. Legal precedent risks
5. Enforcement risks
6. Counter-claim risks
7. Settlement vs litigation risks

Respond in JSON format:
{
  "overall_risk_score": number,
  "risk_category": "low|medium|high|very_high",
  "financial_risks": {
    "estimated_legal_costs": {
      "min": number,
      "max": number,
      "currency": "INR"
    },
    "potential_damages": {
      "min": number,
      "max": number, 
      "currency": "INR"
    },
    "court_fees": number,
    "risk_level": "low|medium|high"
  },
  "time_risks": {
    "expected_duration_months": number,
    "complexity_delays": ["factor1", "factor2"],
    "court_backlog_impact": "low|medium|high"
  },
  "legal_risks": {
    "adverse_precedent_risk": "low|medium|high",
    "evidence_sufficiency": "strong|adequate|weak",
    "legal_complexity": "simple|moderate|complex",
    "jurisdiction_advantages": ["advantage1", "advantage2"]
  },
  "mitigation_strategies": [
    {
      "risk": "string",
      "mitigation": "string",
      "effectiveness": "high|medium|low"
    }
  ],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

      const response = await this.geminiService.generateContent(prompt);
      const result = this.parseJSONResponse(response);

      return {
        ...result,
        analysis_type: 'risk_assessment',
        model_used: this.models.RISK_ASSESSMENT,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error assessing dispute risk:', error);
      throw error;
    }
  }

  /**
   * Generate legal strategy recommendations
   */
  async generateLegalStrategy(caseData) {
    try {
      const prompt = `
As a strategic legal AI advisor, recommend the optimal legal strategy for this case:

CASE DETAILS:
Title: ${caseData.case_title}
Type: ${caseData.case_type}
Description: ${caseData.case_description}
Jurisdiction: ${caseData.jurisdiction}

STRATEGY ANALYSIS:
1. Litigation vs settlement analysis
2. Negotiation strategies and leverage points
3. Evidence strengthening recommendations
4. Procedural strategy options
5. Alternative dispute resolution suitability
6. Cost-benefit optimization
7. Timeline and milestone planning

Respond in JSON format:
{
  "recommended_strategy": "litigation|settlement|mediation|arbitration",
  "strategy_confidence": number,
  "primary_approach": {
    "strategy": "string",
    "rationale": "string",
    "success_probability": number,
    "estimated_cost": number,
    "estimated_timeline": "string"
  },
  "alternative_approaches": [
    {
      "strategy": "string",
      "pros": ["pro1", "pro2"],
      "cons": ["con1", "con2"],
      "success_probability": number
    }
  ],
  "negotiation_leverage": {
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "leverage_score": number
  },
  "evidence_recommendations": [
    {
      "evidence_type": "string",
      "importance": "critical|important|helpful",
      "collection_method": "string"
    }
  ],
  "settlement_strategy": {
    "optimal_timing": "string",
    "negotiation_points": ["point1", "point2"],
    "fallback_positions": ["position1", "position2"]
  },
  "procedural_steps": [
    {
      "step": "string",
      "timeline": "string",
      "importance": "critical|important|optional"
    }
  ]
}`;

      const response = await this.geminiService.generateContent(prompt);
      const result = this.parseJSONResponse(response);

      return {
        ...result,
        analysis_type: 'strategy_recommendation',
        model_used: this.models.ENSEMBLE_ANALYSIS,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error generating legal strategy:', error);
      throw error;
    }
  }

  /**
   * Perform ensemble analysis combining all individual analyses
   */
  async performEnsembleAnalysis(analysisData) {
    try {
      const prompt = `
As an ensemble AI system, synthesize these individual AI analyses into a comprehensive legal assessment:

INDIVIDUAL ANALYSES:
1. Outcome Prediction: ${JSON.stringify(analysisData.outcomeAnalysis, null, 2)}
2. Precedent Analysis: ${JSON.stringify(analysisData.precedentAnalysis, null, 2)}
3. Risk Assessment: ${JSON.stringify(analysisData.riskAssessment, null, 2)}
4. Strategy Recommendation: ${JSON.stringify(analysisData.strategyRecommendation, null, 2)}

ENSEMBLE SYNTHESIS REQUIREMENTS:
1. Resolve any conflicts between individual analyses
2. Weight the reliability of each analysis
3. Provide a unified recommendation
4. Identify areas of high confidence vs uncertainty
5. Generate executive summary for legal professionals
6. Create actionable next steps

Respond in JSON format:
{
  "ensemble_confidence": number,
  "unified_recommendation": {
    "primary_action": "string",
    "rationale": "string", 
    "confidence_level": "high|medium|low"
  },
  "analysis_consensus": {
    "areas_of_agreement": ["area1", "area2"],
    "areas_of_conflict": ["conflict1", "conflict2"],
    "conflict_resolution": "string"
  },
  "executive_summary": "string",
  "key_insights": ["insight1", "insight2"],
  "critical_factors": ["factor1", "factor2"],
  "next_steps": [
    {
      "action": "string",
      "priority": "high|medium|low",
      "timeline": "string",
      "responsible_party": "string"
    }
  ],
  "confidence_assessment": {
    "high_confidence_areas": ["area1", "area2"],
    "low_confidence_areas": ["area1", "area2"],
    "additional_analysis_needed": ["area1", "area2"]
  },
  "quality_score": number
}`;

      const response = await this.geminiService.generateContent(prompt);
      const result = this.parseJSONResponse(response);

      return {
        ...result,
        analysis_type: 'ensemble_analysis',
        model_used: this.models.ENSEMBLE_ANALYSIS,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error performing ensemble analysis:', error);
      throw error;
    }
  }

  /**
   * Get case data with evidence for analysis
   */
  async getCaseWithEvidence(caseId) {
    try {
      const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .select(`
          *,
          evidence (
            evidence_id,
            file_name,
            file_type,
            analysis_summary,
            created_at
          )
        `)
        .eq('id', caseId)
        .single();

      if (caseError) {
        throw new Error(`Failed to fetch case: ${caseError.message}`);
      }

      return caseData;

    } catch (error) {
      logger.error('Error fetching case with evidence:', error);
      throw error;
    }
  }

  /**
   * Save advanced analysis results
   */
  async saveAdvancedAnalysis(caseId, analysisData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('ai_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'advanced_analysis',
          analysis_result: analysisData,
          confidence_score: analysisData.ensemble_result?.ensemble_confidence || 0,
          model_version: 'phase4-advanced-v1.0',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save analysis: ${error.message}`);
      }

      return data;

    } catch (error) {
      logger.error('Error saving advanced analysis:', error);
      throw error;
    }
  }

  /**
   * Get historical case outcomes for pattern matching
   */
  async getHistoricalOutcomes(caseType, jurisdiction) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cases')
        .select('case_type, jurisdiction, status, created_at, ai_analysis(*)')
        .eq('case_type', caseType)
        .eq('jurisdiction', jurisdiction)
        .in('status', ['resolved', 'settled', 'dismissed'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(`Failed to fetch historical data: ${error.message}`);
      }

      return data;

    } catch (error) {
      logger.error('Error fetching historical outcomes:', error);
      throw error;
    }
  }

  /**
   * Parse JSON response from AI with error handling
   */
  parseJSONResponse(response) {
    try {
      // Clean the response text
      let jsonText = response.trim();
      
      // Remove code block markers if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      return JSON.parse(jsonText);
    } catch (error) {
      logger.error('Error parsing JSON response:', error);
      logger.error('Raw response:', response);
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  /**
   * Calculate ensemble confidence score
   */
  calculateEnsembleConfidence(analyses) {
    const confidenceScores = analyses
      .map(analysis => analysis.confidence_score || analysis.strategy_confidence || 0)
      .filter(score => score > 0);

    if (confidenceScores.length === 0) return 0;

    // Weighted average with penalty for disagreement
    const avgConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    const variance = confidenceScores.reduce((sum, score) => sum + Math.pow(score - avgConfidence, 2), 0) / confidenceScores.length;
    const disagreementPenalty = Math.min(variance / 100, 0.2); // Max 20% penalty

    return Math.max(0, avgConfidence - disagreementPenalty);
  }
}

module.exports = new AdvancedAIService();