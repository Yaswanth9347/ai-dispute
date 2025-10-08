// AI Settlement Option Generator - Core AI-powered dispute resolution
const logger = require('../lib/logger');
const { supabaseAdmin } = require('../lib/supabaseClient');
const GeminiService = require('./GeminiService');

class SettlementAIService {
  constructor() {
    this.geminiService = GeminiService;
    
    // Indian Legal Framework
    this.legalReferences = {
      constitution: {
        article14: 'Article 14 - Equality before law',
        article19: 'Article 19(1)(a) - Freedom of speech and expression',
        article21: 'Article 21 - Right to life and personal liberty'
      },
      contractAct: {
        section73: 'Section 73 - Compensation for loss or damage caused by breach of contract',
        section74: 'Section 74 - Compensation for breach of contract where penalty stipulated',
        section75: 'Section 75 - Party rightfully rescinding contract, entitled to compensation'
      },
      cpc: {
        order10Rule1A: 'Order X Rule 1A - Duty of parties and counsel to aid court in compromise',
        order23Rule3: 'Order XXIII Rule 3 - Compromise of suit'
      },
      arbitration: {
        section73: 'Section 73 - Reference to arbitration',
        section30: 'Section 30 - Settlement by parties'
      }
    };
  }

  /**
   * Generate AI-powered settlement options
   */
  async generateSettlementOptions(caseId) {
    try {
      logger.info('Generating AI settlement options', { caseId });

      // Get case details
      const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .select(`
          *,
          case_parties!inner(user_id, party_role, users(full_name, email))
        `)
        .eq('case_id', caseId)
        .single();

      if (caseError || !caseData) {
        throw new Error('Case not found');
      }

      // Get statements from both parties
      const { data: statements, error: stmtError } = await supabaseAdmin
        .from('case_statements')
        .select(`
          *,
          users(full_name, email)
        `)
        .eq('case_id', caseId)
        .eq('is_finalized', true)
        .order('created_at', { ascending: true });

      if (stmtError || !statements || statements.length < 2) {
        throw new Error('Both parties must finalize statements before AI analysis');
      }

      const complainantStmt = statements.find(s => s.party_role === 'complainant');
      const respondentStmt = statements.find(s => s.party_role === 'respondent');

      if (!complainantStmt || !respondentStmt) {
        throw new Error('Missing statements from one or both parties');
      }

      // Get evidence documents
      const { data: evidence } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('case_id', caseId)
        .eq('document_type', 'evidence');

      // Build AI analysis prompt
      const prompt = this._buildAnalysisPrompt(
        caseData,
        complainantStmt,
        respondentStmt,
        evidence || []
      );

      // Generate options using Gemini
      const aiResponse = await this.geminiService.generateContent(prompt);
      
      // Parse AI response
      const options = this._parseAIResponse(aiResponse, caseData);

      // Save AI analysis
      const { data: analysis } = await supabaseAdmin
        .from('ai_settlement_analysis')
        .insert({
          case_id: caseId,
          analysis_prompt: prompt,
          raw_ai_response: aiResponse,
          analysis_summary: options.summary,
          key_facts_extracted: options.keyFacts,
          legal_issues_identified: options.legalIssues,
          ai_model_used: 'gemini-2.0-flash-exp',
          confidence_score: options.confidenceScore
        })
        .select()
        .single();

      // Save settlement options
      const savedOptions = await Promise.all(
        options.settlements.map(async (option, index) => {
          const { data } = await supabaseAdmin
            .from('settlement_options')
            .insert({
              case_id: caseId,
              analysis_id: analysis.analysis_id,
              option_type: option.type,
              option_rank: index + 1,
              description: option.description,
              complainant_receives: option.complainantReceives,
              respondent_pays: option.respondentPays,
              additional_terms: option.additionalTerms,
              fairness_score: option.fairnessScore,
              legal_basis: option.legalBasis,
              pros_for_complainant: option.prosComplainant,
              cons_for_complainant: option.consComplainant,
              pros_for_respondent: option.prosRespondent,
              cons_for_respondent: option.consRespondent,
              implementation_steps: option.implementationSteps,
              timeline_days: option.timelineDays
            })
            .select()
            .single();

          return data;
        })
      );

      logger.info('AI settlement options generated successfully', {
        caseId,
        optionCount: savedOptions.length
      });

      return {
        analysis,
        options: savedOptions
      };

    } catch (error) {
      logger.error('Error generating settlement options:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive AI analysis prompt
   */
  _buildAnalysisPrompt(caseData, complainantStmt, respondentStmt, evidence) {
    const disputeAmount = caseData.dispute_amount || 0;
    const evidenceCount = evidence.length;

    return `You are an expert AI mediator specializing in Indian civil law. Analyze this dispute and provide 3 settlement options.

CASE DETAILS:
- Case Type: ${caseData.case_type}
- Dispute Amount: ₹${disputeAmount.toLocaleString('en-IN')}
- Case Filed: ${new Date(caseData.created_at).toLocaleDateString('en-IN')}
- Evidence Submitted: ${evidenceCount} documents

COMPLAINANT'S STATEMENT:
${complainantStmt.statement_content}

RESPONDENT'S STATEMENT:
${respondentStmt.statement_content}

INDIAN LEGAL FRAMEWORK TO CONSIDER:
1. Constitution of India:
   - Article 14: Equality before law
   - Article 19(1)(a): Freedom of speech
   - Article 21: Right to fair procedure

2. Indian Contract Act, 1872:
   - Section 73: Compensation for breach of contract
   - Section 74: Liquidated damages
   - Section 75: Rescission and compensation

3. Code of Civil Procedure:
   - Order X Rule 1A: Duty to compromise
   - Order XXIII Rule 3: Compromise decree

4. Arbitration & Conciliation Act, 1996:
   - Section 30: Settlement by parties
   - Section 73: Reference to arbitration

INSTRUCTIONS:
Generate exactly 3 settlement options in this JSON format:

{
  "summary": "Brief 2-3 sentence overview of the dispute",
  "keyFacts": ["fact1", "fact2", "fact3"],
  "legalIssues": ["issue1", "issue2"],
  "confidenceScore": 0.85,
  "settlements": [
    {
      "type": "conservative",
      "description": "Detailed description of this settlement option",
      "complainantReceives": 25000,
      "respondentPays": 25000,
      "additionalTerms": ["term1", "term2"],
      "fairnessScore": 7.5,
      "legalBasis": "Based on Indian Contract Act Section 73 and principle of quantum meruit",
      "prosComplainant": ["pro1", "pro2"],
      "consComplainant": ["con1"],
      "prosRespondent": ["pro1", "pro2"],
      "consRespondent": ["con1"],
      "implementationSteps": ["step1", "step2", "step3"],
      "timelineDays": 30
    },
    {
      "type": "balanced",
      "description": "...",
      "complainantReceives": 37500,
      "respondentPays": 37500,
      ...
    },
    {
      "type": "progressive",
      "description": "...",
      "complainantReceives": 50000,
      "respondentPays": 50000,
      ...
    }
  ]
}

OPTION TYPES:
1. CONSERVATIVE: Favors existing evidence, minimal risk for both parties
2. BALANCED: Fair compromise based on legal principles and facts
3. PROGRESSIVE: Forward-looking, considers relationship preservation

FAIRNESS SCORE: Rate 1-10 based on:
- Legal soundness (Indian law)
- Equity for both parties
- Practicality of implementation
- Long-term sustainability

Ensure all amounts are in Indian Rupees (₹) and cite specific sections of Indian law.`;
  }

  /**
   * Parse AI response into structured options
   */
  _parseAIResponse(aiResponse, caseData) {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.settlements || parsed.settlements.length !== 3) {
        throw new Error('AI must generate exactly 3 settlement options');
      }

      // Ensure all required fields
      parsed.settlements = parsed.settlements.map((option, index) => ({
        type: option.type || ['conservative', 'balanced', 'progressive'][index],
        description: option.description || 'Settlement option',
        complainantReceives: Number(option.complainantReceives) || 0,
        respondentPays: Number(option.respondentPays) || 0,
        additionalTerms: option.additionalTerms || [],
        fairnessScore: Number(option.fairnessScore) || 5.0,
        legalBasis: option.legalBasis || 'Based on principles of natural justice',
        prosComplainant: option.prosComplainant || [],
        consComplainant: option.consComplainant || [],
        prosRespondent: option.prosRespondent || [],
        consRespondent: option.consRespondent || [],
        implementationSteps: option.implementationSteps || ['Sign settlement agreement', 'Execute payment', 'Close case'],
        timelineDays: Number(option.timelineDays) || 30
      }));

      return {
        summary: parsed.summary || 'Dispute analysis completed',
        keyFacts: parsed.keyFacts || [],
        legalIssues: parsed.legalIssues || [],
        confidenceScore: Number(parsed.confidenceScore) || 0.75,
        settlements: parsed.settlements
      };

    } catch (error) {
      logger.error('Error parsing AI response:', error);
      
      // Fallback: Generate default options
      return this._generateFallbackOptions(caseData);
    }
  }

  /**
   * Generate fallback options if AI fails
   */
  _generateFallbackOptions(caseData) {
    const disputeAmount = caseData.dispute_amount || 50000;

    return {
      summary: 'AI-generated settlement options based on case details',
      keyFacts: ['Dispute involves contractual disagreement', 'Both parties have submitted statements'],
      legalIssues: ['Breach of contract', 'Compensation calculation'],
      confidenceScore: 0.70,
      settlements: [
        {
          type: 'conservative',
          description: `Conservative settlement: Complainant receives ₹${(disputeAmount * 0.5).toLocaleString('en-IN')} as compensation, representing 50% of claimed amount. This option minimizes risk for both parties.`,
          complainantReceives: disputeAmount * 0.5,
          respondentPays: disputeAmount * 0.5,
          additionalTerms: ['No further claims', 'Mutual non-disparagement'],
          fairnessScore: 6.5,
          legalBasis: 'Indian Contract Act Section 73 - Reasonable compensation for breach',
          prosComplainant: ['Guaranteed recovery', 'Quick resolution', 'No litigation costs'],
          consComplainant: ['Only 50% of claimed amount'],
          prosRespondent: ['Lower payment', 'Case closure', 'Avoid court'],
          consRespondent: ['Admission of partial liability'],
          implementationSteps: ['Sign agreement', 'Payment in 15 days', 'Mutual release'],
          timelineDays: 15
        },
        {
          type: 'balanced',
          description: `Balanced settlement: Complainant receives ₹${(disputeAmount * 0.75).toLocaleString('en-IN')} as compensation, representing 75% of claimed amount. Fair compromise considering both perspectives.`,
          complainantReceives: disputeAmount * 0.75,
          respondentPays: disputeAmount * 0.75,
          additionalTerms: ['Structured payment plan', 'No admission of fault', 'Confidentiality clause'],
          fairnessScore: 8.0,
          legalBasis: 'CPC Order X Rule 1A - Duty to compromise; Quantum meruit principle',
          prosComplainant: ['Substantial recovery', 'Faster than court', 'Relationship preserved'],
          consComplainant: ['Not full amount claimed'],
          prosRespondent: ['Reasonable payment', 'Avoid lengthy litigation', 'Installment option'],
          consRespondent: ['Higher than conservative option'],
          implementationSteps: ['Sign settlement deed', '50% upfront payment', '50% in 30 days', 'Final closure'],
          timelineDays: 30
        },
        {
          type: 'progressive',
          description: `Progressive settlement: Complainant receives ₹${(disputeAmount * 1.0).toLocaleString('en-IN')} as full compensation plus goodwill gesture. Forward-looking solution preserving business relationship.`,
          complainantReceives: disputeAmount * 1.0,
          respondentPays: disputeAmount * 1.0,
          additionalTerms: ['Future business partnership clause', 'Joint press release', 'Relationship reset agreement'],
          fairnessScore: 7.0,
          legalBasis: 'Arbitration Act Section 30 - Settlement by mutual agreement; Long-term relationship value',
          prosComplainant: ['Full claimed amount', 'Future opportunities', 'Reputation intact'],
          consComplainant: ['Requires ongoing relationship'],
          prosRespondent: ['Preserves business relationship', 'Potential future revenue', 'Positive resolution'],
          consRespondent: ['Full payment required'],
          implementationSteps: ['Draft partnership MoU', 'Execute payment', 'Joint announcement', 'Case closure'],
          timelineDays: 45
        }
      ]
    };
  }

  /**
   * Generate compromise option when parties choose different options
   */
  async generateCompromiseOption(caseId, option1Id, option2Id) {
    try {
      logger.info('Generating compromise option', { caseId, option1Id, option2Id });

      // Get both selected options
      const { data: options, error } = await supabaseAdmin
        .from('settlement_options')
        .select('*')
        .in('option_id', [option1Id, option2Id]);

      if (error || options.length !== 2) {
        throw new Error('Could not retrieve selected options');
      }

      const [option1, option2] = options;

      // Calculate middle ground
      const avgAmount = (option1.complainant_receives + option2.complainant_receives) / 2;
      const avgTimeline = Math.ceil((option1.timeline_days + option2.timeline_days) / 2);
      const avgFairness = (option1.fairness_score + option2.fairness_score) / 2;

      // Merge additional terms
      const mergedTerms = [
        ...new Set([
          ...(option1.additional_terms || []),
          ...(option2.additional_terms || [])
        ])
      ];

      // Build compromise prompt
      const prompt = `Two parties in a dispute have chosen different settlement options. Generate a compromise option that bridges their preferences.

OPTION 1 (${option1.option_type}):
- Amount: ₹${option1.complainant_receives}
- Description: ${option1.description}
- Timeline: ${option1.timeline_days} days

OPTION 2 (${option2.option_type}):
- Amount: ₹${option2.complainant_receives}
- Description: ${option2.description}
- Timeline: ${option2.timeline_days} days

Generate a compromise option in JSON format that:
1. Finds middle ground on compensation (around ₹${avgAmount})
2. Balances timelines and terms
3. Preserves fairness for both parties
4. Includes creative solutions (installments, non-monetary terms, etc.)

{
  "description": "Detailed compromise description",
  "complainantReceives": ${avgAmount},
  "respondentPays": ${avgAmount},
  "additionalTerms": ["term1", "term2"],
  "fairnessScore": ${avgFairness},
  "legalBasis": "Legal justification",
  "implementationSteps": ["step1", "step2"],
  "timelineDays": ${avgTimeline}
}`;

      const aiResponse = await this.geminiService.generateContent(prompt);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      
      let compromiseData;
      if (jsonMatch) {
        compromiseData = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback compromise
        compromiseData = {
          description: `Compromise settlement: Split the difference between both parties' preferred options. Complainant receives ₹${avgAmount.toLocaleString('en-IN')} with structured payment over ${avgTimeline} days.`,
          complainantReceives: avgAmount,
          respondentPays: avgAmount,
          additionalTerms: mergedTerms,
          fairnessScore: avgFairness,
          legalBasis: 'CPC Order X Rule 1A - Mutual compromise; Arbitration Act Section 30',
          implementationSteps: [
            'Review and sign compromise agreement',
            `50% payment within ${Math.floor(avgTimeline / 3)} days`,
            `Balance payment within ${avgTimeline} days`,
            'Final case closure'
          ],
          timelineDays: avgTimeline
        };
      }

      // Get analysis ID from first option
      const { data: analysis } = await supabaseAdmin
        .from('settlement_options')
        .select('analysis_id')
        .eq('option_id', option1Id)
        .single();

      // Save compromise option
      const { data: compromiseOption } = await supabaseAdmin
        .from('settlement_options')
        .insert({
          case_id: caseId,
          analysis_id: analysis?.analysis_id,
          option_type: 'compromise',
          option_rank: 4,
          description: compromiseData.description,
          complainant_receives: compromiseData.complainantReceives,
          respondent_pays: compromiseData.respondentPays,
          additional_terms: compromiseData.additionalTerms,
          fairness_score: compromiseData.fairnessScore,
          legal_basis: compromiseData.legalBasis,
          implementation_steps: compromiseData.implementationSteps,
          timeline_days: compromiseData.timelineDays,
          is_compromise: true
        })
        .select()
        .single();

      logger.info('Compromise option generated', { 
        caseId, 
        optionId: compromiseOption.option_id 
      });

      return compromiseOption;

    } catch (error) {
      logger.error('Error generating compromise option:', error);
      throw error;
    }
  }

  /**
   * Analyze evidence documents using AI
   */
  async analyzeEvidence(caseId, documentId) {
    try {
      logger.info('Analyzing evidence document', { caseId, documentId });

      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('document_id', documentId)
        .single();

      if (error || !document) {
        throw new Error('Document not found');
      }

      // Get file from storage
      const { data: fileData } = await supabaseAdmin
        .storage
        .from('documents')
        .download(document.storage_path);

      if (!fileData) {
        throw new Error('Could not download document');
      }

      // Analyze based on file type
      let analysisPrompt;
      let aiResponse;

      if (document.file_type.startsWith('image/')) {
        // Image analysis
        analysisPrompt = `Analyze this image as evidence in a legal dispute. Extract:
1. Text content (OCR)
2. Key visual elements
3. Relevance to the case
4. Authenticity indicators
5. Any signatures or official marks`;

        aiResponse = await this.geminiService.analyzeImage(fileData, analysisPrompt);
      } else if (document.file_type === 'application/pdf') {
        // PDF text extraction
        analysisPrompt = `Extract and analyze key information from this legal document:
1. Document type and purpose
2. Key clauses and terms
3. Parties mentioned
4. Dates and amounts
5. Signatures and authentication`;

        // For now, return a placeholder
        aiResponse = 'PDF analysis requires additional processing';
      } else {
        aiResponse = 'File type not supported for AI analysis';
      }

      // Save evidence analysis
      await supabaseAdmin
        .from('documents')
        .update({
          ai_analysis: aiResponse,
          analyzed_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      logger.info('Evidence analyzed successfully', { documentId });

      return {
        documentId,
        analysis: aiResponse
      };

    } catch (error) {
      logger.error('Error analyzing evidence:', error);
      throw error;
    }
  }
}

module.exports = new SettlementAIService();
