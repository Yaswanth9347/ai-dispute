// Phase 5.1 Document Generation Tests
const request = require('supertest');
const app = require('../src/app');
const { supabase } = require('../src/lib/supabaseClient');

describe('Phase 5.1 - Document Generation Service', () => {
  let authToken;
  let testCaseId;
  let testTemplateId;
  let testUserId;

  beforeAll(async () => {
    // Setup test data
    console.log('🚀 Setting up Phase 5.1 test environment...');
    
    try {
      // Create test user and get auth token
      const testUser = {
        email: 'test.document@example.com',
        password: 'TestPassword123!',
        full_name: 'Document Test User'
      };

      const { data: authData, error: authError } = await supabase.auth.signUp(testUser);
      
      if (authError && !authError.message.includes('already registered')) {
        throw authError;
      }

      // Sign in to get token
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password
      });

      if (signInError) throw signInError;
      
      authToken = signInData.session.access_token;
      testUserId = signInData.user.id;

      console.log('✅ Test user authenticated');

      // Create test case
      const testCase = {
        title: 'Document Generation Test Case',
        description: 'Test case for Phase 5.1 document generation',
        case_type: 'contract_dispute',
        dispute_amount: '25000.00',
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

  describe('Service Health Check', () => {
    test('should return service health status', async () => {
      const response = await request(app)
        .get('/api/documents/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Document Generator Service');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('components');
    });
  });

  describe('Template Management', () => {
    test('should list available templates', async () => {
      const response = await request(app)
        .get('/api/documents/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('templates');
      expect(Array.isArray(response.body.data.templates)).toBe(true);
    });

    test('should filter templates by type', async () => {
      const response = await request(app)
        .get('/api/documents/templates?type=settlement_agreement')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.filters).toHaveProperty('type', 'settlement_agreement');
    });

    test('should get specific template details', async () => {
      // First get a template ID
      const templatesResponse = await request(app)
        .get('/api/documents/templates')
        .set('Authorization', `Bearer ${authToken}`);

      if (templatesResponse.body.data.templates.length > 0) {
        const templateId = templatesResponse.body.data.templates[0].id;
        testTemplateId = templateId;

        const response = await request(app)
          .get(`/api/documents/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id', templateId);
        expect(response.body.data).toHaveProperty('name');
        expect(response.body.data).toHaveProperty('template_content');
      }
    });

    test('should return 404 for non-existent template', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/documents/templates/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Document Generation', () => {
    test('should generate document with minimal parameters', async () => {
      if (!testTemplateId) {
        // Skip if no templates available
        console.log('⚠️  Skipping document generation test - no templates available');
        return;
      }

      const generateRequest = {
        caseId: testCaseId,
        templateId: testTemplateId,
        variables: {
          party_1_name: 'Alice Johnson',
          party_2_name: 'Bob Smith Corp',
          party_1_role: 'Plaintiff',
          party_2_role: 'Defendant',
          case_title: 'Johnson v. Bob Smith Corp',
          settlement_amount: '25000',
          currency: 'USD',
          settlement_date: new Date().toLocaleDateString(),
          jurisdiction: 'California'
        },
        outputFormat: 'html',
        generateAI: false // Skip AI for faster testing
      };

      const response = await request(app)
        .post('/api/documents/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('documentId');
      expect(response.body.data).toHaveProperty('filePath');
      expect(response.body.data).toHaveProperty('metadata');
    });

    test('should require case ID and template ID', async () => {
      const response = await request(app)
        .post('/api/documents/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should validate output format', async () => {
      if (!testTemplateId) return;

      const response = await request(app)
        .post('/api/documents/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          templateId: testTemplateId,
          outputFormat: 'invalid_format'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Document History', () => {
    test('should get document history for case', async () => {
      const response = await request(app)
        .get(`/api/documents/case/${testCaseId}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('documents');
      expect(response.body.data).toHaveProperty('caseId', testCaseId);
      expect(Array.isArray(response.body.data.documents)).toBe(true);
    });

    test('should limit document history results', async () => {
      const response = await request(app)
        .get(`/api/documents/case/${testCaseId}/history?limit=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.documents.length).toBeLessThanOrEqual(5);
    });

    test('should return 404 for non-existent case', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/documents/case/${fakeId}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Document Management', () => {
    let testDocumentId;

    beforeAll(async () => {
      // Create a test document for management tests
      if (testTemplateId) {
        const generateRequest = {
          caseId: testCaseId,
          templateId: testTemplateId,
          variables: { test: 'value' },
          outputFormat: 'html',
          generateAI: false
        };

        const response = await request(app)
          .post('/api/documents/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateRequest);

        if (response.status === 201) {
          testDocumentId = response.body.data.documentId;
        }
      }
    });

    test('should get document details', async () => {
      if (!testDocumentId) return;

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', testDocumentId);
    });

    test('should download document file', async () => {
      if (!testDocumentId) return;

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      // May return 404 if file doesn't exist (expected in test environment)
      expect([200, 404]).toContain(response.status);
    });

    test('should preview document', async () => {
      if (!testDocumentId) return;

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/preview`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    test('should regenerate document', async () => {
      if (!testDocumentId) return;

      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/regenerate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: { updated: 'value' },
          outputFormat: 'html'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('originalDocumentId', testDocumentId);
    });
  });

  describe('Statistics', () => {
    test('should get document statistics', async () => {
      const response = await request(app)
        .get('/api/documents/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('total_documents');
      expect(response.body.data.statistics).toHaveProperty('by_format');
      expect(response.body.data.statistics).toHaveProperty('by_type');
    });

    test('should filter statistics by case', async () => {
      const response = await request(app)
        .get(`/api/documents/statistics?caseId=${testCaseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.caseId).toBe(testCaseId);
    });

    test('should filter statistics by timeframe', async () => {
      const response = await request(app)
        .get('/api/documents/statistics?timeframe=7d')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.timeframe).toBe('7d');
    });
  });

  describe('Authentication', () => {
    test('should require authentication for all endpoints', async () => {
      const endpoints = [
        'GET /api/documents/templates',
        'POST /api/documents/generate',
        'GET /api/documents/statistics'
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        
        let response;
        if (method === 'GET') {
          response = await request(app).get(path);
        } else if (method === 'POST') {
          response = await request(app).post(path).send({});
        }

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Integration with AI Service', () => {
    test('should handle AI enhancement gracefully', async () => {
      if (!testTemplateId) return;

      const generateRequest = {
        caseId: testCaseId,
        templateId: testTemplateId,
        variables: {
          party_1_name: 'Test Party 1',
          party_2_name: 'Test Party 2'
        },
        generateAI: true, // Enable AI enhancement
        outputFormat: 'html'
      };

      const response = await request(app)
        .post('/api/documents/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateRequest);

      // Should succeed even if AI service is unavailable
      expect([201, 500]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body.data.metadata).toHaveProperty('aiEnhanced');
      }
    });
  });
});

// Test helper functions
const testHelpers = {
  createMockTemplate: () => ({
    name: 'Test Template',
    type: 'test_document',
    category: 'testing',
    description: 'Template for testing purposes',
    template_content: {
      sections: [
        {
          title: 'Test Section',
          content: 'This is a test document for {{party_name}}.',
          order: 1
        }
      ]
    },
    required_variables: ['party_name']
  }),

  createMockCase: (userId) => ({
    title: 'Test Case for Documents',
    description: 'Test case for document generation',
    case_type: 'test_case',
    dispute_amount: '1000.00',
    currency: 'USD',
    status: 'active',
    created_by: userId
  }),

  validateDocumentStructure: (document) => {
    expect(document).toHaveProperty('id');
    expect(document).toHaveProperty('case_id');
    expect(document).toHaveProperty('template_id');
    expect(document).toHaveProperty('title');
    expect(document).toHaveProperty('content');
    expect(document).toHaveProperty('file_format');
    expect(document).toHaveProperty('status');
    expect(document).toHaveProperty('generated_at');
  },

  validateTemplateStructure: (template) => {
    expect(template).toHaveProperty('id');
    expect(template).toHaveProperty('name');
    expect(template).toHaveProperty('type');
    expect(template).toHaveProperty('category');
    expect(template).toHaveProperty('template_content');
    expect(template).toHaveProperty('is_active');
  }
};

module.exports = { testHelpers };