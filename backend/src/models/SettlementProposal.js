// Settlement Proposal Model - Handle settlement operations
const BaseModel = require('./BaseModel');

class SettlementProposal extends BaseModel {
  constructor() {
    super('settlement_proposals');
  }

  // Create settlement proposal
  async createProposal(proposalData) {
    try {
      const proposal = await this.create({
        case_id: proposalData.case_id,
        proposed_by: proposalData.proposed_by,
        proposal_type: proposalData.proposal_type || 'monetary',
        amount: proposalData.amount,
        currency: proposalData.currency || 'USD',
        terms: proposalData.terms,
        conditions: proposalData.conditions || {},
        deadline: proposalData.deadline,
        status: 'pending',
        response_deadline: proposalData.response_deadline,
        is_ai_generated: proposalData.is_ai_generated || false,
        ai_confidence: proposalData.ai_confidence,
        metadata: proposalData.metadata || {}
      });

      return proposal;
    } catch (error) {
      throw new Error(`Failed to create settlement proposal: ${error.message}`);
    }
  }

  // Get proposals for a case
  async getCaseProposals(caseId) {
    try {
      return await this.findMany(
        { case_id: caseId },
        { orderBy: 'created_at', ascending: false }
      );
    } catch (error) {
      throw new Error(`Failed to get case proposals: ${error.message}`);
    }
  }

  // Update proposal status
  async updateStatus(proposalId, status, updatedBy) {
    try {
      return await this.updateById(proposalId, {
        status,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      throw new Error(`Failed to update proposal status: ${error.message}`);
    }
  }

  // Get active proposals for a case
  async getActiveProposals(caseId) {
    try {
      return await this.findMany({
        case_id: caseId,
        status: 'pending'
      });
    } catch (error) {
      throw new Error(`Failed to get active proposals: ${error.message}`);
    }
  }
}

module.exports = new SettlementProposal();