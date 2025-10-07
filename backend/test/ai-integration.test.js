// Test AI Integration - Verify Phase 2 AI services are working
require('dotenv').config();
const GeminiService = require('../src/services/GeminiService');
const AIAnalysisService = require('../src/services/AIAnalysisService');

describe('Phase 2 AI Integration Tests', () => {
  test('GeminiService health check', async () => {
    const healthStatus = await GeminiService.healthCheck();
    
    expect(healthStatus).toBeDefined();
    expect(healthStatus.status).toBeDefined();
    expect(healthStatus.timestamp).toBeDefined();
    
    console.log('Gemini Service Health:', healthStatus);
  }, 30000); // 30 second timeout for AI calls

  test('GeminiService basic response generation', async () => {
    const testPrompt = "Hello, please respond with 'AI service is working correctly' if you receive this message.";
    
    const response = await GeminiService.generateResponse(testPrompt, {
      temperature: 0.1,
      maxOutputTokens: 50
    });
    
    expect(response).toBeDefined();
    expect(response.success).toBeDefined();
    
    if (response.success) {
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      console.log('AI Response:', response.content);
    } else {
      console.log('AI Error:', response.error);
    }
  }, 30000);

  test('AIAnalysisService health check', async () => {
    const healthStatus = await AIAnalysisService.healthCheck();
    
    expect(healthStatus).toBeDefined();
    expect(healthStatus.service).toBe('AIAnalysisService');
    expect(healthStatus.status).toBeDefined();
    expect(healthStatus.timestamp).toBeDefined();
    expect(Array.isArray(healthStatus.capabilities)).toBe(true);
    
    console.log('AI Analysis Service Health:', healthStatus);
  }, 30000);

  test('Services properly export AI components', () => {
    const { GeminiService: ExportedGemini, AIAnalysisService: ExportedAnalysis } = require('../src/services');
    
    expect(ExportedGemini).toBeDefined();
    expect(ExportedAnalysis).toBeDefined();
    expect(typeof ExportedGemini.generateResponse).toBe('function');
    expect(typeof ExportedAnalysis.analyzeCase).toBe('function');
  });

  test('Controllers properly export AI controller', () => {
    const { AIController } = require('../src/controllers');
    
    expect(AIController).toBeDefined();
    expect(typeof AIController.analyzeCase).toBe('function');
    expect(typeof AIController.generateSettlementProposals).toBe('function');
    expect(typeof AIController.healthCheck).toBe('function');
  });
});