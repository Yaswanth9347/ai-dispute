// AI Service - Integrated Claude and OpenAI for dispute resolution
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

class AIService {
  constructor() {
    this.anthropic = null;
    this.openai = null;
    this.preferredProvider = process.env.AI_PROVIDER || 'anthropic'; // 'anthropic' or 'openai'
    
    this.initialize();
  }

  initialize() {
    try {
      // Initialize Anthropic Claude
      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        console.log('🤖 Claude AI service initialized');
      }

      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('🤖 OpenAI service initialized');
      }

      if (!this.anthropic && !this.openai) {
        console.warn('⚠️ No AI API keys provided. AI features will be disabled.');
      }
    } catch (error) {
      console.error('Error initializing AI services:', error);
    }
  }

  isAvailable() {
    return this.anthropic !== null || this.openai !== null;
  }

  async callAI(messages, options = {}) {
    const { maxTokens = 4000, temperature = 0.3, provider = this.preferredProvider } = options;

    try {
      if (provider === 'anthropic' && this.anthropic) {
        return await this.callClaude(messages, { maxTokens, temperature });
      } else if (provider === 'openai' && this.openai) {
        return await this.callOpenAI(messages, { maxTokens, temperature });
      } else {
        // Fallback to available provider
        if (this.anthropic) {
          return await this.callClaude(messages, { maxTokens, temperature });
        } else if (this.openai) {
          return await this.callOpenAI(messages, { maxTokens, temperature });
        } else {
          throw new Error('No AI provider available');
        }
      }
    } catch (error) {
      console.error('AI call failed:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  async callClaude(messages, options = {}) {
    const { maxTokens, temperature } = options;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      temperature: temperature,
      messages: messages
    });

    return {
      content: response.content[0].text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      provider: 'anthropic'
    };
  }

  async callOpenAI(messages, options = {}) {
    const { maxTokens, temperature } = options;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature
    });

    return {
      content: response.choices[0].message.content,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      },
      provider: 'openai'
    };
  }

  // Analyze case for dispute resolution
  async analyzeCaseForResolution(caseData) {
    if (!this.isAvailable()) {
      throw new Error('AI service not available');
    }

    const prompt = this.buildAnalysisPrompt(caseData);
    const messages = [{ role: 'user', content: prompt }];

    const response = await this.callAI(messages, {
      maxTokens: 3000,
      temperature: 0.2 // Lower temperature for more consistent legal analysis
    });

    return this.parseAnalysisResponse(response.content);
  }

  buildAnalysisPrompt(caseData) {
    const { complainerStatement, defenderStatement, evidence, caseDetails } = caseData;

    return `You are an expert dispute resolution AI assistant. Analyze the following case and provide a structured assessment.

CASE DETAILS:
Title: ${caseDetails.title}
Description: ${caseDetails.description}
Dispute Amount: ${caseDetails.dispute_amount ? `₹${caseDetails.dispute_amount}` : 'Not specified'}
Category: ${caseDetails.category || 'General'}
Priority: ${caseDetails.priority}

COMPLAINER'S STATEMENT:
${complainerStatement}

DEFENDER'S STATEMENT:
${defenderStatement}

EVIDENCE SUMMARY:
${evidence.length > 0 ? evidence.map(e => `- ${e.description} (${e.file_name})`).join('\n') : 'No evidence provided'}

Please provide your analysis in the following JSON format:

{
  "summary": "Brief overview of the dispute",
  "keyIssues": ["List of main issues identified"],
  "complainerPosition": {
    "strengths": ["Strong points in complainer's case"],
    "weaknesses": ["Areas where complainer's case is weak"]
  },
  "defenderPosition": {
    "strengths": ["Strong points in defender's case"],
    "weaknesses": ["Areas where defender's case is weak"]
  },
  "legalConsiderations": ["Relevant legal points or precedents"],
  "evidenceAssessment": {
    "complainerEvidence": "Assessment of complainer's evidence",
    "defenderEvidence": "Assessment of defender's evidence",
    "missing": "What additional evidence would be helpful"
  },
  "riskAssessment": {
    "complainerWinProbability": 0.7,
    "defenderWinProbability": 0.3,
    "reasoning": "Explanation of probability assessment"
  },
  "recommendations": ["Specific recommendations for resolution"]
}

Provide only the JSON response, no additional text.`;
  }

  parseAnalysisResponse(content) {
    try {
      // Clean the response and extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const requiredFields = ['summary', 'keyIssues', 'complainerPosition', 'defenderPosition', 'recommendations'];
      for (const field of requiredFields) {
        if (!analysis[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return analysis;
    } catch (error) {
      console.error('Error parsing AI analysis response:', error);
      throw new Error('Failed to parse AI analysis');
    }
  }

  // Generate settlement options based on analysis
  async generateSettlementOptions(caseData, analysis) {
    if (!this.isAvailable()) {
      throw new Error('AI service not available');
    }

    const prompt = this.buildSettlementPrompt(caseData, analysis);
    const messages = [{ role: 'user', content: prompt }];

    const response = await this.callAI(messages, {
      maxTokens: 2500,
      temperature: 0.4 // Slightly higher temperature for creative solutions
    });

    return this.parseSettlementResponse(response.content);
  }

  buildSettlementPrompt(caseData, analysis) {
    return `Based on the following case analysis, generate 3-5 practical settlement options that could resolve this dispute fairly.

CASE ANALYSIS:
${JSON.stringify(analysis, null, 2)}

ORIGINAL CASE DATA:
- Dispute Amount: ${caseData.dispute_amount ? `₹${caseData.dispute_amount}` : 'Not specified'}
- Title: ${caseData.title}
- Category: ${caseData.category || 'General'}

Generate settlement options that are:
1. Fair and balanced for both parties
2. Legally sound and enforceable
3. Practical to implement
4. Address the core issues identified in the analysis

Provide your response in the following JSON format:

{
  "options": [
    {
      "id": "option_1",
      "title": "Settlement Option Title",
      "description": "Detailed description of the settlement terms",
      "terms": {
        "monetary": "Any monetary compensation (e.g., ₹50,000 to be paid by defender)",
        "actions": ["List of specific actions required by each party"],
        "timeline": "Implementation timeline (e.g., 30 days)",
        "conditions": ["Any conditions or restrictions"]
      },
      "advantages": ["Benefits of this option"],
      "considerations": ["Important points to consider"],
      "fairnessScore": 8.5,
      "implementationDifficulty": "low|medium|high",
      "estimatedResolutionTime": "7-14 days"
    }
  ],
  "recommendation": {
    "preferredOption": "option_1",
    "reasoning": "Why this option is recommended"
  },
  "fallbackOptions": ["What to do if primary options are rejected"]
}

Provide only the JSON response, no additional text.`;
  }

  parseSettlementResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in settlement response');
      }

      const settlement = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!settlement.options || !Array.isArray(settlement.options)) {
        throw new Error('Invalid settlement options format');
      }

      // Ensure each option has required fields
      settlement.options.forEach((option, index) => {
        if (!option.id || !option.title || !option.description) {
          throw new Error(`Option ${index} missing required fields`);
        }
      });

      return settlement;
    } catch (error) {
      console.error('Error parsing settlement response:', error);
      throw new Error('Failed to parse settlement options');
    }
  }

  // Generate combined solution when parties select different options
  async generateCombinedSolution(selectedOptions, caseData, analysis) {
    if (!this.isAvailable()) {
      throw new Error('AI service not available');
    }

    const prompt = this.buildCombinedSolutionPrompt(selectedOptions, caseData, analysis);
    const messages = [{ role: 'user', content: prompt }];

    const response = await this.callAI(messages, {
      maxTokens: 2000,
      temperature: 0.3
    });

    return this.parseCombinedSolutionResponse(response.content);
  }

  buildCombinedSolutionPrompt(selectedOptions, caseData, analysis) {
    return `The two parties have selected different settlement options. Create a balanced compromise solution.

COMPLAINER SELECTED:
${JSON.stringify(selectedOptions.complainer, null, 2)}

DEFENDER SELECTED:
${JSON.stringify(selectedOptions.defender, null, 2)}

CASE CONTEXT:
- Dispute Amount: ${caseData.dispute_amount ? `₹${caseData.dispute_amount}` : 'Not specified'}
- Key Issues: ${analysis.keyIssues.join(', ')}

Create a combined solution that:
1. Takes elements from both selected options
2. Finds middle ground where parties disagree
3. Maintains fairness for both parties
4. Is legally enforceable

Provide your response in JSON format:

{
  "combinedSolution": {
    "title": "Balanced Settlement Agreement",
    "description": "Detailed description of the combined solution",
    "terms": {
      "monetary": "Compromise monetary terms",
      "actions": ["Combined required actions"],
      "timeline": "Implementation timeline",
      "conditions": ["Compromise conditions"]
    },
    "compromises": {
      "complainerConcessions": ["What complainer gives up"],
      "defenderConcessions": ["What defender gives up"]
    },
    "justification": "Why this solution is fair to both parties"
  },
  "acceptanceProbability": 0.75,
  "alternativeIfRejected": "What happens if both parties reject this combined solution"
}

Provide only the JSON response, no additional text.`;
  }

  parseCombinedSolutionResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in combined solution response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing combined solution response:', error);
      throw new Error('Failed to parse combined solution');
    }
  }

  // Generate explanation for why a solution was recommended
  async explainRecommendation(option, analysis, caseData) {
    if (!this.isAvailable()) {
      return "AI explanation not available";
    }

    const prompt = `Explain in simple terms why this settlement option is recommended for this dispute:

SETTLEMENT OPTION:
${JSON.stringify(option, null, 2)}

CASE ANALYSIS:
${JSON.stringify(analysis, null, 2)}

Provide a clear, non-technical explanation in 2-3 paragraphs that both parties can understand.`;

    try {
      const messages = [{ role: 'user', content: prompt }];
      const response = await this.callAI(messages, {
        maxTokens: 500,
        temperature: 0.4
      });

      return response.content;
    } catch (error) {
      console.error('Error generating explanation:', error);
      return "Unable to generate explanation at this time.";
    }
  }
}

module.exports = new AIService();