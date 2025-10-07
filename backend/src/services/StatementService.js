// Statement Service - Manage party statements for disputes
const { supabase } = require('../lib/supabaseClient');
const { logger } = require('../lib/logger');
const { v4: uuidv4 } = require('uuid');
const Case = require('../models/Case');
const CaseParty = require('../models/CaseParty');

class StatementService {
  // Submit or update a statement
  async submitStatement(caseId, partyUserId, content, attachments = []) {
    try {
      logger.info(`Submitting statement for case ${caseId} by user ${partyUserId}`);

      // Verify party is part of the case
      const party = await CaseParty.findOne({
        case_id: caseId,
        user_id: partyUserId
      });

      if (!party) {
        throw new Error('User is not a party to this case');
      }

      // Check if party already has a statement
      const { data: existing, error: fetchError } = await supabase
        .from('case_statements')
        .select('*')
        .eq('case_id', caseId)
        .eq('party_id', partyUserId)
        .eq('is_finalized', false)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to check existing statements: ${fetchError.message}`);
      }

      const version = existing ? existing.version + 1 : 1;

      // Create new statement
      const statement = {
        id: uuidv4(),
        case_id: caseId,
        party_id: partyUserId,
        party_role: party.role,
        version,
        content,
        attachments: JSON.stringify(attachments),
        submitted_at: new Date().toISOString(),
        is_finalized: false,
        word_count: content.split(/\s+/).length,
        metadata: JSON.stringify({
          attachmentCount: attachments.length,
          editHistory: existing ? [...(JSON.parse(existing.metadata || '{}').editHistory || []), {
            version: existing.version,
            timestamp: existing.submitted_at
          }] : []
        })
      };

      const { data, error } = await supabase
        .from('case_statements')
        .insert([statement])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to submit statement: ${error.message}`);
      }

      logger.info(`Statement submitted successfully`, { statementId: data.id, version });

      return {
        success: true,
        statement: data
      };

    } catch (error) {
      logger.error(`Failed to submit statement:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Finalize a statement (lock it from further edits)
  async finalizeStatement(caseId, partyUserId) {
    try {
      logger.info(`Finalizing statement for case ${caseId} by user ${partyUserId}`);

      // Get the latest statement
      const { data: statement, error: fetchError } = await supabase
        .from('case_statements')
        .select('*')
        .eq('case_id', caseId)
        .eq('party_id', partyUserId)
        .eq('is_finalized', false)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to fetch statement: ${fetchError.message}`);
      }

      if (!statement) {
        throw new Error('No statement found to finalize');
      }

      // Finalize the statement
      const { data, error } = await supabase
        .from('case_statements')
        .update({
          is_finalized: true,
          finalized_at: new Date().toISOString()
        })
        .eq('id', statement.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to finalize statement: ${error.message}`);
      }

      // Check if both parties have finalized
      await this.checkBothFinalized(caseId);

      logger.info(`Statement finalized successfully`, { statementId: data.id });

      return {
        success: true,
        statement: data
      };

    } catch (error) {
      logger.error(`Failed to finalize statement:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check if both parties have finalized statements
  async checkBothFinalized(caseId) {
    try {
      // Get all parties
      const parties = await CaseParty.findAll({ case_id: caseId });
      
      if (parties.length < 2) {
        return { allFinalized: false, reason: 'Not all parties have joined' };
      }

      // Check if each party has a finalized statement
      const finalizedCount = await Promise.all(
        parties.map(async (party) => {
          const { data, error } = await supabase
            .from('case_statements')
            .select('id')
            .eq('case_id', caseId)
            .eq('party_id', party.user_id)
            .eq('is_finalized', true)
            .maybeSingle();

          return data ? 1 : 0;
        })
      );

      const allFinalized = finalizedCount.reduce((a, b) => a + b, 0) === parties.length;

      if (allFinalized) {
        // Transition workflow to next stage
        const DisputeWorkflowService = require('./DisputeWorkflowService');
        await DisputeWorkflowService.transitionStage(
          caseId,
          DisputeWorkflowService.DisputeStage.STATEMENT_FINALIZED,
          'system',
          'All parties have finalized their statements'
        );

        logger.info(`All statements finalized for case ${caseId}`);
      }

      return {
        allFinalized,
        finalizedCount: finalizedCount.reduce((a, b) => a + b, 0),
        totalParties: parties.length
      };

    } catch (error) {
      logger.error(`Error checking finalized statements:`, error);
      return { allFinalized: false, error: error.message };
    }
  }

  // Get all statements for a case
  async getCaseStatements(caseId, userId) {
    try {
      // Verify user has access to case
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied to case statements');
      }

      const { data, error } = await supabase
        .from('case_statements')
        .select(`
          *,
          users!inner(id, full_name, email)
        `)
        .eq('case_id', caseId)
        .eq('is_finalized', true)
        .order('submitted_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch statements: ${error.message}`);
      }

      // Parse JSON fields
      const statements = data.map(stmt => ({
        ...stmt,
        attachments: JSON.parse(stmt.attachments || '[]'),
        metadata: JSON.parse(stmt.metadata || '{}')
      }));

      return {
        success: true,
        statements
      };

    } catch (error) {
      logger.error(`Failed to get case statements:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get a specific party's statement
  async getPartyStatement(caseId, partyUserId, includeDrafts = false) {
    try {
      let query = supabase
        .from('case_statements')
        .select('*')
        .eq('case_id', caseId)
        .eq('party_id', partyUserId)
        .order('version', { ascending: false });

      if (!includeDrafts) {
        query = query.eq('is_finalized', true);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch statement: ${error.message}`);
      }

      if (data) {
        data.attachments = JSON.parse(data.attachments || '[]');
        data.metadata = JSON.parse(data.metadata || '{}');
      }

      return {
        success: true,
        statement: data || null
      };

    } catch (error) {
      logger.error(`Failed to get party statement:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get statement status for all parties
  async getStatementStatus(caseId) {
    try {
      const parties = await CaseParty.findAll({ case_id: caseId });
      
      const statuses = await Promise.all(
        parties.map(async (party) => {
          const { data } = await supabase
            .from('case_statements')
            .select('id, version, is_finalized, finalized_at, word_count')
            .eq('case_id', caseId)
            .eq('party_id', party.user_id)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            partyId: party.user_id,
            partyRole: party.role,
            partyEmail: party.contact_email,
            hasStatement: !!data,
            isFinalized: data?.is_finalized || false,
            version: data?.version || 0,
            wordCount: data?.word_count || 0,
            finalizedAt: data?.finalized_at || null
          };
        })
      );

      const allFinalized = statuses.every(s => s.isFinalized);
      const anySubmitted = statuses.some(s => s.hasStatement);

      return {
        success: true,
        status: {
          parties: statuses,
          allFinalized,
          anySubmitted,
          readyForAnalysis: allFinalized && statuses.length >= 2
        }
      };

    } catch (error) {
      logger.error(`Failed to get statement status:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete a draft statement
  async deleteDraftStatement(caseId, partyUserId) {
    try {
      const { data, error } = await supabase
        .from('case_statements')
        .delete()
        .eq('case_id', caseId)
        .eq('party_id', partyUserId)
        .eq('is_finalized', false)
        .select();

      if (error) {
        throw new Error(`Failed to delete draft: ${error.message}`);
      }

      return {
        success: true,
        deleted: data.length
      };

    } catch (error) {
      logger.error(`Failed to delete draft statement:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get statement history (all versions)
  async getStatementHistory(caseId, partyUserId) {
    try {
      const { data, error } = await supabase
        .from('case_statements')
        .select('*')
        .eq('case_id', caseId)
        .eq('party_id', partyUserId)
        .order('version', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch statement history: ${error.message}`);
      }

      const history = data.map(stmt => ({
        ...stmt,
        attachments: JSON.parse(stmt.attachments || '[]'),
        metadata: JSON.parse(stmt.metadata || '{}')
      }));

      return {
        success: true,
        history
      };

    } catch (error) {
      logger.error(`Failed to get statement history:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new StatementService();
