// Controllers Index - Export implemented API controllers
const CaseController = require('./CaseController');

// Phase 2 AI Controller - IMPLEMENTED
const AIController = require('./AIController');

// TODO: Implement remaining controllers
// const AuthController = require('./AuthController');
// const EvidenceController = require('./EvidenceController');
// const SettlementController = require('./SettlementController');
// const DocumentController = require('./DocumentController');
// const SignatureController = require('./SignatureController');
// const CommunicationController = require('./CommunicationController');
// const CourtController = require('./CourtController');

module.exports = {
  CaseController,
  // Phase 2 AI Controller
  AIController
  // Additional controllers will be added here
};