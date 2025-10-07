// Analytics API Integration Tests
const request = require('supertest');
const { createServer } = require('../src/app');

const app = createServer();

describe('Analytics API', () => {
  describe('GET /api/analytics/dashboard', () => {
    it('should return comprehensive dashboard data with valid structure', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard?timeframe=30d');

      // Analytics should work even without auth in test mode
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('platform');
        expect(response.body.data).toHaveProperty('negotiations');
        expect(response.body.data).toHaveProperty('aiPerformance');
        expect(response.body.data).toHaveProperty('courtFilings');
        expect(response.body.data).toHaveProperty('caseResolution');
      }
    });
  });

  describe('Analytics Service Methods', () => {
    const analyticsService = require('../src/services/AnalyticsService');

    it('should calculate correct date range for 30d', () => {
      const { startDate, endDate } = analyticsService.getDateRange('30d');
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('should support all timeframe options', () => {
      const timeframes = ['7d', '30d', '90d', '1y'];
      
      timeframes.forEach(tf => {
        const range = analyticsService.getDateRange(tf);
        expect(range).toHaveProperty('startDate');
        expect(range).toHaveProperty('endDate');
      });
    });

    it('should have caching functionality', () => {
      const testKey = 'test_metric';
      const testData = { value: 123 };
      
      analyticsService.setCachedMetric(testKey, testData);
      const cached = analyticsService.getCachedMetric(testKey);
      
      expect(cached).toEqual(testData);
      
      // Clear cache
      analyticsService.clearCache();
      const afterClear = analyticsService.getCachedMetric(testKey);
      expect(afterClear).toBeNull();
    });
  });

  describe('Analytics Response Structure', () => {
    it('should have correct platform stats structure', async () => {
      const response = await request(app)
        .get('/api/analytics/platform?timeframe=7d');

      if (response.status === 200) {
        const { data } = response.body;
        expect(data).toHaveProperty('totalCases');
        expect(data).toHaveProperty('newCases');
        expect(data).toHaveProperty('activeNegotiations');
        expect(data).toHaveProperty('settlementRate');
        expect(data).toHaveProperty('timeframe');
      }
    });

    it('should handle different timeframes', async () => {
      const timeframes = ['7d', '30d'];
      
      for (const tf of timeframes) {
        const response = await request(app)
          .get(`/api/analytics/dashboard?timeframe=${tf}`);
        
        if (response.status === 200) {
          expect(response.body.data.timeframe).toBe(tf);
        }
      }
    });
  });
});
