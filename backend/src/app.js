// backend/src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

let compression;
let pinoHttp;
let rateLimit;
let promClient;
try { compression = require('compression'); } catch (e) { compression = null; }
try { pinoHttp = require('pino-http')(); } catch (e) { pinoHttp = null; }
try { rateLimit = require('express-rate-limit'); } catch (e) { rateLimit = null; }
try { promClient = require('prom-client'); } catch (e) { promClient = null; }

const app = express();

// Ensure uploads directory exists on startup
const fs = require('fs');
const uploadsDir = require('path').join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.warn('Could not create uploads directory:', e.message);
}

// Allow multiple frontend ports and local hosts (development convenience)
const allowedOrigins = ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3000', 'http://127.0.0.1:3000'];

// basic middleware
if (pinoHttp) app.use(pinoHttp);
app.use(cors({ 
  origin: function(origin, callback) {
    // allow requests with no origin (mobile clients, curl, Postman) or same-origin
    if (!origin) return callback(null, true);
    try {
      const url = new URL(origin);
      // allow localhost or 127.0.0.1 with any port during development
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return callback(null, true);
    } catch (e) {
      // fall back to exact match
    }
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (compression) app.use(compression());
if (rateLimit) app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// collect default metrics
if (promClient) promClient.collectDefaultMetrics();

// mount routes (import routers)
// mount only minimal routes in test to avoid loading heavy modules that
// may use ESM-only dependencies (e.g. uuid v13) which break Jest.
const healthRouter = require('./routes/health');
app.use('/health', healthRouter);

// Detect test environment robustly: Jest sets JEST_WORKER_ID. dotenv may override
// NODE_ENV from .env, so prefer JEST_WORKER_ID when running under Jest.
const isTest = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';

// In test we mount only the routers we need for isolation. Mount auth in tests
if (isTest) {
  const authRouter = require('./routes/auth');
  const advancedAIRouter = require('./routes/advancedAI');
  // Active Settlement Negotiation Routes for testing
  const activeNegotiationsRouter = require('./routes/activeNegotiations');
  // Enhanced Court Integration Routes for testing
  const enhancedCourtRouter = require('./routes/enhancedCourt');
  // Analytics Routes for testing
  const analyticsRouter = require('./routes/analytics');
  
  app.use('/api/auth', authRouter);
  app.use('/api/ai/advanced', advancedAIRouter);
  app.use('/api/active-negotiations', activeNegotiationsRouter);
  app.use('/api/enhanced-court', enhancedCourtRouter);
  app.use('/api/analytics', analyticsRouter);
}

if (!isTest) {
  // require and mount full routers in normal runtime
  const casesRouter = require('./routes/cases');
  const analyzeRouter = require('./routes/analyze');
  const processCaseRouter = require('./routes/processCase');
  const evidenceRouter = require('./routes/evidence');
  const evidenceStatusRouter = require('./routes/evidenceStatus');
  const caseEvidenceListRouter = require('./routes/caseEvidenceList');
  const evidenceDownloadRouter = require('./routes/evidenceDownload');
  const evidenceSignedRouter = require('./routes/evidenceSigned');
  const authRouter = require('./routes/auth');
  const caseDecisionsRouter = require('./routes/caseDecisions');
  const settlementRouter = require('./routes/settlement');
  const settlementSignRouter = require('./routes/settlementSign');
  const reconcileRouter = require('./routes/reconcile');
  const adminRevokeRouter = require('./routes/adminRevoke');
  const esignRouter = require('./routes/esign');
  // V2 API Routes
  const casesV2Router = require('./routes/casesV2');
  // AI Analysis Routes (Phase 2)
  const aiRouter = require('./routes/ai');
  // Multi-Party Routes (Phase 3)
  const multipartyRouter = require('./routes/multiparty');
  // Advanced AI Routes (Phase 4)
  const advancedAIRouter = require('./routes/advancedAI');
  // Document Generation Routes (Phase 5)
  const documentsRouter = require('./routes/documents');
  // Court Integration Routes (Phase 5.2)
  const courtRouter = require('./routes/court');
  // Enhanced Court Integration Routes (Phase 5.2 - Real API)
  const enhancedCourtRouter = require('./routes/enhancedCourt');
  // Workflow Automation Routes (Phase 5.4)
  const workflowRouter = require('./routes/workflow');
  // Settlement Negotiation Routes (Phase 4.2) 
  const negotiationsRouter = require('./routes/negotiations');
  // Active Settlement Negotiation Routes (Phase 4.2 - Real-time)
  const activeNegotiationsRouter = require('./routes/activeNegotiations');
  // Analytics Routes (Phase 5.5)
  const analyticsRouter = require('./routes/analytics');
  // Notification Routes (Phase 3 - Real-time)
  const notificationsRouter = require('./controllers/NotificationController');
  // User Profile Routes (Phase 3)
  const usersRouter = require('./routes/user');
  // AI Chat Routes (Phase 3)
  const aiChatRouter = require('./controllers/AIChatController');
  // Workflow Automation Routes (Phase 3)
  const workflowsRouter = require('./controllers/WorkflowController');

  app.use('/api/cases', settlementRouter);
  app.use('/api/cases', casesRouter);
  app.use('/api/cases', processCaseRouter);
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/evidence', evidenceRouter);
  app.use('/api/evidence', evidenceStatusRouter);
  app.use('/api/cases', caseEvidenceListRouter);
  app.use('/api/evidence', evidenceDownloadRouter);
  app.use('/api/evidence', evidenceSignedRouter);
  app.use('/api/auth', authRouter);
  app.use('/debug', require('./routes/debug'));
  app.use('/api/cases', caseDecisionsRouter);
  app.use('/api/cases', settlementSignRouter);
  app.use('/api/cases', reconcileRouter);
  app.use('/api/admin', adminRevokeRouter);
  app.use('/api', esignRouter);
  // V2 API and AI Analysis endpoints
  app.use('/api/v2/cases', casesV2Router);
  app.use('/api/ai', aiRouter);
  // Multi-Party API endpoints (Phase 3)
  app.use('/api/multi-party', multipartyRouter);
  // Advanced AI API endpoints (Phase 4)
  app.use('/api/ai/advanced', advancedAIRouter);
  // Document Generation API endpoints (Phase 5)
  app.use('/api/documents', documentsRouter);
  // Court Integration API endpoints (Phase 5.2)
  app.use('/api/court', courtRouter);
  // Enhanced Court Integration API endpoints (Phase 5.2 - Real API)
  app.use('/api/enhanced-court', enhancedCourtRouter);
  // Workflow Automation API endpoints (Phase 5.4)
  app.use('/api/workflow', workflowRouter);
  // Settlement Negotiation API endpoints (Phase 4.2)
  app.use('/api/negotiations', negotiationsRouter);
  // Active Settlement Negotiation API endpoints (Phase 4.2 - Real-time)
  app.use('/api/active-negotiations', activeNegotiationsRouter);
  // Analytics API endpoints (Phase 5.5)
  app.use('/api/analytics', analyticsRouter);
  // Notification API endpoints (Phase 3 - Real-time)
  app.use('/api/notifications', notificationsRouter);
  // User Profile API endpoints (Phase 3)
  app.use('/api/users', usersRouter);
// Serve uploaded profile photos statically
app.use('/uploads', express.static('uploads'));
  // AI Chat API endpoints (Phase 3)
  app.use('/api/ai', aiChatRouter);
  // Workflow API endpoints (Phase 3)
  app.use('/api/workflows', workflowsRouter);
  // Dispute Resolution Routes (NEW - Complete Workflow)
  const disputesRouter = require('./routes/disputes');
  app.use('/api/disputes', disputesRouter);
}

// metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.get('/', (req, res) => res.send('AI Dispute Resolver backend (app module)'));

// Default export is the express app
module.exports = app;

// Helpful test helper: allow importing { createServer } from src/app
// Tests often destructure createServer — provide a helper while keeping
// the default export as the app instance to avoid breaking runtime imports.
module.exports.createServer = () => app;
