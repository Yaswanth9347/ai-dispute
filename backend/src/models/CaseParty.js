// Case Party Model - Handle case party operations
const BaseModel = require('./BaseModel');

class CaseParty extends BaseModel {
  constructor() {
    super('case_parties');
  }

  // Add party to case
  async addPartyToCase(caseId, partyData, invitedBy) {
    try {
      // Validate required fields
      if (!caseId || !partyData.contact_email || !partyData.role) {
        throw new Error('Case ID, contact email, and role are required');
      }

      // Check if party already exists in case
      const existingParty = await this.findPartyInCase(caseId, partyData.contact_email);
      if (existingParty) {
        throw new Error('Party already exists in this case');
      }

      // Create party record
      const party = await this.create({
        case_id: caseId,
        user_id: partyData.user_id || null,
        role: partyData.role, // 'claimant' or 'respondent'
        contact_email: partyData.contact_email,
        responded: false
      });

      // Add timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: caseId,
        event_type: 'party_added',
        event_title: 'Party Added',
        event_description: `${partyData.role} ${partyData.contact_email} has been added to the case`,
        actor_id: invitedBy,
        metadata: { 
          party_id: party.id, 
          party_role: partyData.role,
          party_email: partyData.contact_email 
        },
        is_public: true
      });

      return party;
    } catch (error) {
      throw new Error(`Failed to add party to case: ${error.message}`);
    }
  }

  // Find party in case by email
  async findPartyInCase(caseId, email) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('case_id', caseId)
        .eq('contact_email', email)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to find party in case: ${error.message}`);
    }
  }

  // Get all parties for a case
  async getCaseParties(caseId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          users (name, email, user_type)
        `)
        .eq('case_id', caseId)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get case parties: ${error.message}`);
    }
  }

  // Mark party as responded
  async markPartyResponded(partyId, userId = null) {
    try {
      const updates = {
        responded: true,
        responded_at: new Date().toISOString()
      };

      if (userId) {
        updates.user_id = userId;
      }

      const party = await this.updateById(partyId, updates);

      // Add timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: party.case_id,
        event_type: 'party_responded',
        event_title: 'Party Responded',
        event_description: `${party.role} has responded to the case invitation`,
        actor_id: userId,
        metadata: { party_id: partyId },
        is_public: true
      });

      return party;
    } catch (error) {
      throw new Error(`Failed to mark party as responded: ${error.message}`);
    }
  }

  // Get parties by user ID
  async getPartiesByUser(userId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          cases (id, title, status, created_at)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get parties by user: ${error.message}`);
    }
  }

  // Update party role (claimant/respondent)
  async updatePartyRole(partyId, newRole, updatedBy) {
    try {
      const validRoles = ['claimant', 'respondent'];
      if (!validRoles.includes(newRole)) {
        throw new Error('Invalid party role');
      }

      const party = await this.updateById(partyId, { role: newRole });

      // Add timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: party.case_id,
        event_type: 'party_role_updated',
        event_title: 'Party Role Updated',
        event_description: `Party role updated to ${newRole}`,
        actor_id: updatedBy,
        metadata: { party_id: partyId, new_role: newRole },
        is_public: true
      });

      return party;
    } catch (error) {
      throw new Error(`Failed to update party role: ${error.message}`);
    }
  }

  // Remove party from case
  async removePartyFromCase(partyId, removedBy) {
    try {
      const party = await this.findById(partyId);
      if (!party) {
        throw new Error('Party not found');
      }

      await this.deleteById(partyId);

      // Add timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: party.case_id,
        event_type: 'party_removed',
        event_title: 'Party Removed',
        event_description: `${party.role} ${party.contact_email} has been removed from the case`,
        actor_id: removedBy,
        metadata: { 
          party_email: party.contact_email,
          party_role: party.role 
        },
        is_public: true
      });

      return party;
    } catch (error) {
      throw new Error(`Failed to remove party from case: ${error.message}`);
    }
  }

  // Get case response statistics
  async getCaseResponseStats(caseId) {
    try {
      const parties = await this.getCaseParties(caseId);
      const total = parties.length;
      const responded = parties.filter(p => p.responded).length;
      const pending = total - responded;

      return {
        total,
        responded,
        pending,
        response_rate: total > 0 ? (responded / total * 100).toFixed(1) : '0'
      };
    } catch (error) {
      throw new Error(`Failed to get case response statistics: ${error.message}`);
    }
  }
}

module.exports = new CaseParty();