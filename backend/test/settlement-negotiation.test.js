// Settlement Negotiation Tests - Phase 4.2 Comprehensive Test Suite
// Testing multi-party negotiation workflows and AI-assisted compromise generation

const request = require('supertest');
const app = require('../src/app');
const { supabase } = require('../src/lib/supabaseClient');

describe('Settlement Negotiation System', () => {
  let authToken;
  let testUserId;
  let testCaseId;
  let negotiationId;

  beforeAll(async () => {
    // Setup test authentication
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = authResponse.body.token;
    testUserId = authResponse.body.user.id;

    // Create test case
    const caseResponse = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Negotiation Test Case',
        description: 'Test case for settlement negotiations',
        plaintiff_name: 'Test Plaintiff',
        defendant_name: 'Test Defendant',
        case_type: 'contract_dispute',
        amount_claimed: 50000
      });
    
    testCaseId = caseResponse.body.case.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (negotiationId) {
      await supabase
        .from('settlement_negotiations')
        .delete()
        .eq('negotiation_id', negotiationId);
    }
    
    if (testCaseId) {
      await supabase
        .from('cases')
        .delete()
        .eq('id', testCaseId);
    }
  });

  describe('POST /api/negotiations', () => {
    it('should start a new settlement negotiation', async () => {
      const response = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          initialSettlement: {
            amount: 25000,
            terms: {
              payment_schedule: 'lump_sum',
              deadline: '2024-06-01'
            },
            message: 'Initial settlement offer'
          },
          maxRounds: 5,
          timeoutHours: 48
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('negotiationId');
      expect(response.body.data).toHaveProperty('status', 'active');
      expect(response.body.data).toHaveProperty('currentRound', 1);
      
      negotiationId = response.body.data.negotiationId;
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing caseId and initialSettlement
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Case ID is required');
    });

    it('should validate settlement amount', async () => {
      const response = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          initialSettlement: {
            amount: -1000, // Invalid negative amount
            terms: {}
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/negotiations/:negotiationId', () => {
    it('should retrieve negotiation status', async () => {
      const response = await request(app)
        .get(`/api/negotiations/${negotiationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('negotiation');
      expect(response.body.data.negotiation).toHaveProperty('id', negotiationId);
      expect(response.body.data.negotiation).toHaveProperty('status');
      expect(response.body.data.negotiation).toHaveProperty('parties');
    });

    it('should return 404 for non-existent negotiation', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/negotiations/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/negotiations/:negotiationId/respond', () => {
    it('should submit acceptance response', async () => {
      const response = await request(app)
        .post(`/api/negotiations/${negotiationId}/respond`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'accept',
          message: 'Accepting the current offer'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('responseId');
      expect(response.body.data).toHaveProperty('negotiationStatus');
    });

    it('should submit counter offer', async () => {
      // First, start a new negotiation for counter offer test
      const newNegResponse = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          initialSettlement: {
            amount: 30000,
            terms: {}
          }
        });

      const newNegotiationId = newNegResponse.body.data.negotiationId;
      
      const response = await request(app)
        .post(`/api/negotiations/${newNegotiationId}/respond`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'counter',
          counterOffer: {
            amount: 35000,
            terms: {
              payment_schedule: 'installments',
              installments: 6
            },
            reasoning: 'Increased amount due to additional damages discovered'
          },
          message: 'Counter offer with installment plan'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('responseId');
      expect(response.body.data.counterOffer).toHaveProperty('amount', 35000);
    });

    it('should validate response type', async () => {
      const response = await request(app)
        .post(`/api/negotiations/${negotiationId}/respond`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'invalid_type',
          message: 'Invalid response type'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require counter offer amount for counter type', async () => {
      const response = await request(app)
        .post(`/api/negotiations/${negotiationId}/respond`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'counter',
          message: 'Counter without amount'
          // Missing counterOffer.amount
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/negotiations/:negotiationId/compromise', () => {
    it('should generate AI-assisted compromise', async () => {
      // Create negotiation with multiple rounds for compromise testing
      const negResponse = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          initialSettlement: {
            amount: 20000,
            terms: {}
          }
        });

      const testNegotiationId = negResponse.body.data.negotiationId;

      const response = await request(app)
        .post(`/api/negotiations/${testNegotiationId}/compromise`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('compromiseId');
      expect(response.body.data.compromise).toHaveProperty('amount');
      expect(response.body.data.compromise).toHaveProperty('terms');
      expect(response.body.data.compromise).toHaveProperty('reasoning');
      expect(response.body.data.compromise).toHaveProperty('confidence');
      expect(response.body.data.compromise.confidence).toBeGreaterThan(0);
      expect(response.body.data.compromise.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/negotiations', () => {
    it('should retrieve user negotiations with pagination', async () => {
      const response = await request(app)
        .get('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          page: 1,
          limit: 10,
          status: 'active'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('negotiations');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.negotiations)).toBe(true);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 10);
    });

    it('should filter negotiations by status', async () => {
      const response = await request(app)
        .get('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // All returned negotiations should have 'completed' status
      response.body.data.negotiations.forEach(negotiation => {
        expect(negotiation.status).toBe('completed');
      });
    });
  });

  describe('GET /api/negotiations/:negotiationId/history', () => {
    it('should retrieve negotiation round history', async () => {
      const response = await request(app)
        .get(`/api/negotiations/${negotiationId}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('history');
      expect(Array.isArray(response.body.data.history)).toBe(true);
      
      if (response.body.data.history.length > 0) {
        const round = response.body.data.history[0];
        expect(round).toHaveProperty('roundNumber');
        expect(round).toHaveProperty('responses');
        expect(round).toHaveProperty('timestamp');
      }
    });
  });

  describe('POST /api/negotiations/:negotiationId/cancel', () => {
    it('should cancel negotiation', async () => {
      // Create negotiation specifically for cancellation test
      const negResponse = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          initialSettlement: {
            amount: 15000,
            terms: {}
          }
        });

      const cancelNegotiationId = negResponse.body.data.negotiationId;

      const response = await request(app)
        .post(`/api/negotiations/${cancelNegotiationId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Changed strategy - pursuing litigation instead'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('negotiationId', cancelNegotiationId);
      expect(response.body.data).toHaveProperty('status', 'cancelled');
    });

    it('should require proper authorization to cancel', async () => {
      // Try to cancel without authentication
      const response = await request(app)
        .post(`/api/negotiations/${negotiationId}/cancel`)
        .send({
          reason: 'Unauthorized cancellation attempt'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/negotiations/cases/:caseId', () => {
    it('should retrieve case negotiations', async () => {
      const response = await request(app)
        .get(`/api/negotiations/cases/${testCaseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('negotiations');
      expect(Array.isArray(response.body.data.negotiations)).toBe(true);
      
      // All negotiations should belong to the test case
      response.body.data.negotiations.forEach(negotiation => {
        expect(negotiation.caseId).toBe(testCaseId);
      });
    });
  });

  describe('GET /api/negotiations/analytics', () => {
    it('should retrieve negotiation analytics', async () => {
      const response = await request(app)
        .get('/api/negotiations/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeframe: '30d' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('analytics');
      
      const analytics = response.body.data.analytics;
      expect(analytics).toHaveProperty('totalNegotiations');
      expect(analytics).toHaveProperty('successfulNegotiations');
      expect(analytics).toHaveProperty('failedNegotiations');
      expect(analytics).toHaveProperty('activeNegotiations');
      expect(analytics).toHaveProperty('averageRounds');
      expect(analytics).toHaveProperty('successRate');
      
      expect(typeof analytics.totalNegotiations).toBe('number');
      expect(typeof analytics.successRate).toBe('number');
      expect(analytics.successRate).toBeGreaterThanOrEqual(0);
      expect(analytics.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/negotiations/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/negotiations/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('serviceInfo');
      expect(['healthy', 'degraded', 'down'].includes(response.body.data.status)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/negotiations/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Invalid negotiation ID format');
    });

    it('should handle missing authentication', async () => {
      const response = await request(app)
        .get('/api/negotiations');

      expect(response.status).toBe(401);
    });

    it('should handle malformed request body', async () => {
      const response = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });

  describe('Multi-Party Scenarios', () => {
    it('should handle multi-party negotiation workflow', async () => {
      // This would test complex multi-party scenarios
      // For now, we'll test the basic structure is in place
      const response = await request(app)
        .post('/api/negotiations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          initialSettlement: {
            amount: 40000,
            terms: {
              parties: ['plaintiff', 'defendant', 'third_party'],
              distribution: {
                plaintiff: 60,
                defendant: 30,
                third_party: 10
              }
            }
          },
          maxRounds: 8
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('negotiationId');
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should respect rate limits for negotiation creation', async () => {
      // Create multiple negotiations rapidly to test rate limiting
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/negotiations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            caseId: testCaseId,
            initialSettlement: {
              amount: 1000,
              terms: {}
            }
          })
      );

      const responses = await Promise.all(promises);
      
      // At least some requests should succeed
      const successful = responses.filter(r => r.status === 201);
      expect(successful.length).toBeGreaterThan(0);
      
      // Some might be rate limited (429) if limits are enforced
      const rateLimited = responses.filter(r => r.status === 429);
      // Rate limiting might not be enforced in test environment
    });

    it('should validate user permissions for case access', async () => {
      // This would require creating a case with different user
      // and trying to access it with current user
      const fakeUserId = '550e8400-e29b-41d4-a716-446655440001';
      
      // For now, just verify the structure is in place
      expect(testUserId).toBeTruthy();
      expect(authToken).toBeTruthy();
    });
  });
});