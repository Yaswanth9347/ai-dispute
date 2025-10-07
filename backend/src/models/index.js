// Models Index - Export all database models
const Case = require('./Case');
const User = require('./User');
const CaseParty = require('./CaseParty');
const Evidence = require('./Evidence');
const AIAnalysis = require('./AIAnalysis');
const SettlementProposal = require('./SettlementProposal');
const DigitalSignature = require('./DigitalSignature');
const CaseTimeline = require('./CaseTimeline');
const CaseCommunication = require('./CaseCommunication');
const CourtIntegration = require('./CourtIntegration');

module.exports = {
  Case,
  User,
  CaseParty,
  Evidence,
  AIAnalysis,
  SettlementProposal,
  DigitalSignature,
  CaseTimeline,
  CaseCommunication,
  CourtIntegration
};