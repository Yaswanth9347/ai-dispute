// Case Service - Business logic for case management
const Case = require('../models/Case');
const CaseParty = require('../models/CaseParty');
const User = require('../models/User');

class CaseService {
  // Create new case with parties
  async createCase(caseData, filedByUserId) {
    try {
      // Validate user exists
      const user = await User.findById(filedByUserId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create the case
      const newCase = await Case.createCase(caseData, filedByUserId);

      // Add filing user as claimant
      await CaseParty.addPartyToCase(newCase.id, {
        user_id: filedByUserId,
        contact_email: user.email,
        role: 'claimant'
      }, filedByUserId);

      // Add other parties if specified
      if (caseData.parties && caseData.parties.length > 0) {
        for (const partyData of caseData.parties) {
          await CaseParty.addPartyToCase(newCase.id, partyData, filedByUserId);
        }
      }

      return await Case.getCaseWithDetails(newCase.id);
    } catch (error) {
      throw new Error(`Failed to create case: ${error.message}`);
    }
  }

  // Get case details with access control
  async getCaseDetails(caseId, userId) {
    try {
      const caseDetails = await Case.getCaseWithDetails(caseId, userId);
      if (!caseDetails) {
        throw new Error('Case not found or access denied');
      }

      return caseDetails;
    } catch (error) {
      throw new Error(`Failed to get case details: ${error.message}`);
    }
  }

  // Update case information
  async updateCase(caseId, updates, userId) {
    try {
      // Check user access
      const hasAccess = await Case.checkUserAccess(caseId, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Validate updates
      const allowedFields = [
        'title', 'description', 'dispute_amount', 'currency', 
        'priority', 'deadline', 'metadata', 'settlement_eligible',
        'mediation_required'
      ];
      
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      return await Case.updateById(caseId, filteredUpdates);
    } catch (error) {
      throw new Error(`Failed to update case: ${error.message}`);
    }
  }

  // Progress case to next status
  async progressCase(caseId, userId, reason = '') {
    try {
      const caseDetails = await Case.findById(caseId);
      if (!caseDetails) {
        throw new Error('Case not found');
      }

      // Define status progression
      const statusFlow = {
        'draft': 'open',
        'open': 'analyzing',
        'analyzing': 'closed'
      };

      const nextStatus = statusFlow[caseDetails.status];
      if (!nextStatus) {
        throw new Error(`Cannot progress case from status: ${caseDetails.status}`);
      }

      return await Case.updateStatus(caseId, nextStatus, userId, reason);
    } catch (error) {
      throw new Error(`Failed to progress case: ${error.message}`);
    }
  }

  // Get user's cases with filtering
  async getUserCases(userId, filters = {}) {
    try {
      const { status, limit = 20, offset = 0, search } = filters;

      let cases;
      if (search) {
        cases = await Case.searchCases(search, userId, limit);
      } else {
        cases = await Case.getUserCases(userId, { status, limit, offset });
      }

      return cases;
    } catch (error) {
      throw new Error(`Failed to get user cases: ${error.message}`);
    }
  }

  // Add party to existing case
  async addPartyToCase(caseId, partyData, userId) {
    try {
      // Check if user has access to case
      const hasAccess = await Case.checkUserAccess(caseId, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      return await CaseParty.addPartyToCase(caseId, partyData, userId);
    } catch (error) {
      throw new Error(`Failed to add party to case: ${error.message}`);
    }
  }

  // Get case dashboard statistics
  async getDashboardStats(userId) {
    try {
      const [userCases, globalStats] = await Promise.all([
        Case.getUserCases(userId),
        Case.getCaseStats()
      ]);

      const userStats = {
        total: userCases.length,
        draft: userCases.filter(c => c.status === 'draft').length,
        active: userCases.filter(c => c.status === 'open').length,
        analyzing: userCases.filter(c => c.status === 'analyzing').length,
        closed: userCases.filter(c => c.status === 'closed').length
      };

      return {
        user_stats: userStats,
        global_stats: globalStats,
        recent_cases: userCases.slice(0, 5)
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard statistics: ${error.message}`);
    }
  }
}

module.exports = new CaseService();