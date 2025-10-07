// Gemini AI Service - Core AI integration for dispute resolution
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY;
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY is required for Gemini AI integration');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  // Generate AI response with error handling
  async generateResponse(prompt, options = {}) {
    try {
      const {
        temperature = 0.7,
        maxOutputTokens = 2048,
        topP = 0.8,
        topK = 40
      } = options;

      const generationConfig = {
        temperature,
        topP,
        topK,
        maxOutputTokens,
      };

      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });

      const response = await result.response;
      return {
        success: true,
        content: response.text(),
        usage: {
          promptTokens: result.response?.usage?.promptTokenCount || 0,
          completionTokens: result.response?.usage?.candidatesTokenCount || 0,
          totalTokens: result.response?.usage?.totalTokenCount || 0
        }
      };
    } catch (error) {
      console.error('Gemini AI Error:', error);
      return {
        success: false,
        error: error.message,
        content: null
      };
    }
  }

  // Analyze image content (for evidence processing)
  async analyzeImage(imageData, prompt) {
    try {
      const imageParts = [
        {
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg"
          }
        }
      ];

      const result = await this.visionModel.generateContent([prompt, ...imageParts]);
      const response = await result.response;

      return {
        success: true,
        content: response.text(),
        confidence: 0.85 // Estimated confidence for image analysis
      };
    } catch (error) {
      console.error('Gemini Vision Error:', error);
      return {
        success: false,
        error: error.message,
        content: null
      };
    }
  }

  // Analyze case context and generate insights
  async analyzeCaseContext(caseData) {
    const prompt = `
As an AI legal analyst specializing in dispute resolution, analyze the following case:

**Case Details:**
- Title: ${caseData.title}
- Type: ${caseData.case_type}
- Jurisdiction: ${caseData.jurisdiction}
- Dispute Amount: ${caseData.dispute_amount} ${caseData.currency}
- Description: ${caseData.description}

**Parties Involved:**
${caseData.parties?.map(p => `- ${p.role}: ${p.contact_email}`).join('\n') || 'No parties specified'}

**Statements:**
${caseData.statements?.map(s => `- ${s.user_id}: ${s.text}`).join('\n') || 'No statements available'}

**Evidence:**
${caseData.evidence?.map(e => `- ${e.file_name}: ${e.metadata?.description || 'No description'}`).join('\n') || 'No evidence provided'}

Please provide a comprehensive analysis including:
1. **Case Summary**: Brief overview of the dispute
2. **Legal Issues**: Key legal questions and potential violations
3. **Strength Assessment**: Evaluate the strength of each party's position
4. **Risk Analysis**: Potential risks and outcomes for each party
5. **Settlement Recommendation**: Suggested settlement range and terms
6. **Next Steps**: Recommended actions for resolution

Format your response as structured JSON with the following keys:
- summary
- legal_issues (array)
- strength_assessment (object with party roles as keys)
- risk_analysis (object)
- settlement_recommendation (object with amount_range, terms, likelihood)
- next_steps (array)
- confidence_score (0-1)
`;

    return await this.generateResponse(prompt, {
      temperature: 0.3, // Lower temperature for more consistent legal analysis
      maxOutputTokens: 3000
    });
  }

  // Generate settlement proposals based on case analysis
  async generateSettlementProposal(caseData, analysisResult) {
    const prompt = `
Based on the following case analysis, generate specific settlement proposals:

**Case**: ${caseData.title}
**Dispute Amount**: ${caseData.dispute_amount} ${caseData.currency}

**Previous Analysis**:
${typeof analysisResult === 'string' ? analysisResult : JSON.stringify(analysisResult, null, 2)}

Generate 3 different settlement proposals:
1. **Conservative Settlement**: Lower risk, quicker resolution
2. **Balanced Settlement**: Fair compromise for both parties  
3. **Aggressive Settlement**: Maximum recovery for claimant

For each proposal, provide:
- Settlement amount and currency
- Payment terms (lump sum, installments)
- Non-monetary terms and conditions
- Timeline for acceptance
- Likelihood of acceptance (%)
- Rationale

Format as structured JSON with proposals array.
`;

    return await this.generateResponse(prompt, {
      temperature: 0.4,
      maxOutputTokens: 2500
    });
  }

  // Analyze evidence content (documents, images, etc.)
  async analyzeEvidence(evidenceData) {
    const prompt = `
As a forensic document analyst, analyze this evidence for a legal dispute:

**Evidence Type**: ${evidenceData.mime_type}
**File Name**: ${evidenceData.file_name}
**Context**: ${evidenceData.metadata?.description || 'No context provided'}

${evidenceData.ocr_text ? `**Extracted Text**: ${evidenceData.ocr_text}` : ''}
${evidenceData.transcription ? `**Transcription**: ${evidenceData.transcription}` : ''}

Provide analysis including:
1. **Content Summary**: What this evidence shows
2. **Relevance**: How it relates to the dispute
3. **Authenticity**: Assessment of document authenticity
4. **Legal Significance**: Impact on the case
5. **Key Points**: Important facts or claims supported
6. **Weaknesses**: Any limitations or issues with this evidence

Format as structured JSON.
`;

    return await this.generateResponse(prompt, {
      temperature: 0.2, // Very low temperature for factual analysis
      maxOutputTokens: 1500
    });
  }

  // Legal research and precedent lookup
  async legalResearch(caseType, jurisdiction, legalIssues) {
    const prompt = `
Conduct legal research for a ${caseType} dispute in ${jurisdiction}:

**Legal Issues**:
${Array.isArray(legalIssues) ? legalIssues.join('\n- ') : legalIssues}

Provide research including:
1. **Applicable Laws**: Relevant statutes and regulations
2. **Case Precedents**: Similar cases and their outcomes
3. **Legal Standards**: Burden of proof and key criteria
4. **Jurisdictional Considerations**: Local court procedures
5. **Recent Developments**: Any recent changes in law
6. **Strategic Considerations**: Legal strategy recommendations

Focus on Indian law and jurisdiction where applicable.
Format as structured JSON.
`;

    return await this.generateResponse(prompt, {
      temperature: 0.3,
      maxOutputTokens: 3500
    });
  }

  // Risk assessment for case outcomes
  async assessRisks(caseData, evidenceStrength) {
    const prompt = `
Conduct a comprehensive risk assessment for this legal dispute:

**Case**: ${caseData.title}
**Type**: ${caseData.case_type}
**Amount**: ${caseData.dispute_amount} ${caseData.currency}
**Evidence Strength**: ${evidenceStrength || 'Not assessed'}

Assess risks including:
1. **Litigation Risks**: Chances of losing in court
2. **Financial Risks**: Potential costs and damages
3. **Time Risks**: Duration and delays
4. **Reputational Risks**: Impact on parties' reputation
5. **Enforcement Risks**: Difficulty collecting judgments
6. **Settlement Risks**: Risks of not settling

For each party (claimant/respondent), provide:
- Risk level (Low/Medium/High)
- Risk factors
- Mitigation strategies
- Recommended actions

Format as structured JSON with party-specific risk assessments.
`;

    return await this.generateResponse(prompt, {
      temperature: 0.4,
      maxOutputTokens: 2000
    });
  }

  // Generate compromise solutions when parties choose different settlement options
  async generateCompromise(proposal1, proposal2, caseContext) {
    const prompt = `
Two parties have chosen different settlement options. Generate compromise solutions:

**Proposal 1**: ${JSON.stringify(proposal1, null, 2)}
**Proposal 2**: ${JSON.stringify(proposal2, null, 2)}

**Case Context**: ${caseContext}

Generate 3 compromise solutions that:
1. Bridge the gap between the two positions
2. Address key concerns of both parties
3. Provide mutual benefits
4. Are realistic and enforceable

Each compromise should include:
- Settlement amount and terms
- How it addresses each party's key concerns
- Implementation timeline
- Success likelihood
- Benefits for both parties

Format as structured JSON with compromises array.
`;

    return await this.generateResponse(prompt, {
      temperature: 0.5,
      maxOutputTokens: 2000
    });
  }

  // Health check for AI service
  async healthCheck() {
    try {
      const testPrompt = "Respond with 'AI service is operational' if you can process this message.";
      const result = await this.generateResponse(testPrompt, {
        maxOutputTokens: 50,
        temperature: 0.1
      });
      
      return {
        status: result.success ? 'healthy' : 'unhealthy',
        model: 'gemini-2.0-flash',
        timestamp: new Date().toISOString(),
        response: result.content
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new GeminiService();