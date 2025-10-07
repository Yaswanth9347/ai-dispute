// Services Index - Export implemented business logic services
const CaseService = require('./CaseService');
const TimelineService = require('./TimelineService');

// Phase 2 AI Services - IMPLEMENTED
const GeminiService = require('./GeminiService');
const AIAnalysisService = require('./AIAnalysisService');

// TODO: Implement remaining services
// const SettlementService = require('./SettlementService');
// const InvitationService = require('./InvitationService');
// const DocumentService = require('./DocumentService');
// const SignatureService = require('./SignatureService');
// const NotificationService = require('./NotificationService');
// const CourtService = require('./CourtService');

module.exports = {
  CaseService,
  TimelineService,
  // Phase 2 AI Services
  GeminiService,
  AIAnalysisService
  // Additional services will be added here
};