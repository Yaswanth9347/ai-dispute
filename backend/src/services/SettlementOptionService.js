// Settlement Option Service - AI-powered settlement option generation
const { supabase } = require('../lib/supabaseClient');
const { logger } = require('../lib/logger');
const { v4: uuidv4 } = require('uuid');
const GeminiService = require('./GeminiService');
const Case = require('../models/Case');
const StatementService = require('./StatementService');

class SettlementOptionService {
  // Generate AI settlement options
  async generateSettlementOptions(caseId, userId) {
    try {
      logger.info(`Generating settlement options for case ${caseId}`);

      // Verify case access
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied to this case');
      }

      // Get case details
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      // Get all finalized statements
      const statementsResult = await StatementService.getCaseStatements(caseId, userId);
      if (!statementsResult.success || statementsResult.statements.length < 2) {
        throw new Error('Need statements from both parties before generating options');
      }

      // Get evidence
      const { data: evidence } = await supabase
        .from('evidence')
        .select('*')
        .eq('case_id', caseId);

      // Build comprehensive prompt for Gemini
      const prompt = this.buildSettlementPrompt(caseData, statementsResult.statements, evidence || []);

      // Generate options using Gemini AI
      const aiResponse = await GeminiService.generateResponse(prompt, {
        temperature: 0.4,
        maxOutputTokens: 4000
      });

      if (!aiResponse.success) {
        throw new Error(`AI generation failed: ${aiResponse.error}`);
      }

      // Parse AI response
      const options = this.parseAIOptions(aiResponse.content, caseData);

      // Store options in database
      const savedOptions = await this.saveOptions(caseId, options, aiResponse);

      // Transition workflow
      const DisputeWorkflowService = require('./DisputeWorkflowService');
      await DisputeWorkflowService.transitionStage(
        caseId,
        DisputeWorkflowService.DisputeStage.OPTIONS_PRESENTED,
        userId,
        'AI generated 3 settlement options'
      );

      logger.info(`Generated ${savedOptions.length} settlement options for case ${caseId}`);

      return {
        success: true,
        options: savedOptions,
        analysisId: savedOptions[0]?.analysis_id
      };

    } catch (error) {
      logger.error(`Failed to generate settlement options:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Build AI prompt for settlement generation
  buildSettlementPrompt(caseData, statements, evidence) {
    const complainantStatement = statements.find(s => s.party_role === 'claimant') || statements[0];
    const respondentStatement = statements.find(s => s.party_role === 'respondent') || statements[1];

    return `You are an AI mediator specializing in civil dispute resolution under Indian law.

**CASE DETAILS:**
- Case ID: ${caseData.id}
- Title: ${caseData.title}
- Type: ${caseData.case_type || 'Civil Dispute'}
- Jurisdiction: ${caseData.jurisdiction || 'India'}
- Dispute Amount: ₹${caseData.dispute_amount || 'Not specified'}
- Filed Date: ${caseData.created_at}

**COMPLAINANT'S STATEMENT:**
${complainantStatement?.content || 'No statement provided'}

**RESPONDENT'S STATEMENT:**
${respondentStatement?.content || 'No statement provided'}

**EVIDENCE SUMMARY:**
${evidence.length > 0 ? evidence.map((e, i) => `${i + 1}. ${e.file_name}: ${e.metadata?.description || 'No description'}`).join('\n') : 'No evidence provided'}

**YOUR TASK:**
Generate exactly 3 fair settlement options that comply with Indian law and Alternative Dispute Resolution (ADR) principles. Each option should reference relevant Indian legal provisions.

**LEGAL FRAMEWORK TO CONSIDER:**
- Indian Constitution: Articles 14 (Equality), 19 (Fundamental Rights), 21 (Right to Life and Personal Liberty)
- Civil Procedure Code (CPC) - Order X Rule 1A, 1B (Settlement)
- Arbitration and Conciliation Act, 1996
- Consumer Protection Act, 2019 (if applicable)
- Contract Act, 1872 (if contract dispute)
- Negotiable Instruments Act, 1881 (if cheque bounce/payment)

**REQUIRED FORMAT (JSON):**
Return ONLY a valid JSON object with this exact structure:

{
  "options": [
    {
      "rank": 1,
      "title": "Conservative Settlement Option",
      "summary": "Brief one-line summary",
      "detailedRationale": "Comprehensive explanation of this settlement approach",
      "legalBasis": {
        "constitutionalArticles": ["Article 14", "Article 21"],
        "civilLaws": ["CPC Order X Rule 1A", "Arbitration and Conciliation Act Section 73"],
        "precedents": ["Optional: Relevant case law"]
      },
      "fairnessScore": 85,
      "settlementAmount": 50000,
      "currency": "INR",
      "paymentTerms": "Lump sum within 30 days / 3 monthly installments",
      "nonMonetaryTerms": [
        "Written apology",
        "Public statement retraction"
      ],
      "implications": {
        "forComplainant": "What complainant gains and gives up",
        "forRespondent": "What respondent gains and gives up"
      },
      "conditions": [
        "Condition 1",
        "Condition 2"
      ],
      "timeline": "30 days from acceptance",
      "enforcementMechanism": "How to enforce this settlement",
      "estimatedAcceptanceProbability": 70
    },
    {
      "rank": 2,
      "title": "Balanced Settlement Option",
      "summary": "...",
      "detailedRationale": "...",
      "legalBasis": {...},
      "fairnessScore": 90,
      "settlementAmount": 75000,
      "currency": "INR",
      "paymentTerms": "...",
      "nonMonetaryTerms": [...],
      "implications": {...},
      "conditions": [...],
      "timeline": "...",
      "enforcementMechanism": "...",
      "estimatedAcceptanceProbability": 80
    },
    {
      "rank": 3,
      "title": "Aggressive Settlement Option",
      "summary": "...",
      "detailedRationale": "...",
      "legalBasis": {...},
      "fairnessScore": 75,
      "settlementAmount": 100000,
      "currency": "INR",
      "paymentTerms": "...",
      "nonMonetaryTerms": [...],
      "implications": {...},
      "conditions": [...],
      "timeline": "...",
      "enforcementMechanism": "...",
      "estimatedAcceptanceProbability": 60
    }
  ],
  "overallAnalysis": "Brief analysis of the dispute and settlement approach",
  "recommendedOption": 2,
  "aiConfidence": 0.85
}

**IMPORTANT:**
- Option 1 (Conservative): Lower amount, quicker resolution, lower risk
- Option 2 (Balanced): Fair middle ground, highest acceptance probability
- Option 3 (Aggressive): Higher amount, more favorable to complainant
- All amounts should be in Indian Rupees (INR)
- Fairness score: 0-100 (higher = more fair to both parties)
- Acceptance probability: 0-100 (realistic estimate)
- Legal basis MUST cite actual Indian laws
- Consider cultural and social context of India

Return ONLY the JSON object, no other text.`;
  }

  // Parse AI response and extract options
  parseAIOptions(aiContent, caseData) {
    try {
      // Remove markdown code blocks if present
      let jsonContent = aiContent.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const parsed = JSON.parse(jsonContent);
      
      if (!parsed.options || !Array.isArray(parsed.options)) {
        throw new Error('Invalid AI response format');
      }

      // Validate and normalize options
      return parsed.options.map((opt, idx) => ({
        rank: opt.rank || (idx + 1),
        title: opt.title || `Settlement Option ${idx + 1}`,
        summary: opt.summary || '',
        detailedRationale: opt.detailedRationale || opt.detailed_rationale || '',
        legalBasis: opt.legalBasis || opt.legal_basis || {},
        fairnessScore: opt.fairnessScore || opt.fairness_score || 50,
        settlementAmount: opt.settlementAmount || opt.settlement_amount || 0,
        currency: opt.currency || 'INR',
        paymentTerms: opt.paymentTerms || opt.payment_terms || 'To be decided',
        nonMonetaryTerms: opt.nonMonetaryTerms || opt.non_monetary_terms || [],
        implications: opt.implications || {},
        conditions: opt.conditions || [],
        timeline: opt.timeline || '30 days',
        enforcementMechanism: opt.enforcementMechanism || opt.enforcement_mechanism || 'Legal contract',
        estimatedAcceptanceProbability: opt.estimatedAcceptanceProbability || opt.estimated_acceptance_probability || 50,
        overallAnalysis: parsed.overallAnalysis || parsed.overall_analysis || '',
        aiConfidence: parsed.aiConfidence || parsed.ai_confidence || 0.7
      }));

    } catch (error) {
      logger.error('Failed to parse AI options:', error);
      // Return fallback generic options
      return this.getFallbackOptions(caseData);
    }
  }

  // Fallback options if AI fails
  getFallbackOptions(caseData) {
    const amount = caseData.dispute_amount || 50000;
    
    return [
      {
        rank: 1,
        title: 'Conservative Settlement',
        summary: 'Quick resolution with reduced amount',
        detailedRationale: 'Settlement at reduced amount for quick resolution',
        legalBasis: {
          constitutionalArticles: ['Article 14'],
          civilLaws: ['CPC Order X Rule 1A'],
          precedents: []
        },
        fairnessScore: 70,
        settlementAmount: Math.round(amount * 0.5),
        currency: 'INR',
        paymentTerms: 'Lump sum within 30 days',
        nonMonetaryTerms: [],
        implications: {
          forComplainant: 'Receives 50% of claimed amount quickly',
          forRespondent: 'Pays less, resolves dispute quickly'
        },
        conditions: ['Full and final settlement', 'No admission of liability'],
        timeline: '30 days',
        enforcementMechanism: 'Legal settlement agreement',
        estimatedAcceptanceProbability: 70
      },
      {
        rank: 2,
        title: 'Balanced Settlement',
        summary: 'Fair compromise for both parties',
        detailedRationale: 'Balanced settlement considering both positions',
        legalBasis: {
          constitutionalArticles: ['Article 14', 'Article 21'],
          civilLaws: ['Arbitration and Conciliation Act Section 73'],
          precedents: []
        },
        fairnessScore: 85,
        settlementAmount: Math.round(amount * 0.75),
        currency: 'INR',
        paymentTerms: '3 monthly installments',
        nonMonetaryTerms: [],
        implications: {
          forComplainant: 'Receives 75% of claimed amount',
          forRespondent: 'Payment in installments reduces burden'
        },
        conditions: ['Full and final settlement', 'Installment payment plan'],
        timeline: '90 days',
        enforcementMechanism: 'Legal settlement agreement with payment schedule',
        estimatedAcceptanceProbability: 80
      },
      {
        rank: 3,
        title: 'Full Settlement',
        summary: 'Complete resolution with full amount',
        detailedRationale: 'Full settlement amount with additional terms',
        legalBasis: {
          constitutionalArticles: ['Article 14'],
          civilLaws: ['Contract Act Section 73'],
          precedents: []
        },
        fairnessScore: 60,
        settlementAmount: amount,
        currency: 'INR',
        paymentTerms: 'Lump sum within 60 days',
        nonMonetaryTerms: [],
        implications: {
          forComplainant: 'Receives full claimed amount',
          forRespondent: 'Pays full amount but avoids court costs'
        },
        conditions: ['Full and final settlement', 'Single payment'],
        timeline: '60 days',
        enforcementMechanism: 'Legal settlement agreement',
        estimatedAcceptanceProbability: 50
      }
    ];
  }

  // Save options to database
  async saveOptions(caseId, options, aiResponse) {
    try {
      const analysisId = uuidv4();
      const timestamp = new Date().toISOString();

      const dbOptions = options.map(opt => ({
        id: uuidv4(),
        case_id: caseId,
        analysis_id: analysisId,
        rank: opt.rank,
        title: opt.title,
        summary: opt.summary,
        detailed_rationale: opt.detailedRationale,
        legal_basis: JSON.stringify(opt.legalBasis),
        fairness_score: opt.fairnessScore,
        settlement_amount: opt.settlementAmount,
        currency: opt.currency,
        payment_terms: opt.paymentTerms,
        non_monetary_terms: JSON.stringify(opt.nonMonetaryTerms),
        implications: JSON.stringify(opt.implications),
        conditions: JSON.stringify(opt.conditions),
        timeline: opt.timeline,
        enforcement_mechanism: opt.enforcementMechanism,
        acceptance_probability: opt.estimatedAcceptanceProbability,
        ai_confidence: opt.aiConfidence || 0.7,
        generated_at: timestamp,
        status: 'active'
      }));

      const { data, error } = await supabase
        .from('settlement_options')
        .insert(dbOptions)
        .select();

      if (error) {
        throw new Error(`Failed to save options: ${error.message}`);
      }

      // Store AI analysis metadata
      await supabase
        .from('ai_settlement_analysis')
        .insert([{
          id: analysisId,
          case_id: caseId,
          model_used: 'gemini-2.0-flash',
          tokens_used: aiResponse.usage?.totalTokens || 0,
          overall_analysis: options[0]?.overallAnalysis || '',
          recommended_option: 2,
          confidence_score: options[0]?.aiConfidence || 0.7,
          generated_at: timestamp
        }]);

      return data;

    } catch (error) {
      logger.error('Failed to save settlement options:', error);
      throw error;
    }
  }

  // Get settlement options for a case
  async getSettlementOptions(caseId, userId) {
    try {
      // Verify access
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied');
      }

      const { data, error } = await supabase
        .from('settlement_options')
        .select('*')
        .eq('case_id', caseId)
        .eq('status', 'active')
        .order('rank', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch options: ${error.message}`);
      }

      // Parse JSON fields
      const options = data.map(opt => ({
        ...opt,
        legal_basis: JSON.parse(opt.legal_basis || '{}'),
        non_monetary_terms: JSON.parse(opt.non_monetary_terms || '[]'),
        implications: JSON.parse(opt.implications || '{}'),
        conditions: JSON.parse(opt.conditions || '[]')
      }));

      return {
        success: true,
        options
      };

    } catch (error) {
      logger.error('Failed to get settlement options:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Record party selection
  async selectOption(caseId, userId, optionId, comments = '') {
    try {
      logger.info(`User ${userId} selecting option ${optionId} for case ${caseId}`);

      // Verify option exists and belongs to case
      const { data: option, error: optError } = await supabase
        .from('settlement_options')
        .select('*')
        .eq('id', optionId)
        .eq('case_id', caseId)
        .single();

      if (optError || !option) {
        throw new Error('Invalid option');
      }

      // Record selection
      const selection = {
        id: uuidv4(),
        case_id: caseId,
        option_id: optionId,
        party_id: userId,
        selected_at: new Date().toISOString(),
        comments
      };

      const { data, error } = await supabase
        .from('party_option_selections')
        .insert([selection])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record selection: ${error.message}`);
      }

      // Check for consensus
      await this.checkConsensus(caseId);

      return {
        success: true,
        selection: data
      };

    } catch (error) {
      logger.error('Failed to select option:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check if parties reached consensus
  async checkConsensus(caseId) {
    try {
      const { data: selections, error } = await supabase
        .from('party_option_selections')
        .select('*')
        .eq('case_id', caseId)
        .order('selected_at', { ascending: false });

      if (error || !selections || selections.length < 2) {
        return { consensus: false, status: 'awaiting_selection' };
      }

      // Get latest selection from each party
      const latestSelections = {};
      selections.forEach(sel => {
        if (!latestSelections[sel.party_id]) {
          latestSelections[sel.party_id] = sel;
        }
      });

      const selectionArray = Object.values(latestSelections);
      
      if (selectionArray.length < 2) {
        return { consensus: false, status: 'awaiting_selection' };
      }

      const allSameOption = selectionArray.every(sel => sel.option_id === selectionArray[0].option_id);

      if (allSameOption) {
        // CONSENSUS REACHED
        const DisputeWorkflowService = require('./DisputeWorkflowService');
        await DisputeWorkflowService.transitionStage(
          caseId,
          DisputeWorkflowService.DisputeStage.CONSENSUS_REACHED,
          'system',
          `Both parties selected option: ${selectionArray[0].option_id}`
        );

        logger.info(`Consensus reached for case ${caseId}`);
        
        return { 
          consensus: true, 
          status: 'consensus_reached',
          agreedOptionId: selectionArray[0].option_id
        };
      } else {
        // DIFFERENT OPTIONS - Need re-analysis
        await this.generateCompromise(caseId, selectionArray);
        
        return { 
          consensus: false, 
          status: 'reanalysis_needed',
          selections: selectionArray
        };
      }

    } catch (error) {
      logger.error('Error checking consensus:', error);
      return { consensus: false, error: error.message };
    }
  }

  // Generate compromise when parties choose different options
  async generateCompromise(caseId, selections) {
    try {
      logger.info(`Generating compromise for case ${caseId}`);

      // Get the selected options
      const optionIds = selections.map(s => s.option_id);
      const { data: options } = await supabase
        .from('settlement_options')
        .select('*')
        .in('id', optionIds);

      if (!options || options.length < 2) {
        throw new Error('Could not find selected options');
      }

      // Build compromise prompt
      const prompt = `Two parties have selected different settlement options. Generate a compromise solution.

**OPTION 1 (Selected by Party 1):**
Title: ${options[0].title}
Amount: ₹${options[0].settlement_amount}
Terms: ${options[0].payment_terms}
Rationale: ${options[0].detailed_rationale}

**OPTION 2 (Selected by Party 2):**
Title: ${options[1].title}
Amount: ₹${options[1].settlement_amount}
Terms: ${options[1].payment_terms}
Rationale: ${options[1].detailed_rationale}

Generate a single compromise option that:
1. Bridges the gap between both positions (amount between ${options[0].settlement_amount} and ${options[1].settlement_amount})
2. Incorporates key elements from both choices
3. Maintains legal compliance under Indian law
4. Maximizes acceptance probability

Return in the same JSON format as before, but just ONE option.`;

      const aiResponse = await GeminiService.generateResponse(prompt, {
        temperature: 0.5,
        maxOutputTokens: 2000
      });

      if (!aiResponse.success) {
        throw new Error('Failed to generate compromise');
      }

      // Parse and save compromise option
      const compromiseOptions = this.parseAIOptions(aiResponse.content, { dispute_amount: 0 });
      const compromiseOption = compromiseOptions[0];
      compromiseOption.rank = 4; // Special rank for compromise
      compromiseOption.title = '🤝 AI-Generated Compromise';

      await this.saveOptions(caseId, [compromiseOption], aiResponse);

      // Transition to reanalysis stage
      const DisputeWorkflowService = require('./DisputeWorkflowService');
      await DisputeWorkflowService.transitionStage(
        caseId,
        DisputeWorkflowService.DisputeStage.REANALYSIS,
        'system',
        'AI generated compromise option'
      );

      logger.info(`Compromise generated for case ${caseId}`);

      return {
        success: true,
        compromise: compromiseOption
      };

    } catch (error) {
      logger.error('Failed to generate compromise:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SettlementOptionService();
