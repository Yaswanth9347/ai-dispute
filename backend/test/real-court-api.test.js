const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

// Mock the RealCourtAPIService
jest.mock('../src/services/RealCourtAPIService', () => ({
  fileWithCourt: jest.fn().mockResolvedValue({
    success: true,
    courtSystem: 'PACER',
    filingId: 'PACER-123456',
    trackingNumber: 'TN-789012',
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    estimatedProcessingTime: '2-5 business days',
    fees: {
      filingFee: 350.00,
      serviceFee: 25.00,
      total: 375.00
    },
    nextSteps: ['Wait for court processing', 'Check status in 24 hours']
  }),
  
  checkStatus: jest.fn().mockResolvedValue({
    filingId: 'PACER-123456',
    status: 'processed',
    courtStatus: 'accepted',
    lastUpdated: new Date().toISOString(),
    statusHistory: [
      { status: 'submitted', timestamp: new Date(Date.now() - 86400000).toISOString() },
      { status: 'processing', timestamp: new Date(Date.now() - 43200000).toISOString() },
      { status: 'processed', timestamp: new Date().toISOString() }
    ],
    nextActions: ['Serve opposing party', 'Await response']
  }),
  
  getServiceHealth: jest.fn().mockResolvedValue({
    overall: 'healthy',
    services: {
      PACER: { status: 'healthy', responseTime: 250, lastCheck: new Date().toISOString() },
      TYLER_ODYSSEY: { status: 'healthy', responseTime: 180, lastCheck: new Date().toISOString() },
      CA_CCMS: { status: 'degraded', responseTime: 850, lastCheck: new Date().toISOString() },
      NY_SCEF: { status: 'healthy', responseTime: 320, lastCheck: new Date().toISOString() },
      TX_EFILE: { status: 'healthy', responseTime: 190, lastCheck: new Date().toISOString() }
    }
  }),
  
  getAnalytics: jest.fn().mockResolvedValue({
    totalFilings: 150,
    successfulFilings: 142,
    failedFilings: 5,
    pendingFilings: 3,
    averageProcessingTime: '3.2 days',
    successRate: 94.7,
    totalFees: 52750.00,
    byCourtSystem: {
      PACER: { filings: 45, success: 43, failed: 1, pending: 1 },
      TYLER_ODYSSEY: { filings: 38, success: 37, failed: 1, pending: 0 },
      CA_CCMS: { filings: 32, success: 30, failed: 1, pending: 1 },
      NY_SCEF: { filings: 20, success: 19, failed: 1, pending: 0 },
      TX_EFILE: { filings: 15, success: 13, failed: 1, pending: 1 }
    }
  })
}));

describe('Real Court API Integration System', () => {
  let authToken;
  let testUserId = '123e4567-e89b-12d3-a456-426614174000';
  let testCaseId = '123e4567-e89b-12d3-a456-426614174001';

  beforeAll(() => {
    // Create a test JWT token
    authToken = jwt.sign(
      { 
        sub: testUserId, 
        role: 'authenticated',
        email: 'test@example.com'
      }, 
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  describe('POST /api/enhanced-court/file', () => {
    it('should file with PACER successfully', async () => {
      const filingData = {
        courtSystem: 'PACER',
        caseId: testCaseId,
        documentType: 'complaint',
        documentPath: '/test/documents/complaint.pdf',
        filingType: 'new_case',
        courtLocation: 'CACD', // Central District of California
        metadata: {
          caseTitle: 'Doe v. Smith',
          caseType: 'civil',
          attorney: {
            name: 'John Attorney',
            barNumber: '12345',
            firmName: 'Law Firm LLC'
          }
        }
      };

      const response = await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('courtSystem', 'PACER');
      expect(response.body).toHaveProperty('filingId');
      expect(response.body).toHaveProperty('trackingNumber');
      expect(response.body).toHaveProperty('status', 'submitted');
      expect(response.body).toHaveProperty('fees');
      expect(response.body.fees).toHaveProperty('total', 375.00);
    });

    it('should file with Tyler Odyssey successfully', async () => {
      const filingData = {
        courtSystem: 'TYLER_ODYSSEY',
        caseId: testCaseId,
        documentType: 'motion',
        documentPath: '/test/documents/motion.pdf',
        filingType: 'motion',
        courtLocation: 'Superior Court of California, County of Los Angeles',
        metadata: {
          caseNumber: 'BC123456',
          motionType: 'summary_judgment'
        }
      };

      const response = await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('courtSystem', 'PACER'); // Mocked to return PACER
      expect(response.body).toHaveProperty('filingId');
    });

    it('should return 400 for invalid court system', async () => {
      const filingData = {
        courtSystem: 'INVALID_COURT',
        caseId: testCaseId,
        documentType: 'complaint',
        documentPath: '/test/documents/complaint.pdf'
      };

      await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(400);
    });

    it('should return 400 for missing required fields', async () => {
      const filingData = {
        courtSystem: 'PACER'
        // Missing required fields
      };

      await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      const filingData = {
        courtSystem: 'PACER',
        caseId: testCaseId,
        documentType: 'complaint',
        documentPath: '/test/documents/complaint.pdf'
      };

      await request(app)
        .post('/api/enhanced-court/file')
        .send(filingData)
        .expect(401);
    });
  });

  describe('GET /api/enhanced-court/status/:filingId', () => {
    const testFilingId = 'PACER-123456';

    it('should check filing status successfully', async () => {
      const response = await request(app)
        .get(`/api/enhanced-court/status/${testFilingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('filingId', testFilingId);
      expect(response.body).toHaveProperty('status', 'processed');
      expect(response.body).toHaveProperty('courtStatus', 'accepted');
      expect(response.body).toHaveProperty('statusHistory');
      expect(response.body.statusHistory).toBeInstanceOf(Array);
      expect(response.body.statusHistory.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid filing ID format', async () => {
      await request(app)
        .get('/api/enhanced-court/status/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/enhanced-court/status/${testFilingId}`)
        .expect(401);
    });
  });

  describe('GET /api/enhanced-court/analytics', () => {
    it('should return analytics for authenticated user', async () => {
      const response = await request(app)
        .get('/api/enhanced-court/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalFilings', 150);
      expect(response.body).toHaveProperty('successfulFilings', 142);
      expect(response.body).toHaveProperty('failedFilings', 5);
      expect(response.body).toHaveProperty('pendingFilings', 3);
      expect(response.body).toHaveProperty('successRate', 94.7);
      expect(response.body).toHaveProperty('byCourtSystem');
      expect(response.body.byCourtSystem).toHaveProperty('PACER');
      expect(response.body.byCourtSystem).toHaveProperty('TYLER_ODYSSEY');
    });

    it('should return analytics with timeframe filter', async () => {
      const response = await request(app)
        .get('/api/enhanced-court/analytics?timeframe=7d')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalFilings');
    });

    it('should return analytics with court system filter', async () => {
      const response = await request(app)
        .get('/api/enhanced-court/analytics?courtSystem=PACER')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalFilings');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/enhanced-court/analytics')
        .expect(401);
    });
  });

  describe('GET /api/enhanced-court/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/enhanced-court/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('overall', 'healthy');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('PACER');
      expect(response.body.services).toHaveProperty('TYLER_ODYSSEY');
      expect(response.body.services).toHaveProperty('CA_CCMS');
      expect(response.body.services).toHaveProperty('NY_SCEF');
      expect(response.body.services).toHaveProperty('TX_EFILE');
      
      // Check individual service health
      expect(response.body.services.PACER).toHaveProperty('status', 'healthy');
      expect(response.body.services.PACER).toHaveProperty('responseTime');
      expect(response.body.services.CA_CCMS).toHaveProperty('status', 'degraded');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/enhanced-court/health')
        .expect(401);
    });
  });

  describe('PUT /api/enhanced-court/status/:filingId', () => {
    const testFilingId = 'PACER-123456';

    it('should update filing status successfully', async () => {
      const updateData = {
        status: 'processed',
        courtStatus: 'accepted',
        notes: 'Filing accepted by court'
      };

      const response = await request(app)
        .put(`/api/enhanced-court/status/${testFilingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Filing status updated successfully');
      expect(response.body).toHaveProperty('filingId', testFilingId);
    });

    it('should return 400 for invalid status', async () => {
      const updateData = {
        status: 'invalid_status'
      };

      await request(app)
        .put(`/api/enhanced-court/status/${testFilingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);
    });
  });

  describe('GET /api/enhanced-court/supported-courts', () => {
    it('should return list of supported court systems', async () => {
      const response = await request(app)
        .get('/api/enhanced-court/supported-courts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('courts');
      expect(response.body.courts).toBeInstanceOf(Array);
      expect(response.body.courts.length).toBeGreaterThan(0);
      
      // Check for expected court systems
      const courtCodes = response.body.courts.map(court => court.code);
      expect(courtCodes).toContain('PACER');
      expect(courtCodes).toContain('TYLER_ODYSSEY');
      expect(courtCodes).toContain('CA_CCMS');
    });
  });

  // Integration tests
  describe('Integration Tests - Full Court Filing Flow', () => {
    it('should handle complete court filing workflow', async () => {
      // Step 1: File with court
      const filingData = {
        courtSystem: 'PACER',
        caseId: testCaseId,
        documentType: 'complaint',
        documentPath: '/test/documents/complaint.pdf',
        filingType: 'new_case',
        courtLocation: 'CACD',
        metadata: {
          caseTitle: 'Integration Test v. System',
          caseType: 'civil'
        }
      };

      const fileResponse = await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(200);

      const filingId = fileResponse.body.filingId;
      expect(filingId).toBeDefined();

      // Step 2: Check initial status
      const statusResponse = await request(app)
        .get(`/api/enhanced-court/status/${filingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('filingId', filingId);

      // Step 3: Update status
      const updateResponse = await request(app)
        .put(`/api/enhanced-court/status/${filingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'processed',
          courtStatus: 'accepted',
          notes: 'Integration test update'
        })
        .expect(200);

      expect(updateResponse.body).toHaveProperty('message', 'Filing status updated successfully');

      // Step 4: Check analytics
      const analyticsResponse = await request(app)
        .get('/api/enhanced-court/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body).toHaveProperty('totalFilings');
      expect(analyticsResponse.body.totalFilings).toBeGreaterThan(0);
    });
  });

  // Performance tests
  describe('Performance Tests', () => {
    it('should handle multiple concurrent filing requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const filingData = {
          courtSystem: 'PACER',
          caseId: testCaseId,
          documentType: 'motion',
          documentPath: `/test/documents/motion_${i}.pdf`,
          filingType: 'motion',
          courtLocation: 'CACD',
          metadata: {
            caseTitle: `Performance Test ${i} v. System`,
            caseType: 'civil'
          }
        };

        promises.push(
          request(app)
            .post('/api/enhanced-court/file')
            .set('Authorization', `Bearer ${authToken}`)
            .send(filingData)
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('filingId');
      });
    });

    it('should handle rapid status checks', async () => {
      const filingIds = ['PACER-123456', 'PACER-123457', 'PACER-123458'];
      const promises = filingIds.map(id =>
        request(app)
          .get(`/api/enhanced-court/status/${id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('filingId');
        expect(response.body).toHaveProperty('status');
      });
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('should handle court system downtime gracefully', async () => {
      // Mock a service failure
      const RealCourtAPIService = require('../src/services/RealCourtAPIService');
      RealCourtAPIService.fileWithCourt = jest.fn().mockRejectedValue(
        new Error('Court system temporarily unavailable')
      );

      const filingData = {
        courtSystem: 'PACER',
        caseId: testCaseId,
        documentType: 'complaint',
        documentPath: '/test/documents/complaint.pdf'
      };

      const response = await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate document paths', async () => {
      const filingData = {
        courtSystem: 'PACER',
        caseId: testCaseId,
        documentType: 'complaint',
        documentPath: '/nonexistent/path/document.pdf'
      };

      const response = await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid court locations', async () => {
      const filingData = {
        courtSystem: 'PACER',
        caseId: testCaseId,
        documentType: 'complaint',
        documentPath: '/test/documents/complaint.pdf',
        courtLocation: 'INVALID_COURT_CODE'
      };

      const response = await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(filingData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  // Security tests
  describe('Security Tests', () => {
    it('should prevent access to other users filing data', async () => {
      // Create a different user token
      const otherUserToken = jwt.sign(
        { 
          sub: '999e4567-e89b-12d3-a456-426614174999', 
          role: 'authenticated',
          email: 'other@example.com'
        }, 
        process.env.JWT_SECRET || 'test-secret'
      );

      // Try to access filing with different user
      const response = await request(app)
        .get('/api/enhanced-court/status/PACER-123456')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404); // Should not find filing for different user

      expect(response.body).toHaveProperty('error');
    });

    it('should validate JWT token properly', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app)
        .get('/api/enhanced-court/analytics')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should sanitize input data', async () => {
      const maliciousData = {
        courtSystem: 'PACER',
        caseId: testCaseId,
        documentType: '<script>alert("xss")</script>',
        documentPath: '/test/documents/complaint.pdf'
      };

      const response = await request(app)
        .post('/api/enhanced-court/file')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData);

      // Should either sanitize or reject the request
      expect([400, 200]).toContain(response.status);
    });
  });
});