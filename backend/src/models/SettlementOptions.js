// Settlement Options Model - Handle settlement options and selections
const BaseModel = require('./BaseModel');
const { v4: uuidv4 } = require('uuid');

class SettlementOptions extends BaseModel {
  constructor() {
    super('settlement_options');
    this.selectionsTableName = 'option_selections';
  }

  // Create settlement options for a case
  async createOptions(data) {
    const optionsData = {
      id: uuidv4(),
      case_id: data.case_id,
      analysis_id: data.analysis_id,
      options_data: data.options_data,
      generated_at: new Date().toISOString(),
      expires_at: data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
      status: 'active'
    };

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(optionsData)
      .select()
      .single();

    if (error) {
      console.error('Error creating settlement options:', error);
      throw new Error('Failed to create settlement options');
    }

    return result;
  }

  // Get active settlement options for a case
  async getActiveByCaseId(caseId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('case_id', caseId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No active options found
      }
      console.error('Error fetching settlement options:', error);
      throw new Error('Failed to fetch settlement options');
    }

    return data;
  }

  // Record a party's option selection
  async recordSelection(data) {
    const selectionData = {
      id: uuidv4(),
      options_id: data.options_id,
      case_id: data.case_id,
      user_id: data.user_id,
      party_type: data.party_type, // 'complainer' or 'defender'
      selected_option_id: data.selected_option_id,
      selection_reasoning: data.selection_reasoning,
      selected_at: new Date().toISOString()
    };

    // Check if user already has a selection for these options
    const { data: existing, error: existingError } = await this.supabase
      .from(this.selectionsTableName)
      .select('id')
      .eq('options_id', data.options_id)
      .eq('user_id', data.user_id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    if (existing) {
      // Update existing selection
      const { data: result, error } = await this.supabase
        .from(this.selectionsTableName)
        .update({
          selected_option_id: data.selected_option_id,
          selection_reasoning: data.selection_reasoning,
          selected_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating option selection:', error);
        throw new Error('Failed to update option selection');
      }
      return result;
    } else {
      // Create new selection
      const { data: result, error } = await this.supabase
        .from(this.selectionsTableName)
        .insert(selectionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating option selection:', error);
        throw new Error('Failed to record option selection');
      }
      return result;
    }
  }

  // Get selections for settlement options
  async getSelections(optionsId) {
    const { data, error } = await this.supabase
      .from(this.selectionsTableName)
      .select(`
        *,
        users (
          id,
          email,
          full_name
        )
      `)
      .eq('options_id', optionsId)
      .order('selected_at', { ascending: false });

    if (error) {
      console.error('Error fetching option selections:', error);
      throw new Error('Failed to fetch option selections');
    }

    return data;
  }

  // Check if both parties have made selections
  async checkBothPartiesSelected(optionsId) {
    const { data, error } = await this.supabase
      .from(this.selectionsTableName)
      .select('party_type, selected_option_id')
      .eq('options_id', optionsId);

    if (error) {
      console.error('Error checking selections:', error);
      throw new Error('Failed to check selections');
    }

    const complainerSelection = data.find(s => s.party_type === 'complainer');
    const defenderSelection = data.find(s => s.party_type === 'defender');

    return {
      bothSelected: !!(complainerSelection && defenderSelection),
      sameOption: complainerSelection && defenderSelection && 
                 complainerSelection.selected_option_id === defenderSelection.selected_option_id,
      selections: {
        complainer: complainerSelection,
        defender: defenderSelection
      }
    };
  }

  // Get all selections for a case
  async getCaseSelections(caseId) {
    const { data, error } = await this.supabase
      .from(this.selectionsTableName)
      .select(`
        *,
        settlement_options (
          id,
          options_data,
          generated_at
        ),
        users (
          id,
          email,
          full_name
        )
      `)
      .eq('case_id', caseId)
      .order('selected_at', { ascending: false });

    if (error) {
      console.error('Error fetching case selections:', error);
      throw new Error('Failed to fetch case selections');
    }

    return data;
  }

  // Mark options as expired or completed
  async updateStatus(optionsId, status) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', optionsId)
      .select()
      .single();

    if (error) {
      console.error('Error updating options status:', error);
      throw new Error('Failed to update options status');
    }

    return data;
  }

  // Clean up expired options
  async cleanupExpiredOptions() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({ status: 'expired' })
        .eq('status', 'active')
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('Error cleaning up expired options:', error);
        return 0;
      }

      console.log(`Marked ${data.length} settlement options as expired`);
      return data.length;
    } catch (error) {
      console.error('Error in settlement options cleanup:', error);
      return 0;
    }
  }

  // Get selection statistics
  async getSelectionStats() {
    const { data, error } = await this.supabase
      .from(this.selectionsTableName)
      .select(`
        party_type,
        selected_at,
        settlement_options (
          case_id,
          status
        )
      `);

    if (error) {
      console.error('Error fetching selection stats:', error);
      throw new Error('Failed to fetch selection statistics');
    }

    const stats = {
      totalSelections: data.length,
      byPartyType: {},
      selectionsToday: 0,
      averageSelectionTime: 0
    };

    const today = new Date().toDateString();
    data.forEach(selection => {
      stats.byPartyType[selection.party_type] = (stats.byPartyType[selection.party_type] || 0) + 1;
      
      if (new Date(selection.selected_at).toDateString() === today) {
        stats.selectionsToday++;
      }
    });

    return stats;
  }
}

module.exports = new SettlementOptions();