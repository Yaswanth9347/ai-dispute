// Court Integration Model - Handle court integration operations
const BaseModel = require('./BaseModel');

class CourtIntegration extends BaseModel {
  constructor() {
    super('court_integrations');
  }

  // Create court integration record
  async createCourtFiling(filingData) {
    try {
      const filing = await this.create({
        case_id: filingData.case_id,
        court_system: filingData.court_system,
        court_jurisdiction: filingData.court_jurisdiction,
        filing_status: 'pending',
        filing_fee: filingData.filing_fee,
        fee_paid: false,
        court_documents: filingData.court_documents || {},
        metadata: filingData.metadata || {}
      });

      return filing;
    } catch (error) {
      throw new Error(`Failed to create court filing: ${error.message}`);
    }
  }

  // Update filing status
  async updateFilingStatus(filingId, status, updates = {}) {
    try {
      return await this.updateById(filingId, {
        filing_status: status,
        ...updates,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      throw new Error(`Failed to update filing status: ${error.message}`);
    }
  }

  // Get court integrations for a case
  async getCaseCourtIntegrations(caseId) {
    try {
      return await this.findMany(
        { case_id: caseId },
        { orderBy: 'created_at', ascending: false }
      );
    } catch (error) {
      throw new Error(`Failed to get court integrations: ${error.message}`);
    }
  }
}

module.exports = new CourtIntegration();