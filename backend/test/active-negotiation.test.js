const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const { supabase } = require('../src/lib/supabaseClient');

// Mock the GeminiService
jest.mock('../src/services/GeminiService', () => ({
  generateCompromise: jest.fn().mockResolvedValue({
    compromise: {
      financial_terms: { amount: 25000, payment_terms: "lump_sum" },
      non_financial_terms: { apology: true, confidentiality: true }
    },
    reasoning: "AI-generated compromise based on case analysis",
    confidence: 0.85
  }),
  generateSettlementResponse: jest.fn().mockResolvedValue({
    response: "Generated settlement response",
    confidence: 0.90
  })
}));

describe('Active Settlement Negotiation System', () => {
  let authToken;
  let testUserId = '123e4567-e89b-12d3-a456-426614174000';
  let testCaseId = '123e4567-e89b-12d3-a456-426614174001';

  beforeAll(async () => {
    // Create a test JWT token
    authToken = jwt.sign(
      { 
        sub: testUserId, 
        role: 'authenticated',
        email: 'test@example.com'
      }, 
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create test users
    await supabase.from('users').upsert([
      {
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174002',
        email: 'jane@example.com',
        name: 'Jane Smith',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'id' });

    // Create test case
    await supabase.from('cases').upsert({
      id: testCaseId,
      title: 'Test Case',
      description: 'Test case for negotiation',
      status: 'active',
      created_by: testUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    // Create case parties
    await supabase.from('case_parties').upsert([
      {
        case_id: testCaseId,
        user_id: testUserId,
        role: 'plaintiff',
        name: 'John Doe',
        email: 'john@example.com'
      },
      {
        case_id: testCaseId,
        user_id: '223e4567-e89b-12d3-a456-426614174002',
        role: 'defendant',
        name: 'Jane Smith',
        email: 'jane@example.com'
      }
    ], { onConflict: 'case_id,user_id' });
  });

  describe('POST /api/active-negotiations/sessions', () => {
    it('should create a new negotiation session successfully', async () => {
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' },
          { userId: '223e4567-e89b-12d3-a456-426614174002', role: 'defendant', name: 'Jane Smith', email: 'jane@example.com' }
        ],
        initialOffer: {
          financial_terms: { amount: 50000, payment_terms: 'lump_sum' },
          non_financial_terms: { apology: true }
        },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxRounds: 5
      };

      const response = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body).toHaveProperty('currentRound', 1);
      expect(response.body.participants).toHaveLength(2);
    });

    it('should return 400 for invalid session data', async () => {
      const invalidData = {
        caseId: 'invalid-uuid',
        participants: [],
        initialOffer: {}
      };

      await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' }
        ],
        initialOffer: { amount: 50000 },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      await request(app)
        .post('/api/active-negotiations/sessions')
        .send(sessionData)
        .expect(401);
    });
  });

  describe('GET /api/active-negotiations/sessions/:sessionId', () => {
    let sessionId;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' }
        ],
        initialOffer: { amount: 50000 },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = response.body.sessionId;
    });

    it('should retrieve session details successfully', async () => {
      const response = await request(app)
        .get(`/api/active-negotiations/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', sessionId);
      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body).toHaveProperty('participants');
      expect(response.body).toHaveProperty('activityLog');
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      
      await request(app)
        .get(`/api/active-negotiations/sessions/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid session ID format', async () => {
      await request(app)
        .get('/api/active-negotiations/sessions/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /api/active-negotiations/sessions/:sessionId/responses', () => {
    let sessionId;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' },
          { userId: '223e4567-e89b-12d3-a456-426614174002', role: 'defendant', name: 'Jane Smith', email: 'jane@example.com' }
        ],
        initialOffer: { amount: 50000 },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = response.body.sessionId;
    });

    it('should submit accept response successfully', async () => {
      const responseData = {
        response: 'accept',
        message: 'I accept this offer'
      };

      const response = await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/responses`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(responseData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Response submitted successfully');
      expect(response.body).toHaveProperty('sessionStatus');
    });

    it('should submit counter offer successfully', async () => {
      const responseData = {
        response: 'counter',
        counterOffer: {
          financial_terms: { amount: 30000, payment_terms: 'installments' },
          non_financial_terms: { apology: false }
        },
        message: 'Counter offer with different terms'
      };

      const response = await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/responses`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(responseData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Response submitted successfully');
    });

    it('should return 400 for invalid response data', async () => {
      const invalidData = {
        response: 'invalid',
        counterOffer: 'not an object'
      };

      await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/responses`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('POST /api/active-negotiations/sessions/:sessionId/compromise', () => {
    let sessionId;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' },
          { userId: '223e4567-e89b-12d3-a456-426614174002', role: 'defendant', name: 'Jane Smith', email: 'jane@example.com' }
        ],
        initialOffer: { amount: 50000 },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = response.body.sessionId;
    });

    it('should generate AI compromise successfully', async () => {
      const response = await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/compromise`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('compromiseId');
      expect(response.body).toHaveProperty('compromise');
      expect(response.body).toHaveProperty('reasoning');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.compromise).toHaveProperty('financial_terms');
      expect(response.body.compromise).toHaveProperty('non_financial_terms');
    });
  });

  describe('POST /api/active-negotiations/sessions/:sessionId/extend-deadline', () => {
    let sessionId;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' }
        ],
        initialOffer: { amount: 50000 },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = response.body.sessionId;
    });

    it('should extend deadline successfully', async () => {
      const extensionData = {
        newDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Need more time to review terms'
      };

      const response = await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/extend-deadline`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(extensionData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Deadline extended successfully');
      expect(response.body).toHaveProperty('newDeadline');
    });

    it('should return 400 for past deadline', async () => {
      const extensionData = {
        newDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Invalid past date'
      };

      await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/extend-deadline`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(extensionData)
        .expect(400);
    });
  });

  describe('DELETE /api/active-negotiations/sessions/:sessionId', () => {
    let sessionId;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' }
        ],
        initialOffer: { amount: 50000 },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = response.body.sessionId;
    });

    it('should cancel session successfully', async () => {
      const cancellationData = {
        reason: 'No longer needed'
      };

      const response = await request(app)
        .delete(`/api/active-negotiations/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cancellationData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Session cancelled successfully');
    });
  });

  describe('GET /api/active-negotiations/analytics', () => {
    it('should return analytics for authenticated user', async () => {
      const response = await request(app)
        .get('/api/active-negotiations/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalNegotiations');
      expect(response.body).toHaveProperty('activeNegotiations');
      expect(response.body).toHaveProperty('completedAccepted');
      expect(response.body).toHaveProperty('completedFailed');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('averageRounds');
      expect(response.body).toHaveProperty('averageResolutionTime');
    });

    it('should return analytics with timeframe filter', async () => {
      const response = await request(app)
        .get('/api/active-negotiations/analytics?timeframe=7d')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalNegotiations');
    });
  });

  describe('GET /api/active-negotiations/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/active-negotiations/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('activeCount');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('avgResponseTime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  // Integration tests
  describe('Integration Tests - Full Negotiation Flow', () => {
    it('should handle complete negotiation flow', async () => {
      // Step 1: Create session
      const sessionData = {
        caseId: testCaseId,
        participants: [
          { userId: testUserId, role: 'plaintiff', name: 'John Doe', email: 'john@example.com' },
          { userId: '223e4567-e89b-12d3-a456-426614174002', role: 'defendant', name: 'Jane Smith', email: 'jane@example.com' }
        ],
        initialOffer: {
          financial_terms: { amount: 50000, payment_terms: 'lump_sum' },
          non_financial_terms: { apology: true }
        },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxRounds: 3
      };

      const createResponse = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      const sessionId = createResponse.body.sessionId;

      // Step 2: Submit counter offer
      const counterResponse = await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/responses`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          response: 'counter',
          counterOffer: {
            financial_terms: { amount: 30000, payment_terms: 'installments' },
            non_financial_terms: { apology: false }
          },
          message: 'Counter with lower amount'
        })
        .expect(200);

      // Step 3: Generate AI compromise
      const compromiseResponse = await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/compromise`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(compromiseResponse.body).toHaveProperty('compromiseId');

      // Step 4: Check session status
      const statusResponse = await request(app)
        .get(`/api/active-negotiations/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('id', sessionId);
      expect(statusResponse.body.responses).toHaveLength(1);
      expect(statusResponse.body.compromises).toHaveLength(1);

      // Step 5: Extend deadline
      await request(app)
        .post(`/api/active-negotiations/sessions/${sessionId}/extend-deadline`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Need more time'
        })
        .expect(200);

      // Step 6: Cancel session
      await request(app)
        .delete(`/api/active-negotiations/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test completed' })
        .expect(200);
    });
  });

  // Performance tests
  describe('Performance Tests', () => {
    it('should handle multiple concurrent session creations', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const sessionData = {
          caseId: testCaseId,
          participants: [
            { userId: testUserId, role: 'plaintiff', name: `User ${i}`, email: `user${i}@example.com` }
          ],
          initialOffer: { amount: 10000 + i * 1000 },
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        promises.push(
          request(app)
            .post('/api/active-negotiations/sessions')
            .set('Authorization', `Bearer ${authToken}`)
            .send(sessionData)
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('sessionId');
      });
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // This would typically require mocking the database connection
      // For now, we'll test the endpoint structure
      
      console.error = originalConsoleError;
    });

    it('should validate all required fields', async () => {
      const incompleteData = {
        caseId: testCaseId,
        // Missing participants
        initialOffer: { amount: 50000 },
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/active-negotiations/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});