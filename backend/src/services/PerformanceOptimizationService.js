// Performance Optimization Service - Caching, query optimization, and resource management
const NodeCache = require('node-cache');
const { logger } = require('../lib/logger');
const { supabase } = require('../lib/supabaseClient');

class PerformanceOptimizationService {
  constructor() {
    // Initialize caching layers
    this.cacheConfig = {
      stdTTL: 600, // 10 minutes default TTL
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false // Don't clone objects for better performance
    };

    this.caches = {
      // User data cache - longer TTL
      users: new NodeCache({ ...this.cacheConfig, stdTTL: 1800 }), // 30 minutes
      
      // Case data cache - medium TTL
      cases: new NodeCache({ ...this.cacheConfig, stdTTL: 300 }), // 5 minutes
      
      // Templates cache - very long TTL
      templates: new NodeCache({ ...this.cacheConfig, stdTTL: 3600 }), // 1 hour
      
      // Analytics cache - short TTL
      analytics: new NodeCache({ ...this.cacheConfig, stdTTL: 60 }), // 1 minute
      
      // Court data cache - long TTL
      courts: new NodeCache({ ...this.cacheConfig, stdTTL: 86400 }) // 24 hours
    };

    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      queryCount: 0,
      slowQueries: [],
      avgResponseTime: 0,
      requestCount: 0
    };

    this.init();
  }

  init() {
    logger.info('Performance Optimization Service initialized');
    
    // Start metrics collection
    setInterval(() => this.collectMetrics(), 60000); // Every minute
  }

  // Cache Management Methods
  async getCached(cacheName, key, fetchFunction, ttl = null) {
    try {
      const cache = this.caches[cacheName];
      if (!cache) {
        logger.warn(`Cache ${cacheName} not found`);
        return await fetchFunction();
      }

      // Try to get from cache
      const cached = cache.get(key);
      if (cached !== undefined) {
        this.metrics.cacheHits++;
        return cached;
      }

      // Cache miss - fetch and store
      this.metrics.cacheMisses++;
      const data = await fetchFunction();
      
      if (data !== null && data !== undefined) {
        if (ttl) {
          cache.set(key, data, ttl);
        } else {
          cache.set(key, data);
        }
      }

      return data;
    } catch (error) {
      logger.error('Cache operation error:', error);
      // Fallback to direct fetch on cache error
      return await fetchFunction();
    }
  }

  invalidateCache(cacheName, key = null) {
    const cache = this.caches[cacheName];
    if (!cache) return;

    if (key) {
      cache.del(key);
    } else {
      cache.flushAll();
    }
  }

  // Optimized Database Query Methods
  async optimizedCaseQuery(caseId, includeRelations = false) {
    const cacheKey = `case_${caseId}_${includeRelations}`;
    
    return await this.getCached('cases', cacheKey, async () => {
      const startTime = Date.now();
      
      let query = supabase.from('cases').select('*');
      
      if (includeRelations) {
        query = query.select(`
          *,
          users!filed_by (id, email, full_name, phone),
          case_documents (id, document_type, original_filename, created_at),
          case_timeline (id, event_type, description, created_at)
        `);
      }
      
      const { data, error } = await query.eq('id', caseId).single();
      
      const duration = Date.now() - startTime;
      this.trackQuery('optimizedCaseQuery', duration);
      
      if (error) throw error;
      return data;
    }, 300); // 5 minute cache
  }

  async optimizedUserQuery(userId) {
    const cacheKey = `user_${userId}`;
    
    return await this.getCached('users', cacheKey, async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, role, created_at')
        .eq('id', userId)
        .single();
      
      const duration = Date.now() - startTime;
      this.trackQuery('optimizedUserQuery', duration);
      
      if (error) throw error;
      return data;
    }, 1800); // 30 minute cache
  }

  async batchCaseQuery(caseIds) {
    const startTime = Date.now();
    
    // Use Supabase's 'in' filter for efficient batch query
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .in('id', caseIds);
    
    const duration = Date.now() - startTime;
    this.trackQuery('batchCaseQuery', duration, caseIds.length);
    
    if (error) throw error;
    return data;
  }

  async paginatedQuery(table, page = 1, pageSize = 20, filters = {}) {
    const startTime = Date.now();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    let query = supabase.from(table).select('*', { count: 'exact' });
    
    // Apply filters
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        query = query.eq(key, filters[key]);
      }
    });
    
    const { data, error, count } = await query.range(from, to);
    
    const duration = Date.now() - startTime;
    this.trackQuery('paginatedQuery', duration);
    
    if (error) throw error;
    
    return {
      data,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    };
  }

  // Query Performance Tracking
  trackQuery(queryName, duration, recordCount = 1) {
    this.metrics.queryCount++;
    
    // Track slow queries (> 1 second)
    if (duration > 1000) {
      this.metrics.slowQueries.push({
        name: queryName,
        duration,
        recordCount,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 slow queries
      if (this.metrics.slowQueries.length > 100) {
        this.metrics.slowQueries.shift();
      }
      
      logger.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }
  }

  // Response Time Tracking
  trackResponseTime(duration) {
    this.metrics.requestCount++;
    const oldAvg = this.metrics.avgResponseTime;
    const count = this.metrics.requestCount;
    
    // Calculate running average
    this.metrics.avgResponseTime = (oldAvg * (count - 1) + duration) / count;
  }

  // Resource Optimization Methods
  async optimizeImageUpload(buffer, maxWidth = 1920, maxHeight = 1080) {
    try {
      const sharp = require('sharp');
      
      const optimized = await sharp(buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      
      const originalSize = buffer.length;
      const optimizedSize = optimized.length;
      const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
      
      logger.info(`Image optimized: ${originalSize} bytes -> ${optimizedSize} bytes (${savings}% reduction)`);
      
      return optimized;
    } catch (error) {
      logger.error('Image optimization error:', error);
      return buffer; // Return original if optimization fails
    }
  }

  async compressDocument(filePath) {
    try {
      const fs = require('fs').promises;
      const zlib = require('zlib');
      const { promisify } = require('util');
      const gzip = promisify(zlib.gzip);
      
      const data = await fs.readFile(filePath);
      const compressed = await gzip(data);
      
      const originalSize = data.length;
      const compressedSize = compressed.length;
      const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      
      logger.info(`Document compressed: ${originalSize} bytes -> ${compressedSize} bytes (${savings}% reduction)`);
      
      return compressed;
    } catch (error) {
      logger.error('Document compression error:', error);
      throw error;
    }
  }

  // Memory Management
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100 // MB
    };
  }

  // Database Connection Pooling
  async optimizeDatabaseConnections() {
    // Supabase handles connection pooling automatically
    // This method can be used for custom optimizations
    logger.info('Database connection pooling check');
  }

  // Metrics Collection
  collectMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      cache: {
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses
      },
      queries: {
        total: this.metrics.queryCount,
        slowQueries: this.metrics.slowQueries.length,
        avgResponseTime: Math.round(this.metrics.avgResponseTime)
      },
      memory: this.getMemoryUsage(),
      requests: this.metrics.requestCount
    };
    
    logger.info('Performance Metrics:', metrics);
    
    // Reset counters for next period
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    
    return metrics;
  }

  // Get current performance statistics
  getPerformanceStats() {
    return {
      cache: {
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100 || 0,
        totalHits: this.metrics.cacheHits,
        totalMisses: this.metrics.cacheMisses,
        cacheStats: Object.keys(this.caches).reduce((acc, name) => {
          const cache = this.caches[name];
          acc[name] = {
            keys: cache.keys().length,
            stats: cache.getStats()
          };
          return acc;
        }, {})
      },
      queries: {
        total: this.metrics.queryCount,
        slowQueries: this.metrics.slowQueries,
        avgResponseTime: Math.round(this.metrics.avgResponseTime)
      },
      memory: this.getMemoryUsage(),
      requests: {
        total: this.metrics.requestCount,
        avgResponseTime: Math.round(this.metrics.avgResponseTime)
      }
    };
  }

  // Cleanup Methods
  async cleanup() {
    // Clear all caches
    Object.values(this.caches).forEach(cache => cache.flushAll());
    
    // Reset metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      queryCount: 0,
      slowQueries: [],
      avgResponseTime: 0,
      requestCount: 0
    };
    
    logger.info('Performance caches cleared');
  }

  // Warmup cache with frequently accessed data
  async warmupCache() {
    try {
      logger.info('Starting cache warmup...');
      
      // Warmup templates
      const DocumentTemplateService = require('./DocumentTemplateService');
      const templates = await DocumentTemplateService.listTemplates();
      templates.forEach(template => {
        this.caches.templates.set(`template_${template.name}`, template);
      });
      
      // Warmup courts
      const CourtReferralService = require('./CourtReferralService');
      const fs = require('fs').promises;
      const path = require('path');
      try {
        const courtsData = await fs.readFile(
          path.join(__dirname, '../../storage/courts.json'),
          'utf8'
        );
        this.caches.courts.set('courts_database', JSON.parse(courtsData));
      } catch (error) {
        logger.warn('Could not warmup courts cache:', error.message);
      }
      
      logger.info('Cache warmup complete');
    } catch (error) {
      logger.error('Cache warmup error:', error);
    }
  }
}

// Export singleton instance
module.exports = new PerformanceOptimizationService();