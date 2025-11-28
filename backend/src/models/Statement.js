// Statement Model - Handle case statements from both parties
const BaseModel = require('./BaseModel');

class Statement extends BaseModel {
  constructor() {
    super('statements');
  }

  // Create a new statement
  async createStatement(statementData) {
    try {
      // Validate required fields
      if (!statementData.case_id || !statementData.user_id || !statementData.content) {
        throw new Error('Case ID, user ID, and content are required');
      }

      // Check if statement phase is still active
      const Case = require('./Case');
      const caseRecord = await Case.findById(statementData.case_id);
      
      if (!caseRecord) {
        throw new Error('Case not found');
      }

      if (caseRecord.status !== 'statement_phase' && caseRecord.status !== 'open') {
        throw new Error('Statement submission is not allowed in current case status');
      }

      // Check deadline if set
      if (caseRecord.statement_deadline) {
        const deadline = new Date(caseRecord.statement_deadline);
        if (new Date() > deadline) {
          throw new Error('Statement submission deadline has passed');
        }
      }

      // Determine party type based on user relationship to case
      let partyType = 'other';
      if (caseRecord.filed_by === statementData.user_id) {
        partyType = 'complainer';
      } else if (caseRecord.defender_email) {
        // Check if user email matches defender email
        const User = require('./User');
        const user = await User.findById(statementData.user_id);
        if (user && user.email === caseRecord.defender_email) {
          partyType = 'defender';
        }
      }

      const statement = await this.create({
        case_id: statementData.case_id,
        user_id: statementData.user_id,
        party_type: partyType,
        content: statementData.content,
        statement_type: statementData.statement_type || 'written',
        is_public: statementData.is_public || true,
        word_count: statementData.content.split(' ').length,
        metadata: statementData.metadata || {}
      });

      // Create timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: statementData.case_id,
        event_type: 'statement_added',
        event_title: `${partyType} Statement Submitted`,
        event_description: `New statement added by ${partyType}`,
        actor_id: statementData.user_id,
        is_public: true,
        metadata: { statement_id: statement.id, party_type: partyType }
      });

      // Emit real-time update
      const realTimeService = require('../services/RealTimeService');
      realTimeService.broadcastToCaseRoom(statementData.case_id, 'statement_added', {
        statementId: statement.id,
        partyType,
        userId: statementData.user_id,
        content: statementData.content,
        createdAt: statement.created_at
      });

      return statement;
    } catch (error) {
      throw new Error(`Failed to create statement: ${error.message}`);
    }
  }

  // Get statements for a case
  async getCaseStatements(caseId, userId = null) {
    try {
      // Check user access to case
      if (userId) {
        const Case = require('./Case');
        const hasAccess = await Case.checkUserAccess(caseId, userId);
        if (!hasAccess) {
          throw new Error('Access denied to case statements');
        }
      }

      const { data: statements, error } = await this.supabase
        .from('statements')
        .select(`
          *,
          users (name, email, avatar_url),
          statement_evidence (
            evidence_id,
            evidence (file_name, file_url, file_type, description)
          )
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return statements || [];
    } catch (error) {
      throw new Error(`Failed to get case statements: ${error.message}`);
    }
  }

  // Update statement (only within edit time window)
  async updateStatement(statementId, userId, updates) {
    try {
      const statement = await this.findById(statementId);
      if (!statement) {
        throw new Error('Statement not found');
      }

      // Check if user owns the statement
      if (statement.user_id !== userId) {
        throw new Error('Access denied: Cannot edit statement');
      }

      // Check if statement is still editable (within 15 minutes of creation)
      const createdAt = new Date(statement.created_at);
      const now = new Date();
      const timeDiff = (now - createdAt) / (1000 * 60); // in minutes

      if (timeDiff > 15) {
        throw new Error('Statement editing time limit exceeded');
      }

      const allowedUpdates = {
        content: updates.content,
        metadata: updates.metadata
      };

      // Update word count if content changed
      if (updates.content) {
        allowedUpdates.word_count = updates.content.split(' ').length;
        allowedUpdates.edited_at = new Date().toISOString();
      }

      const updatedStatement = await this.updateById(statementId, allowedUpdates);

      // Emit real-time update
      const realTimeService = require('../services/RealTimeService');
      realTimeService.broadcastToCaseRoom(statement.case_id, 'statement_updated', {
        statementId,
        partyType: statement.party_type,
        content: updates.content || statement.content,
        editedAt: allowedUpdates.edited_at
      });

      return updatedStatement;
    } catch (error) {
      throw new Error(`Failed to update statement: ${error.message}`);
    }
  }

  // Delete statement (only within short time window)
  async deleteStatement(statementId, userId) {
    try {
      const statement = await this.findById(statementId);
      if (!statement) {
        throw new Error('Statement not found');
      }

      // Check if user owns the statement
      if (statement.user_id !== userId) {
        throw new Error('Access denied: Cannot delete statement');
      }

      // Check if statement is still deletable (within 5 minutes of creation)
      const createdAt = new Date(statement.created_at);
      const now = new Date();
      const timeDiff = (now - createdAt) / (1000 * 60); // in minutes

      if (timeDiff > 5) {
        throw new Error('Statement deletion time limit exceeded');
      }

      await this.deleteById(statementId);

      // Emit real-time update
      const realTimeService = require('../services/RealTimeService');
      realTimeService.broadcastToCaseRoom(statement.case_id, 'statement_deleted', {
        statementId,
        partyType: statement.party_type
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to delete statement: ${error.message}`);
    }
  }

  // Get statement statistics for a case
  async getStatementStats(caseId) {
    try {
      const { data: statements, error } = await this.supabase
        .from('statements')
        .select('party_type, word_count, created_at')
        .eq('case_id', caseId);

      if (error) throw error;

      const stats = {
        total: statements.length,
        complainer: {
          count: statements.filter(s => s.party_type === 'complainer').length,
          totalWords: statements
            .filter(s => s.party_type === 'complainer')
            .reduce((sum, s) => sum + (s.word_count || 0), 0)
        },
        defender: {
          count: statements.filter(s => s.party_type === 'defender').length,
          totalWords: statements
            .filter(s => s.party_type === 'defender')
            .reduce((sum, s) => sum + (s.word_count || 0), 0)
        },
        lastStatementAt: statements.length > 0 
          ? statements.reduce((latest, s) => 
              new Date(s.created_at) > new Date(latest) ? s.created_at : latest, 
              statements[0].created_at
            )
          : null
      };

      return stats;
    } catch (error) {
      throw new Error(`Failed to get statement statistics: ${error.message}`);
    }
  }

  // Attach evidence to statement
  async attachEvidence(statementId, evidenceIds, userId) {
    try {
      const statement = await this.findById(statementId);
      if (!statement) {
        throw new Error('Statement not found');
      }

      // Check if user owns the statement
      if (statement.user_id !== userId) {
        throw new Error('Access denied: Cannot attach evidence to statement');
      }

      const attachments = evidenceIds.map(evidenceId => ({
        statement_id: statementId,
        evidence_id: evidenceId,
        attached_by: userId,
        attached_at: new Date().toISOString()
      }));

      const { data, error } = await this.supabase
        .from('statement_evidence')
        .insert(attachments);

      if (error) throw error;

      // Emit real-time update
      const realTimeService = require('../services/RealTimeService');
      realTimeService.broadcastToCaseRoom(statement.case_id, 'statement_evidence_attached', {
        statementId,
        evidenceIds,
        partyType: statement.party_type
      });

      return data;
    } catch (error) {
      throw new Error(`Failed to attach evidence: ${error.message}`);
    }
  }

  // Check if both parties have submitted statements
  async checkStatementsComplete(caseId) {
    try {
      const { data: statements, error } = await this.supabase
        .from('statements')
        .select('party_type')
        .eq('case_id', caseId);

      if (error) throw error;

      const partyTypes = [...new Set(statements.map(s => s.party_type))];
      const hasComplainer = partyTypes.includes('complainer');
      const hasDefender = partyTypes.includes('defender');

      return {
        isComplete: hasComplainer && hasDefender,
        hasComplainer,
        hasDefender,
        totalStatements: statements.length
      };
    } catch (error) {
      throw new Error(`Failed to check statements completion: ${error.message}`);
    }
  }

  // Get user's statements across all cases
  async getUserStatements(userId, options = {}) {
    try {
      const { limit = 50, offset = 0, caseId = null } = options;

      let query = this.supabase
        .from('statements')
        .select(`
          *,
          cases (title, case_number, status)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (caseId) {
        query = query.eq('case_id', caseId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      throw new Error(`Failed to get user statements: ${error.message}`);
    }
  }
}

module.exports = new Statement();