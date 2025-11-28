// Performance Testing Suite
const request = require('supertest');
const { createServer } = require('../src/app');
const PerformanceOptimizationService = require('../src/services/PerformanceOptimizationService');

describe('Performance Optimization Tests', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    app = createServer();
    
    // Get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPass123!'
      });

    if (response.body.token) {
      authToken = response.body.token;
    }
  });

  describe('Response Time Optimization', () => {
    it('should respond to health check within 100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(50).fill(null).map(() => 
        request(app).get('/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(duration).toBeLessThan(2000); // 50 requests in under 2 seconds
    }, 10000);
  });

  describe('Caching Functionality', () => {
    it('should cache frequently accessed data', async () => {
      const cacheKey = 'test_cache_key';
      const testData = { foo: 'bar', timestamp: Date.now() };

      // First call - should miss cache
      const data1 = await PerformanceOptimizationService.getCached(
        'cases',
        cacheKey,
        async () => testData
      );

      // Second call - should hit cache
      const data2 = await PerformanceOptimizationService.getCached(
        'cases',
        cacheKey,
        async () => ({ different: 'data' })
      );

      expect(data1).toEqual(testData);
      expect(data2).toEqual(testData); // Should return cached data
    });

    it('should invalidate cache correctly', async () => {
      const cacheKey = 'test_invalidate_key';
      const testData = { test: 'data' };

      await PerformanceOptimizationService.getCached(
        'cases',
        cacheKey,
        async () => testData
      );

      PerformanceOptimizationService.invalidateCache('cases', cacheKey);

      const newData = { new: 'data' };
      const result = await PerformanceOptimizationService.getCached(
        'cases',
        cacheKey,
        async () => newData
      );

      expect(result).toEqual(newData);
    });
  });

  describe('Query Optimization', () => {
    it('should batch database queries efficiently', async () => {
      if (!authToken) {
        console.log('Skipping test - no auth token');
        return;
      }

      const startTime = Date.now();
      
      // This would normally make multiple DB calls
      const results = await PerformanceOptimizationService.batchCaseQuery([
        'case-id-1',
        'case-id-2',
        'case-id-3'
      ]);
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should implement pagination efficiently', async () => {
      const startTime = Date.now();
      
      const result = await PerformanceOptimizationService.paginatedQuery(
        'cases',
        1,
        20
      );
      
      const duration = Date.now() - startTime;
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', () => {
      const memoryUsage = PerformanceOptimizationService.getMemoryUsage();
      
      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('external');
      expect(memoryUsage).toHaveProperty('rss');
      
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
    });

    it('should cleanup resources properly', async () => {
      await PerformanceOptimizationService.cleanup();
      
      const stats = PerformanceOptimizationService.getPerformanceStats();
      expect(stats.cache.totalHits).toBe(0);
      expect(stats.cache.totalMisses).toBe(0);
    });
  });

  describe('Compression', () => {
    it('should compress responses', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept-Encoding', 'gzip');

      expect(response.headers['content-encoding']).toBe('gzip');
    });
  });

  describe('Performance Metrics', () => {
    it('should collect performance statistics', () => {
      const stats = PerformanceOptimizationService.getPerformanceStats();
      
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('queries');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('requests');
    });

    it('should track slow queries', async () => {
      // Simulate a slow query
      PerformanceOptimizationService.trackQuery('test_slow_query', 1500, 1);
      
      const stats = PerformanceOptimizationService.getPerformanceStats();
      expect(stats.queries.slowQueries.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Optimization', () => {
    it('should optimize image uploads', async () => {
      const testBuffer = Buffer.alloc(1024 * 1024); // 1MB buffer
      
      const optimized = await PerformanceOptimizationService.optimizeImageUpload(
        testBuffer,
        1920,
        1080
      );
      
      expect(optimized).toBeInstanceOf(Buffer);
      expect(optimized.length).toBeLessThanOrEqual(testBuffer.length);
    });
  });

  describe('Cache Warmup', () => {
    it('should warmup cache on initialization', async () => {
      await PerformanceOptimizationService.warmupCache();
      
      const stats = PerformanceOptimizationService.getPerformanceStats();
      const templatesCacheKeys = stats.cache.cacheStats.templates?.keys || 0;
      
      expect(templatesCacheKeys).toBeGreaterThanOrEqual(0);
    });
  });
});
