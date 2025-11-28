// Performance Middleware - Request tracking and optimization
const PerformanceOptimizationService = require('../services/PerformanceOptimizationService');
const { logger } = require('../lib/logger');

// Request timing middleware
const requestTimer = (req, res, next) => {
  req.startTime = Date.now();
  
  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    PerformanceOptimizationService.trackResponseTime(duration);
    
    // Log slow requests (> 5 seconds)
    if (duration > 5000) {
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
};

// Response compression middleware
const compression = require('compression');
const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balance between speed and compression ratio
});

// Cache control middleware
const cacheControl = (maxAge = 300) => {
  return (req, res, next) => {
    // Set cache headers for GET requests only
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${maxAge}`);
    } else {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
  };
};

// ETag middleware for conditional requests
const etag = require('etag');
const conditionalRequest = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (req.method === 'GET' && res.statusCode === 200) {
      const entityTag = etag(data);
      res.set('ETag', entityTag);
      
      // Check if client has cached version
      if (req.headers['if-none-match'] === entityTag) {
        res.status(304).end();
        return;
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Request size limiter
const requestSizeLimiter = (maxSize = '10mb') => {
  return require('express').json({ limit: maxSize });
};

// API response optimization middleware
const optimizeResponse = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Remove null/undefined fields to reduce payload size
    const optimized = removeNullUndefined(data);
    
    // Add response metadata
    if (req.startTime) {
      const duration = Date.now() - req.startTime;
      res.set('X-Response-Time', `${duration}ms`);
    }
    
    originalJson.call(this, optimized);
  };
  
  next();
};

// Helper function to remove null/undefined values
function removeNullUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeNullUndefined).filter(v => v !== null && v !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const value = removeNullUndefined(obj[key]);
      if (value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }
  return obj;
}

// Memory monitoring middleware
const memoryMonitor = (req, res, next) => {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  
  // Warn if memory usage is high (> 1GB)
  if (heapUsedMB > 1024) {
    logger.warn(`High memory usage: ${heapUsedMB}MB`);
  }
  
  next();
};

// Database query optimization middleware
const optimizeDbQueries = (req, res, next) => {
  // Add query optimization hints to request
  req.dbOptimize = {
    useCache: true,
    batchQueries: true,
    selectFields: true // Only select needed fields
  };
  
  next();
};

module.exports = {
  requestTimer,
  compressionMiddleware,
  cacheControl,
  conditionalRequest,
  requestSizeLimiter,
  optimizeResponse,
  memoryMonitor,
  optimizeDbQueries
};