// Phase 5 Complete Implementation Test Suite
const request = require('supertest');
const app = require('../src/app');
const { supabase } = require('../src/lib/supabaseClient');

describe('Phase 5 - Complete Legal Document Generation & Court Integration', () => {
  let authToken;
  let testCaseId;
  let testUserId;
  let testDocumentId;
  let testCourtSystemId;

  beforeAll(async () => {
    console.log('🚀 Setting up Phase 5 complete test environment...');
    
    try {
      // Create test user and get auth token
      const testUser = {
        email: 'test.phase5@example.com',
        password: 'TestPassword123!',
        full_name: 'Phase 5 Test User'
      };

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password
      });

      if (signInError) {
        // Try to create user if sign in fails
        const { data: authData, error: authError } = await supabase.auth.signUp(testUser);
        if (authError && !authError.message.includes('already registered')) {
          throw authError;
        }
        
        // Sign in again
        const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword({
          email: testUser.email,
          password: testUser.password
        });
        
        if (retryError) throw retryError;
        authToken = retrySignIn.session.access_token;
        testUserId = retrySignIn.user.id;
      } else {
        authToken = signInData.session.access_token;
        testUserId = signInData.user.id;
      }

      console.log('✅ Test user authenticated');

      // Create test case
      const testCase = {
        title: 'Phase 5 Complete Test Case',
        description: 'Comprehensive test case for Phase 5 complete implementation',
        case_type: 'contract_dispute',
        dispute_amount: '50000.00',
        currency: 'USD',
        status: 'active',
        jurisdiction: 'California',
        created_by: testUserId
      };

      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .insert(testCase)
        .select()
        .single();

      if (caseError) throw caseError;
      
      testCaseId = caseData.id;
      console.log('✅ Test case created:', testCaseId);

      // Create test parties
      const parties = [
        {
          case_id: testCaseId,
          name: 'Alice Johnson',
          role: 'plaintiff',
          contact_email: 'alice@example.com'
        },
        {
          case_id: testCaseId,
          name: 'Bob Smith Corp',
          role: 'defendant',
          contact_email: 'legal@bobsmith.com'
        }
      ];

      await supabase.from('case_parties').insert(parties);
      console.log('✅ Test parties created');

    } catch (error) {
      console.error('❌ Test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCaseId) {
      await supabase.from('cases').delete().eq('id', testCaseId);
    }
    console.log('✅ Test cleanup completed');
  });

  describe('Phase 5.1 - Document Generation Service', () => {
    test('should check document service health', async () => {
      const response = await request(app)
        .get('/api/documents/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Document Generator Service');
      expect(response.body).toHaveProperty('components');
    });

    test('should list document templates', async () => {
      const response = await request(app)
        .get('/api/documents/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('templates');
    });

    test('should generate a document', async () => {
      // First get a template
      const templatesResponse = await request(app)
        .get('/api/documents/templates')
        .set('Authorization', `Bearer ${authToken}`);

      if (templatesResponse.body.data.templates.length > 0) {
        const templateId = templatesResponse.body.data.templates[0].id;

        const generateRequest = {
          caseId: testCaseId,
          templateId: templateId,
          variables: {
            party_1_name: 'Alice Johnson',
            party_2_name: 'Bob Smith Corp',
            case_title: 'Johnson v. Bob Smith Corp',
            settlement_amount: '50000',
            currency: 'USD'
          },
          outputFormat: 'html',
          generateAI: false
        };

        const response = await request(app)
          .post('/api/documents/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateRequest);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('documentId');
        
        testDocumentId = response.body.data.documentId;
      }
    });

    test('should get document statistics', async () => {
      const response = await request(app)
        .get('/api/documents/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
    });
  });

  describe('Phase 5.2 - Court Integration Service', () => {
    test('should check court service health', async () => {
      const response = await request(app)
        .get('/api/court/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Court Integration Service');
      expect(response.body).toHaveProperty('components');
    });

    test('should list court systems', async () => {
      const response = await request(app)
        .get('/api/court/systems')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('courtSystems');
    });

    test('should get case filing history', async () => {
      const response = await request(app)
        .get(`/api/court/cases/${testCaseId}/filings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('filings');
      expect(response.body.data.caseId).toBe(testCaseId);
    });

    test('should get filing statistics', async () => {
      const response = await request(app)
        .get('/api/court/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
    });
  });

  describe('Phase 5 - Integration Tests', () => {
    test('should require authentication for all endpoints', async () => {
      const endpoints = [
        'GET /api/documents/templates',
        'GET /api/court/systems',
        'GET /api/documents/statistics',
        'GET /api/court/statistics'
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        
        let response;
        if (method === 'GET') {
          response = await request(app).get(path);
        }

        expect(response.status).toBe(401);
      }
    });

    test('should handle validation errors properly', async () => {
      const invalidRequests = [
        {
          endpoint: 'POST /api/documents/generate',
          data: { invalidField: 'test' }
        },
        {
          endpoint: 'POST /api/court/file',
          data: { invalidField: 'test' }
        }
      ];

      for (const request_data of invalidRequests) {
        const [method, path] = request_data.endpoint.split(' ');
        
        const response = await request(app)
          .post(path)
          .set('Authorization', `Bearer ${authToken}`)
          .send(request_data.data);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    test('should handle non-existent resources properly', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      
      const endpoints = [
        `GET /api/documents/templates/${fakeId}`,
        `GET /api/court/systems/${fakeId}`,
        `GET /api/documents/${fakeId}`,
        `GET /api/court/filings/${fakeId}/status`
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        
        const response = await request(app)
          .get(path)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      }
    });
  });

  describe('Phase 5 - Performance Tests', () => {
    test('should respond to health checks quickly', async () => {
      const start = Date.now();
      
      const [docHealth, courtHealth] = await Promise.all([
        request(app)
          .get('/api/documents/health')
          .set('Authorization', `Bearer ${authToken}`),
        request(app)
          .get('/api/court/health')
          .set('Authorization', `Bearer ${authToken}`)
      ]);

      const duration = Date.now() - start;
      
      expect(docHealth.status).toBe(200);
      expect(courtHealth.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent requests', async () => {
      const requests = [];
      
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .get('/api/documents/templates')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Phase 5 - Error Handling', () => {
    test('should handle service degradation gracefully', async () => {
      // Test with potentially unavailable services
      const response = await request(app)
        .get('/api/documents/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('status');
    });

    test('should provide meaningful error messages', async () => {
      const response = await request(app)
        .post('/api/documents/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}); // Empty request

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('issues');
      expect(Array.isArray(response.body.issues)).toBe(true);
    });
  });
});

// Custom Jest matchers
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

// Test utilities
const testUtils = {
  createMockDocument: (caseId, templateId) => ({
    caseId,
    templateId,
    variables: {
      party_1_name: 'Test Party 1',
      party_2_name: 'Test Party 2',
      case_title: 'Test Case',
      settlement_amount: '10000',
      currency: 'USD'
    },
    outputFormat: 'html',
    generateAI: false
  }),

  createMockCourtFiling: (caseId, courtSystemId, documentIds = []) => ({
    caseId,
    courtSystemId,
    documentIds,
    filingType: 'initial_complaint',
    expedited: false,
    serviceMethod: 'electronic',
    metadata: {
      priority: 'normal',
      notes: 'Test filing'
    }
  }),

  validateApiResponse: (response, expectedStatus = 200) => {
    expect(response.status).toBe(expectedStatus);
    if (expectedStatus === 200) {
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    }
  },

  validateErrorResponse: (response, expectedStatus = 400) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', false);
    if (expectedStatus === 400) {
      expect(response.body).toHaveProperty('issues');
    }
  }
};

module.exports = { testUtils };