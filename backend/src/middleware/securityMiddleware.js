// Security Hardening Middleware - Comprehensive security implementation
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const { logger } = require('../lib/logger');

// Rate limiting configuration
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Strict rate limiter for authentication endpoints
const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again later'
);

// API rate limiter
const apiRateLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  100, // 100 requests
  'API rate limit exceeded'
);

// File upload rate limiter
const uploadRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // 20 uploads
  'Upload limit exceeded, please try again later'
);

// Helmet security headers configuration
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize req.body, req.query, and req.params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      let value = obj[key];
      
      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        value = sanitizeObject(value);
      }
      
      // Sanitize strings
      if (typeof value === 'string') {
        // Remove potential XSS
        value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        value = value.replace(/javascript:/gi, '');
        value = value.replace(/on\w+\s*=/gi, '');
        
        // Remove potential SQL injection
        value = value.replace(/('|(\\')|(--)|(\$)|(%27)|(%23)|(#))/gi, '');
      }
      
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// SQL injection prevention
const preventSQLInjection = (req, res, next) => {
  const dangerousPatterns = [
    /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(--|#|\/\*|\*\/)/g,
    /(\bOR\b\s+\d+\s*=\s*\d+|\bAND\b\s+\d+\s*=\s*\d+)/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return dangerousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };

  const checkObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (checkValue(value)) return true;
        if (typeof value === 'object' && value !== null) {
          if (checkObject(value)) return true;
        }
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    logger.warn(`SQL injection attempt detected from IP: ${req.ip}`);
    return res.status(400).json({ error: 'Invalid input detected' });
  }

  next();
};

// File upload security
const secureFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      logger.warn(`Invalid file type uploaded: ${file.mimetype}`);
      return { valid: false, error: 'Invalid file type' };
    }
    if (file.size > maxFileSize) {
      logger.warn(`File too large: ${file.size} bytes`);
      return { valid: false, error: 'File size exceeds limit' };
    }
    return { valid: true };
  };

  const files = req.files ? Object.values(req.files).flat() : [req.file];
  
  for (const file of files) {
    if (file) {
      const validation = validateFile(file);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }
  }

  next();
};

// JWT token validation
const validateJWT = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next();
  }

  // Check for suspicious token patterns
  if (token.split('.').length !== 3) {
    logger.warn(`Invalid JWT format from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Invalid token format' });
  }

  next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  };

  // Log authentication attempts
  if (req.path.includes('/auth/')) {
    logger.info('Auth request:', logData);
  }

  // Log admin actions
  if (req.path.includes('/admin/')) {
    logger.info('Admin action:', logData);
  }

  next();
};

// Prevent parameter pollution
const parameterPollutionProtection = hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'filter']
});

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove powered-by header
  res.removeHeader('X-Powered-By');
  
  next();
};

// Combine all security middleware
const applySecurity = (app) => {
  // Apply helmet
  app.use(helmetConfig);
  
  // Apply CORS
  app.use(cors(corsOptions));
  
  // Security headers
  app.use(securityHeaders);
  
  // NoSQL injection prevention
  app.use(mongoSanitize());
  
  // XSS prevention
  app.use(xss());
  
  // Parameter pollution prevention
  app.use(parameterPollutionProtection);
  
  // Input sanitization
  app.use(sanitizeInput);
  
  // SQL injection prevention
  app.use(preventSQLInjection);
  
  // JWT validation
  app.use(validateJWT);
  
  // Security logging
  app.use(securityLogger);
  
  // API rate limiting (apply to all routes)
  app.use('/api/', apiRateLimiter);
  
  // Strict rate limiting for auth
  app.use('/api/auth/login', authRateLimiter);
  app.use('/api/auth/register', authRateLimiter);
  
  // Upload rate limiting
  app.use('/api/evidence', uploadRateLimiter);
  app.use('/api/documents', uploadRateLimiter);
};

module.exports = {
  applySecurity,
  authRateLimiter,
  apiRateLimiter,
  uploadRateLimiter,
  secureFileUpload,
  sanitizeInput,
  preventSQLInjection,
  securityLogger,
  helmetConfig,
  corsOptions
};