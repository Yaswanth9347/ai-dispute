// Document & Resolution End-to-End Tests
const request = require('supertest');
const { createServer } = require('../src/app');
const { supabase } = require('../src/lib/supabaseClient');

describe('Document & Resolution E2E Tests', () => {
  let app;
  let authToken;
  let testCaseId;
  let testDocumentId;
  let testUserId;

  beforeAll(async () => {
    app = createServer();
    
    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'doctest@example.com',
        password: 'SecurePass123!',
        full_name: 'Document Test User',
        phone: '+919876543210'
      });

    if (registerResponse.body.token) {
      authToken = registerResponse.body.token;
      testUserId = registerResponse.body.user.id;
    } else {
      // Login if user already exists
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'doctest@example.com',
          password: 'SecurePass123!'
        });
      authToken = loginResponse.body.token;
      testUserId = loginResponse.body.user.id;
    }

    // Create a test case
    const caseResponse = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Document Resolution Test Case',
        description: 'Testing document generation and resolution workflow',
        category: 'civil',
        dispute_amount: 50000,
        defender_name: 'Test Defender',
        defender_email: 'defender@example.com',
        defender_phone: '+919876543211'
      });

    testCaseId = caseResponse.body.case?.id || caseResponse.body.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCaseId) {
      await supabase.from('cases').delete().eq('id', testCaseId);
    }
    if (testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
    }
  });

  describe('Settlement Agreement Generation', () => {
    it('should generate settlement agreement successfully', async () => {
      const response = await request(app)
        .post(`/api/document-resolution/cases/${testCaseId}/settlement/generate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settlementTerms: {
            amount: 50000,
            terms: 'Full settlement payment within 30 days',
            payment_schedule: 'Lump sum payment',
            additional_terms: 'No further claims'
          },
          parties: [
            {
              name: 'Document Test User',
              email: 'doctest@example.com',
              role: 'complainer'
            },
            {
              name: 'Test Defender',
              email: 'defender@example.com',
              role: 'defender'
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document).toBeDefined();
      expect(response.body.document.filename).toMatch(/settlement_agreement_.*\.pdf/);
    }, 15000);

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post(`/api/document-resolution/cases/${testCaseId}/settlement/generate`)
        .send({
          settlementTerms: { amount: 50000 },
          parties: []
        });

      expect(response.status).toBe(401);
    });

    it('should validate required settlement terms', async () => {
      const response = await request(app)
        .post(`/api/document-resolution/cases/${testCaseId}/settlement/generate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parties: []
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Digital Signature Workflow', () => {
    beforeAll(async () => {
      // Create a test document
      const { data, error } = await supabase
        .from('case_documents')
        .insert({
          case_id: testCaseId,
          document_type: 'settlement_agreement',
          original_filename: 'test_settlement.pdf',
          file_path: '/storage/test_settlement.pdf',
          status: 'active',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (data) testDocumentId = data.id;
    });

    it('should sign document with e-signature', async () => {
      if (!testDocumentId) {
        console.log('Skipping test - no test document created');
        return;
      }

      const response = await request(app)
        .post(`/api/document-resolution/documents/${testDocumentId}/sign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          signerInfo: {
            name: 'Document Test User',
            email: 'doctest@example.com',
            role: 'complainer'
          },
          signatureType: 'settlement'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.signature).toBeDefined();
      expect(response.body.signature.signatureId).toBeDefined();
    }, 15000);

    it('should verify document signature', async () => {
      if (!testDocumentId) {
        console.log('Skipping test - no test document created');
        return;
      }

      const response = await request(app)
        .get(`/api/document-resolution/documents/${testDocumentId}/verify-signature`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('verified');
    });
  });

  describe('Case Summary Generation', () => {
    it('should generate case summary report', async () => {
      const response = await request(app)
        .post(`/api/document-resolution/cases/${testCaseId}/summary/generate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document).toBeDefined();
      expect(response.body.document.filename).toMatch(/case_summary_.*\.pdf/);
    }, 15000);
  });

  describe('Case Closure Workflow', () => {
    it('should close case with settlement', async () => {
      const response = await request(app)
        .post(`/api/document-resolution/cases/${testCaseId}/close/settlement`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settlementDetails: {
            amount: 50000,
            terms: 'Settlement reached through mediation',
            payment_method: 'Bank transfer'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.closure).toBeDefined();
      expect(response.body.closure.type).toBe('settlement');
      expect(response.body.closure.documents).toBeInstanceOf(Array);
    }, 20000);

    it('should allow case withdrawal', async () => {
      // Create a new case for withdrawal test
      const caseResponse = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Case to Withdraw',
          description: 'Testing withdrawal workflow',
          category: 'civil'
        });

      const withdrawCaseId = caseResponse.body.case?.id || caseResponse.body.id;

      const response = await request(app)
        .post(`/api/document-resolution/cases/${withdrawCaseId}/withdraw`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          withdrawalReason: 'Parties reached private settlement'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.closure.type).toBe('withdrawn');
    }, 15000);
  });

  describe('Court Referral System', () => {
    it('should refer case to appropriate court', async () => {
      // Create a new case for court referral
      const caseResponse = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Court Referral Test Case',
          description: 'Testing court referral mechanism',
          category: 'civil',
          dispute_amount: 500000
        });

      const referralCaseId = caseResponse.body.case?.id || caseResponse.body.id;

      const response = await request(app)
        .post(`/api/document-resolution/cases/${referralCaseId}/refer-to-court`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          referralReason: 'Settlement attempts unsuccessful',
          jurisdiction: 'delhi'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.referral).toBeDefined();
      expect(response.body.referral.court).toBeDefined();
      expect(response.body.referral.court.name).toBeDefined();
      expect(response.body.referral.documents).toBeInstanceOf(Array);
      expect(response.body.referral.next_steps).toBeInstanceOf(Array);
    }, 20000);
  });

  describe('Document Templates', () => {
    it('should list available document templates', async () => {
      const response = await request(app)
        .get('/api/document-resolution/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.templates).toBeInstanceOf(Array);
      expect(response.body.templates.length).toBeGreaterThan(0);
    });

    it('should render custom document from template', async () => {
      const response = await request(app)
        .post('/api/document-resolution/templates/email-notification/render')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateData: {
            user: { name: 'Test User' },
            notification: {
              title: 'Test Notification',
              message: 'This is a test notification'
            },
            generated: { timestamp: new Date().toISOString() }
          },
          outputFormat: 'html'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document).toBeDefined();
      expect(response.body.document.format).toBe('html');
    });
  });

  describe('Statistics and Reporting', () => {
    it('should retrieve resolution statistics', async () => {
      const response = await request(app)
        .get('/api/document-resolution/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.case_closures).toBeDefined();
      expect(response.body.statistics.court_referrals).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent case gracefully', async () => {
      const response = await request(app)
        .post('/api/document-resolution/cases/non-existent-id/settlement/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settlementTerms: { amount: 10000 },
          parties: []
        });

      expect(response.status).toBe(404);
    });

    it('should handle non-existent document gracefully', async () => {
      const response = await request(app)
        .get('/api/document-resolution/documents/non-existent-id/verify-signature')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should validate authentication on all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/document-resolution/templates' },
        { method: 'get', path: '/api/document-resolution/statistics' },
        { method: 'post', path: `/api/document-resolution/cases/${testCaseId}/summary/generate` }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });
  });
});
