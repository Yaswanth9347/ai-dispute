// Consensus Detection and Re-analysis Service
const logger = require('../lib/logger');
const { supabaseAdmin } = require('../lib/supabaseClient');
const SettlementAIService = require('./SettlementAIService');
const NotificationService = require('./NotificationService');
const DisputeWorkflowService = require('./DisputeWorkflowService');

class ConsensusService {
  /**
   * Record party's option selection
   */
  async selectOption(caseId, userId, optionId, comments = null) {
    try {
      logger.info('Recording option selection', { caseId, userId, optionId });

      // Get party role
      const { data: party, error: partyError } = await supabaseAdmin
        .from('case_parties')
        .select('party_role')
        .eq('case_id', caseId)
        .eq('user_id', userId)
        .single();

      if (partyError || !party) {
        throw new Error('User is not a party in this case');
      }

      // Check if option exists
      const { data: option, error: optionError } = await supabaseAdmin
        .from('settlement_options')
        .select('*')
        .eq('option_id', optionId)
        .eq('case_id', caseId)
        .single();

      if (optionError || !option) {
        throw new Error('Settlement option not found');
      }

      // Record selection
      const { data: selection, error: selectError } = await supabaseAdmin
        .from('party_option_selections')
        .upsert({
          case_id: caseId,
          user_id: userId,
          party_role: party.party_role,
          option_id: optionId,
          selection_comments: comments,
          selected_at: new Date().toISOString()
        }, {
          onConflict: 'case_id,user_id'
        })
        .select()
        .single();

      if (selectError) {
        throw new Error('Failed to record selection');
      }

      logger.info('Option selection recorded', { selectionId: selection.selection_id });

      // Check for consensus
      await this.checkConsensus(caseId);

      return selection;

    } catch (error) {
      logger.error('Error selecting option:', error);
      throw error;
    }
  }

  /**
   * Check if both parties have reached consensus
   */
  async checkConsensus(caseId) {
    try {
      logger.info('Checking for consensus', { caseId });

      // Get all party selections
      const { data: selections, error } = await supabaseAdmin
        .from('party_option_selections')
        .select('*')
        .eq('case_id', caseId)
        .order('selected_at', { ascending: false });

      if (error) {
        throw new Error('Failed to retrieve selections');
      }

      // Need selections from both parties
      if (selections.length < 2) {
        logger.info('Waiting for both parties to select options', { caseId });
        return { consensus: false, reason: 'waiting_for_selections' };
      }

      // Get latest selection from each party
      const complainantSelection = selections.find(s => s.party_role === 'complainant');
      const respondentSelection = selections.find(s => s.party_role === 'respondent');

      if (!complainantSelection || !respondentSelection) {
        return { consensus: false, reason: 'missing_party_selection' };
      }

      // Check if they selected the same option
      if (complainantSelection.option_id === respondentSelection.option_id) {
        logger.info('🎉 CONSENSUS REACHED!', { 
          caseId, 
          optionId: complainantSelection.option_id 
        });

        // Update workflow to consensus reached
        await DisputeWorkflowService.transitionStage(
          caseId,
          'CONSENSUS_REACHED',
          `Both parties selected the same settlement option`
        );

        // Notify parties
        await NotificationService.notifyConsensusReached(caseId);

        return { 
          consensus: true, 
          optionId: complainantSelection.option_id,
          message: 'Consensus reached! Settlement document will be generated.' 
        };

      } else {
        logger.info('No consensus - different options selected', { 
          caseId,
          complainantOption: complainantSelection.option_id,
          respondentOption: respondentSelection.option_id
        });

        // Generate compromise option
        const compromiseOption = await SettlementAIService.generateCompromiseOption(
          caseId,
          complainantSelection.option_id,
          respondentSelection.option_id
        );

        // Update workflow to reanalysis
        await DisputeWorkflowService.transitionStage(
          caseId,
          'REANALYSIS',
          `Parties selected different options - compromise generated`
        );

        // Notify parties about compromise
        await this._notifyCompromiseGenerated(caseId, compromiseOption);

        return { 
          consensus: false, 
          reason: 'different_selections',
          compromiseOption,
          message: 'Parties chose different options. A compromise option has been generated.' 
        };
      }

    } catch (error) {
      logger.error('Error checking consensus:', error);
      throw error;
    }
  }

  /**
   * Handle rejection of all options - forward to court
   */
  async handleAllOptionsRejected(caseId) {
    try {
      logger.info('All options rejected - preparing court forwarding', { caseId });

      // Get party selections
      const { data: selections } = await supabaseAdmin
        .from('party_option_selections')
        .select('*, settlement_options(option_type)')
        .eq('case_id', caseId);

      // Check if both parties explicitly rejected all options
      const bothRejected = selections.length >= 2 && 
        selections.every(s => s.selection_comments?.toLowerCase().includes('reject'));

      if (bothRejected) {
        // Update workflow
        await DisputeWorkflowService.transitionStage(
          caseId,
          'FORWARDED_TO_COURT',
          'All settlement options rejected by both parties'
        );

        // Trigger court forwarding
        const CourtForwardingService = require('./CourtForwardingService');
        await CourtForwardingService.autoForwardCase(caseId, 'settlement_rejected');

        // Notify parties
        await NotificationService.notifyCaseForwarded(caseId);

        return {
          forwarded: true,
          message: 'Case is being forwarded to court as no settlement could be reached.'
        };
      }

      return { forwarded: false };

    } catch (error) {
      logger.error('Error handling rejection:', error);
      throw error;
    }
  }

  /**
   * Get consensus status for a case
   */
  async getConsensusStatus(caseId) {
    try {
      const { data: selections } = await supabaseAdmin
        .from('party_option_selections')
        .select(`
          *,
          settlement_options(option_type, description, complainant_receives),
          users(full_name)
        `)
        .eq('case_id', caseId);

      const complainantSelection = selections?.find(s => s.party_role === 'complainant');
      const respondentSelection = selections?.find(s => s.party_role === 'respondent');

      return {
        hasComplainantSelected: !!complainantSelection,
        hasRespondentSelected: !!respondentSelection,
        complainantSelection,
        respondentSelection,
        consensus: complainantSelection?.option_id === respondentSelection?.option_id,
        consensusOption: complainantSelection?.option_id === respondentSelection?.option_id 
          ? complainantSelection?.settlement_options 
          : null
      };

    } catch (error) {
      logger.error('Error getting consensus status:', error);
      throw error;
    }
  }

  /**
   * Notify parties about compromise option
   */
  async _notifyCompromiseGenerated(caseId, compromiseOption) {
    try {
      const { data: parties } = await supabaseAdmin
        .from('case_parties')
        .select('user_id, party_role, users(email, full_name)')
        .eq('case_id', caseId);

      for (const party of parties) {
        await NotificationService.createNotification({
          userId: party.user_id,
          caseId,
          type: NotificationService.notificationTypes.CASE_UPDATE,
          title: 'Compromise Option Generated',
          message: `Since you and the other party chose different settlement options, our AI has generated a compromise option: ${compromiseOption.description}`,
          priority: NotificationService.priorities.HIGH,
          actionUrl: `/disputes/${caseId}`,
          actionData: { optionId: compromiseOption.option_id }
        });
      }

    } catch (error) {
      logger.error('Error notifying compromise:', error);
    }
  }
}

module.exports = new ConsensusService();
