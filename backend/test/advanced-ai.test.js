// Advanced AI Integration Tests - Phase 4 testing
const request = require('supertest');
const app = require('../src/app');

describe('Advanced AI Integration Tests', () => {
  const testCaseId = '123e4567-e89b-12d3-a456-426614174000';
  let authToken = 'mock-jwt-token';

  beforeAll(async () => {
    // Mock authentication for testing
    // In production, these would be real JWT tokens
    authToken = 'mock-jwt-token';
  });

  describe('Route Structure and Validation', () => {
    it('should return service health status without authentication', async () => {
      const response = await request(app)
        .get('/api/ai/advanced/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('Advanced AI Service');
      expect(response.body.models['gemini-2.0-flash-exp']).toBe('available');
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication for analysis endpoints', async () => {
      const response = await request(app)
        .post(`/api/ai/advanced/analyze/${testCaseId}`)
        .send({
          analysisType: 'comprehensive'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('missing auth token');
    });
  });

  describe('API Endpoint Security', () => {
    const endpoints = [
      'predict-outcome',
      'precedents', 
      'risk-assessment',
      'strategy'
    ];

    endpoints.forEach(endpoint => {
      it(`should require authentication for ${endpoint}`, async () => {
        const response = await request(app)
          .post(`/api/ai/advanced/${endpoint}/${testCaseId}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('missing auth token');
      });
    });
  });

  describe('Route Existence and Structure', () => {
    it('should handle POST requests to advanced analysis endpoints', async () => {
      const response = await request(app)
        .post('/api/ai/advanced/analyze/invalid-uuid')
        .send({
          analysisType: 'comprehensive'
        });

      // Should return 401 (auth required) not 404 (route not found)
      expect(response.status).toBe(401);
    });

    it('should handle POST requests to comparison endpoint', async () => {
      const response = await request(app)
        .post('/api/ai/advanced/compare')
        .send({
          analysis_ids: ['single-analysis-id']
        });

      // Should return 401 (auth required) not 404 (route not found)
      expect(response.status).toBe(401);
    });

    it('should handle GET requests to statistics endpoint', async () => {
      const response = await request(app)
        .get('/api/ai/advanced/statistics')
        .query({
          time_period: 'invalid_period'
        });

      // Should return 401 (auth required) not 404 (route not found)
      expect(response.status).toBe(401);
    });

    it('should handle POST requests to batch endpoint', async () => {
      const manyCaseIds = Array(11).fill().map(() => testCaseId);
      
      const response = await request(app)
        .post('/api/ai/advanced/batch/analyze')
        .send({
          case_ids: manyCaseIds,
          analysis_type: 'comprehensive'
        });

      // Should return 401 (auth required) not 404 (route not found)
      expect(response.status).toBe(401);
    });
  });
});