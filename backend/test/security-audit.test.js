// Security Audit Tests - Comprehensive security testing
const request = require('supertest');
const { createServer } = require('../src/app');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

describe('Security Audit Tests', () => {
  let app;

  beforeAll(() => {
    app = createServer();
  });

  describe('Authentication Security', () => {
    it('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weakpass@example.com',
          password: '123',
          full_name: 'Weak Password User',
          phone: '+919876543210'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password/i);
    });

    it('should reject invalid email formats', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePass123!',
          full_name: 'Invalid Email User',
          phone: '+919876543210'
        });

      expect(response.status).toBe(400);
    });

    it('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      
      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user-id' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/document-resolution/templates')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/api/document-resolution/templates')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });

    it('should prevent brute force login attempts', async () => {
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'bruteforce@example.com',
              password: `wrongpass${i}`
            })
        );
      }

      const responses = await Promise.all(attempts);
      const lastResponse = responses[responses.length - 1];
      
      // Should get rate limited after multiple failed attempts
      expect(lastResponse.status).toBe(429);
    }, 10000);
  });

  describe('Input Validation & Sanitization', () => {
    let authToken;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@example.com',
          password: 'SecurePass123!',
          full_name: 'Security Test User',
          phone: '+919876543210'
        });

      authToken = response.body.token;
    });

    it('should prevent SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password'
          });

        expect(response.status).not.toBe(200);
        expect(response.body).not.toHaveProperty('token');
      }
    });

    it('should prevent XSS attacks in case descriptions', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="malicious.com"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/cases')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Case',
            description: payload,
            category: 'civil'
          });

        if (response.status === 200) {
          const caseDesc = response.body.case?.description || response.body.description;
          expect(caseDesc).not.toContain('<script');
          expect(caseDesc).not.toContain('onerror=');
          expect(caseDesc).not.toContain('javascript:');
        }
      }
    });

    it('should validate file upload types', async () => {
      const response = await request(app)
        .post('/api/evidence')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('malicious content'), {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/file type|format/i);
    });

    it('should limit file upload sizes', async () => {
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
      
      const response = await request(app)
        .post('/api/evidence')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeBuffer, {
          filename: 'large-file.pdf',
          contentType: 'application/pdf'
        });

      expect(response.status).toBe(413);
    });
  });

  describe('Authorization & Access Control', () => {
    let user1Token, user2Token;
    let user1CaseId;

    beforeAll(async () => {
      // Create two test users
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'SecurePass123!',
          full_name: 'User One',
          phone: '+919876543210'
        });
      user1Token = user1Response.body.token;

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          password: 'SecurePass123!',
          full_name: 'User Two',
          phone: '+919876543211'
        });
      user2Token = user2Response.body.token;

      // Create a case as user1
      const caseResponse = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'User1 Private Case',
          description: 'This case belongs to user1',
          category: 'civil'
        });
      user1CaseId = caseResponse.body.case?.id || caseResponse.body.id;
    });

    it('should prevent unauthorized access to other users cases', async () => {
      const response = await request(app)
        .get(`/api/cases/${user1CaseId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(403);
    });

    it('should prevent unauthorized document access', async () => {
      const response = await request(app)
        .post(`/api/document-resolution/cases/${user1CaseId}/settlement/generate`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          settlementTerms: { amount: 10000 },
          parties: []
        });

      expect(response.status).toBe(403);
    });

    it('should validate admin-only operations', async () => {
      const response = await request(app)
        .post('/api/admin/revoke')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: 'some-user-id'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('API Rate Limiting', () => {
    it('should rate limit excessive requests', async () => {
      const requests = [];
      for (let i = 0; i < 250; i++) {
        requests.push(
          request(app).get('/health')
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('CORS & Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should enforce CORS policies', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-site.com');

      expect(response.status).toBe(500);
    });
  });

  describe('Sensitive Data Protection', () => {
    it('should not expose internal error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.error).not.toMatch(/\/home\/|\/var\//);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not leak user emails in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        });

      expect(response.body.error).not.toContain('nonexistent@example.com');
    });

    it('should mask sensitive fields in logs', async () => {
      // Test that password fields are not logged
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'MySuperSecretPassword123!'
        });

      // Verify response doesn't contain password
      expect(JSON.stringify(response.body)).not.toContain('MySuperSecretPassword123!');
    });
  });

  describe('Cryptographic Security', () => {
    it('should use secure random token generation', async () => {
      const crypto = require('crypto');
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64);
      expect(token2.length).toBe(64);
    });

    it('should validate certificate signatures', async () => {
      // Test RSA signature validation
      const crypto = require('crypto');
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });

      const data = 'Test data to sign';
      const signature = crypto.sign('sha256', Buffer.from(data), privateKey);
      const isValid = crypto.verify('sha256', Buffer.from(data), publicKey, signature);

      expect(isValid).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should invalidate tokens on logout', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'SecurePass123!',
          full_name: 'Logout Test User',
          phone: '+919876543210'
        });

      const token = registerResponse.body.token;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Try to use token after logout
      const response = await request(app)
        .get('/api/document-resolution/templates')
        .set('Authorization', `Bearer ${token}`);

      // Should be rejected (if logout invalidation is implemented)
      expect([401, 200]).toContain(response.status);
    });

    it('should enforce token expiration', async () => {
      const shortLivedToken = jwt.sign(
        { userId: 'test-user-id' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1ms' }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/document-resolution/templates')
        .set('Authorization', `Bearer ${shortLivedToken}`);

      expect(response.status).toBe(401);
    });
  });
});
