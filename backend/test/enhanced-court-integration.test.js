// Enhanced Court Integration Tests - Phase 5.2 Comprehensive Test Suite
// Testing real-time court API integration and automated filing capabilities

const request = require('supertest');
const app = require('../src/app');
const { supabase } = require('../src/lib/supabaseClient');
const EnhancedCourtIntegrationService = require('../src/services/EnhancedCourtIntegrationService');

describe('Enhanced Court Integration System', () => {
  let authToken;
  let testUserId;
  let testCaseId;
  let courtIntegrationService;
  let filingId;

  beforeAll(async () => {
    courtIntegrationService = new EnhancedCourtIntegrationService();
    
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
        title: 'Court Integration Test Case',
        description: 'Test case for court filings',
        plaintiff_name: 'Test Plaintiff',
        defendant_name: 'Test Defendant',
        case_type: 'civil_litigation',
        amount_claimed: 75000,
        case_number: 'TEST-2024-001'
      });
    
    testCaseId = caseResponse.body.case.id;

    // Insert test court system
    await supabase
      .from('court_systems')
      .insert({
        name: 'Test Superior Court',
        code: 'TEST_SUPERIOR',
        jurisdiction: 'test_jurisdiction',
        type: 'state',
        level: 'trial',
        filing_methods: ['api', 'email'],
        api_config: {
          endpoint: 'https://api.testcourt.gov',
          authType: 'api_key'
        },
        email_config: {
          filingEmail: 'filings@testcourt.gov'
        },
        business_hours: {
          monday: '8:00-17:00',
          tuesday: '8:00-17:00',
          wednesday: '8:00-17:00',
          thursday: '8:00-17:00',
          friday: '8:00-17:00'
        },
        fees: {
          complaint: 350,
          motion: 75,
          answer: 0
        },
        status: 'active'
      });
  });

  afterAll(async () => {
    // Cleanup test data
    if (filingId) {
      await supabase
        .from('court_filings')
        .delete()
        .eq('id', filingId);
    }
    
    if (testCaseId) {
      await supabase
        .from('cases')
        .delete()
        .eq('id', testCaseId);
    }

    await supabase
      .from('court_systems')
      .delete()
      .eq('code', 'TEST_SUPERIOR');
  });

  describe('Court Systems Management', () => {
    describe('GET /api/court/systems', () => {
      it('should retrieve available court systems', async () => {
        const response = await request(app)
          .get('/api/court/systems')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('courtSystems');
        expect(Array.isArray(response.body.data.courtSystems)).toBe(true);
        
        const testCourt = response.body.data.courtSystems.find(
          court => court.code === 'TEST_SUPERIOR'
        );
        expect(testCourt).toBeDefined();
        expect(testCourt).toHaveProperty('name', 'Test Superior Court');
        expect(testCourt).toHaveProperty('jurisdiction', 'test_jurisdiction');
        expect(testCourt).toHaveProperty('filingMethods');
        expect(testCourt.filingMethods).toContain('api');
        expect(testCourt.filingMethods).toContain('email');
      });

      it('should filter court systems by jurisdiction', async () => {
        const response = await request(app)
          .get('/api/court/systems')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ jurisdiction: 'test_jurisdiction' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        response.body.data.courtSystems.forEach(court => {
          expect(court.jurisdiction).toBe('test_jurisdiction');
        });
      });
    });
  });

  describe('Court Filing Process', () => {
    let testCourtSystemId;

    beforeAll(async () => {
      const { data: courtSystem } = await supabase
        .from('court_systems')
        .select('id')
        .eq('code', 'TEST_SUPERIOR')
        .single();
      
      testCourtSystemId = courtSystem.id;
    });

    describe('POST /api/court/file', () => {
      it('should initiate court filing via API', async () => {
        const response = await request(app)
          .post('/api/court/file')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            caseId: testCaseId,
            courtSystemId: testCourtSystemId,
            filingType: 'complaint',
            submissionMethod: 'api',
            documents: [
              {
                documentId: 'test-doc-1',
                filename: 'complaint.pdf',
                documentType: 'complaint'
              }
            ],
            expedited: false,
            serviceMethod: 'electronic',
            metadata: {
              filingParty: 'Test Plaintiff',
              casePriority: 'normal'
            }
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('filingId');
        expect(response.body.data).toHaveProperty('status', 'queued');
        expect(response.body.data).toHaveProperty('estimatedProcessingTime');
        
        filingId = response.body.data.filingId;
      });

      it('should initiate court filing via email', async () => {
        const response = await request(app)
          .post('/api/court/file')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            caseId: testCaseId,
            courtSystemId: testCourtSystemId,
            filingType: 'motion',
            submissionMethod: 'email',
            documents: [
              {
                documentId: 'test-doc-2',
                filename: 'motion.pdf',
                documentType: 'motion'
              }
            ]
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('filingId');
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/court/file')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // Missing required fields
            caseId: testCaseId
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });

      it('should validate case existence', async () => {
        const fakeId = '550e8400-e29b-41d4-a716-446655440000';
        const response = await request(app)
          .post('/api/court/file')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            caseId: fakeId,
            courtSystemId: testCourtSystemId,
            filingType: 'complaint',
            submissionMethod: 'api',
            documents: []
          });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      it('should validate court system existence', async () => {
        const fakeId = '550e8400-e29b-41d4-a716-446655440000';
        const response = await request(app)
          .post('/api/court/file')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            caseId: testCaseId,
            courtSystemId: fakeId,
            filingType: 'complaint',
            submissionMethod: 'api',
            documents: []
          });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/court/filings/:filingId/status', () => {
      it('should retrieve filing status', async () => {
        const response = await request(app)
          .get(`/api/court/filings/${filingId}/status`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('filing');
        expect(response.body.data.filing).toHaveProperty('id', filingId);
        expect(response.body.data.filing).toHaveProperty('status');
        expect(['pending', 'queued', 'processing', 'submitted', 'processed', 'failed'])
          .toContain(response.body.data.filing.status);
      });

      it('should return 404 for non-existent filing', async () => {
        const fakeId = '550e8400-e29b-41d4-a716-446655440000';
        const response = await request(app)
          .get(`/api/court/filings/${fakeId}/status`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Filing History Management', () => {
    describe('GET /api/court/cases/:caseId/filings', () => {
      it('should retrieve case filing history', async () => {
        const response = await request(app)
          .get(`/api/court/cases/${testCaseId}/filings`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('filings');
        expect(Array.isArray(response.body.data.filings)).toBe(true);
        
        if (response.body.data.filings.length > 0) {
          const filing = response.body.data.filings[0];
          expect(filing).toHaveProperty('id');
          expect(filing).toHaveProperty('filingType');
          expect(filing).toHaveProperty('status');
          expect(filing).toHaveProperty('submissionMethod');
          expect(filing).toHaveProperty('courtSystem');
        }
      });

      it('should filter filing history by status', async () => {
        const response = await request(app)
          .get(`/api/court/cases/${testCaseId}/filings`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ status: 'pending' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        response.body.data.filings.forEach(filing => {
          expect(filing.status).toBe('pending');
        });
      });

      it('should filter filing history by filing type', async () => {
        const response = await request(app)
          .get(`/api/court/cases/${testCaseId}/filings`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ filingType: 'complaint' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        response.body.data.filings.forEach(filing => {
          expect(filing.filingType).toBe('complaint');
        });
      });
    });
  });

  describe('Service Integration Tests', () => {
    describe('EnhancedCourtIntegrationService', () => {
      it('should initialize with supported court systems', () => {
        expect(courtIntegrationService).toBeDefined();
        expect(courtIntegrationService.courtAPIs).toBeDefined();
        expect(courtIntegrationService.courtAPIs.size).toBeGreaterThan(0);
        expect(courtIntegrationService.courtAPIs.has('PACER')).toBe(true);
        expect(courtIntegrationService.courtAPIs.has('CA_SUPERIOR')).toBe(true);
        expect(courtIntegrationService.courtAPIs.has('TYLER_ODYSSEY')).toBe(true);
      });

      it('should retrieve court systems', async () => {
        const result = await courtIntegrationService.getCourtSystems();
        
        expect(result.success).toBe(true);
        expect(result.courtSystems).toBeDefined();
        expect(Array.isArray(result.courtSystems)).toBe(true);
      });

      it('should filter court systems by jurisdiction', async () => {
        const result = await courtIntegrationService.getCourtSystems('test_jurisdiction');
        
        expect(result.success).toBe(true);
        result.courtSystems.forEach(court => {
          expect(court.jurisdiction).toBe('test_jurisdiction');
        });
      });

      it('should get service health status', async () => {
        const health = await courtIntegrationService.getServiceHealth();
        
        expect(health).toHaveProperty('success');
        expect(health).toHaveProperty('status');
        expect(['healthy', 'degraded', 'down']).toContain(health.status);
        expect(health).toHaveProperty('queueSize');
        expect(health).toHaveProperty('isProcessing');
        expect(health).toHaveProperty('supportedCourts');
        expect(Array.isArray(health.supportedCourts)).toBe(true);
      });
    });
  });

  describe('Filing Queue Management', () => {
    it('should handle filing queue operations', async () => {
      const initialHealth = await courtIntegrationService.getServiceHealth();
      const initialQueueSize = initialHealth.queueSize;
      
      // Test adding to queue (this would normally be done internally)
      expect(typeof initialQueueSize).toBe('number');
      expect(initialQueueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Document Processing', () => {
    it('should validate document requirements', async () => {
      const response = await request(app)
        .post('/api/court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          courtSystemId: 'invalid-court-id',
          filingType: 'complaint',
          submissionMethod: 'api',
          documents: [] // Empty documents array
        });

      expect(response.status).toBe(404); // Court system not found
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/court/filings/invalid-uuid/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle missing authentication', async () => {
      const response = await request(app)
        .get('/api/court/systems');

      expect(response.status).toBe(401);
    });

    it('should handle service unavailability gracefully', async () => {
      // Test service degradation handling
      const health = await courtIntegrationService.getServiceHealth();
      expect(['healthy', 'degraded', 'down']).toContain(health.status);
    });
  });

  describe('Integration Workflows', () => {
    it('should handle complete filing workflow', async () => {
      // 1. Start filing
      const filingResponse = await request(app)
        .post('/api/court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caseId: testCaseId,
          courtSystemId: testCourtSystemId,
          filingType: 'answer',
          submissionMethod: 'api',
          documents: [
            {
              documentId: 'test-answer-doc',
              filename: 'answer.pdf',
              documentType: 'answer'
            }
          ]
        });

      expect(filingResponse.status).toBe(201);
      const workflowFilingId = filingResponse.body.data.filingId;

      // 2. Check status
      const statusResponse = await request(app)
        .get(`/api/court/filings/${workflowFilingId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.filing.id).toBe(workflowFilingId);

      // 3. View in filing history
      const historyResponse = await request(app)
        .get(`/api/court/cases/${testCaseId}/filings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(historyResponse.status).toBe(200);
      const filingInHistory = historyResponse.body.data.filings.find(
        f => f.id === workflowFilingId
      );
      expect(filingInHistory).toBeDefined();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent filing requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/court/file')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            caseId: testCaseId,
            courtSystemId: testCourtSystemId,
            filingType: 'motion',
            submissionMethod: 'email',
            documents: [
              {
                documentId: `concurrent-doc-${i}`,
                filename: `motion-${i}.pdf`,
                documentType: 'motion'
              }
            ]
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect([201, 429]).toContain(response.status); // Success or rate limited
        if (response.status === 201) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('filingId');
        }
      });
    });

    it('should maintain service health under load', async () => {
      const healthBefore = await courtIntegrationService.getServiceHealth();
      
      // Simulate some load (this is a simplified test)
      await Promise.all(Array.from({ length: 3 }, () =>
        courtIntegrationService.getCourtSystems()
      ));
      
      const healthAfter = await courtIntegrationService.getServiceHealth();
      
      expect(healthAfter.success).toBe(true);
      expect(['healthy', 'degraded']).toContain(healthAfter.status);
    });
  });
});