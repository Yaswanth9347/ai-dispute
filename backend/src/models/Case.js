// Case Model - Handle case operations
const BaseModel = require('./BaseModel');

class Case extends BaseModel {
  constructor() {
    super('cases');
  }

  // Create case with initial timeline entry
  async createCase(caseData, filedBy) {
    try {
      // Validate required fields
      if (!caseData.title || !filedBy) {
        throw new Error('Case title and filed_by are required');
      }

      // Validate defender information if provided
      if (caseData.defenderInfo) {
        if (!caseData.defenderInfo.name || !caseData.defenderInfo.email) {
          throw new Error('Defender name and email are required');
        }
      }

      // Create the case
      const caseRecord = await this.create({
        title: caseData.title,
        filed_by: filedBy,
        description: caseData.description,
        case_type: caseData.case_type,
        jurisdiction: caseData.jurisdiction,
        dispute_amount: caseData.dispute_amount,
        currency: caseData.currency || 'USD',
        priority: caseData.priority || 'normal',
        deadline: caseData.deadline,
        category_id: caseData.category_id,
        settlement_eligible: caseData.settlement_eligible !== false,
        mediation_required: caseData.mediation_required || false,
        metadata: caseData.metadata || {},
        is_public: caseData.is_public || false,
        status: 'draft',
        // Defender information
        defender_name: caseData.defenderInfo?.name,
        defender_email: caseData.defenderInfo?.email,
        defender_phone: caseData.defenderInfo?.phone,
        defender_address: caseData.defenderInfo?.address,
        // Dispute workflow fields
        statement_deadline: null,
        ai_analysis_started_at: null,
        solution_options_generated_at: null,
        parties_response_deadline: null
      });

      // Create initial timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: caseRecord.id,
        event_type: 'case_created',
        event_title: 'Case Filed',
        event_description: `New case "${caseData.title}" has been filed`,
        actor_id: filedBy,
        is_public: true
      });

      return caseRecord;
    } catch (error) {
      throw new Error(`Failed to create case: ${error.message}`);
    }
  }

  // Get case with related data
  async getCaseWithDetails(caseId, userId = null) {
    try {
      // Get case basic info
      const caseData = await this.findById(caseId);
      if (!caseData) return null;

      // Check if user has access to this case
      if (userId) {
        const hasAccess = await this.checkUserAccess(caseId, userId);
        if (!hasAccess) {
          throw new Error('Access denied to this case');
        }
      }

      // Get related data
      const [parties, statements, evidence, analysis, timeline] = await Promise.all([
        this.supabase.from('case_parties').select('*').eq('case_id', caseId),
        this.supabase.from('statements').select('*').eq('case_id', caseId).order('created_at'),
        this.supabase.from('evidence').select('*').eq('case_id', caseId).order('created_at'),
        this.supabase.from('ai_analysis').select('*').eq('case_id', caseId).order('created_at'),
        this.supabase.from('case_timeline').select('*').eq('case_id', caseId).order('created_at')
      ]);

      return {
        ...caseData,
        parties: parties.data || [],
        statements: statements.data || [],
        evidence: evidence.data || [],
        ai_analysis: analysis.data || [],
        timeline: timeline.data || []
      };
    } catch (error) {
      throw new Error(`Failed to get case details: ${error.message}`);
    }
  }

  // Check if user has access to case
  async checkUserAccess(caseId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('cases')
        .select('filed_by')
        .eq('id', caseId)
        .single();

      if (error) return false;

      // Check if user is the filer
      if (data.filed_by === userId) return true;

      // Check if user is a party to the case
      const { data: partyData } = await this.supabase
        .from('case_parties')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', userId)
        .single();

      return !!partyData;
    } catch (error) {
      return false;
    }
  }

  // Get cases for a user
  async getUserCases(userId, options = {}) {
    try {
      const { status, limit = 50, offset = 0 } = options;

      let query = this.supabase
        .from('cases')
        .select(`
          *,
          case_categories (name),
          users!filed_by (name, email)
        `)
        .or(`filed_by.eq.${userId},id.in.(${await this.getUserCaseIds(userId)})`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      throw new Error(`Failed to get user cases: ${error.message}`);
    }
  }

  // Get case IDs where user is a party
  async getUserCaseIds(userId) {
    try {
      const { data, error } = await this.supabase
        .from('case_parties')
        .select('case_id')
        .eq('user_id', userId);

      if (error) throw error;
      return data.map(item => item.case_id).join(',') || '';
    } catch (error) {
      return '';
    }
  }

  // Update case status
  async updateStatus(caseId, newStatus, userId, reason = '') {
    try {
      const validStatuses = ['draft', 'open', 'analyzing', 'closed', 'escalated'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Invalid case status');
      }

      const updates = { status: newStatus };
      if (newStatus === 'closed') {
        updates.closed_at = new Date().toISOString();
        updates.closed_by = userId;
      }

      const updatedCase = await this.updateById(caseId, updates);

      // Add timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: caseId,
        event_type: 'status_changed',
        event_title: `Status Changed to ${newStatus}`,
        event_description: reason || `Case status updated to ${newStatus}`,
        actor_id: userId,
        metadata: { old_status: updatedCase.status, new_status: newStatus },
        is_public: true
      });

      return updatedCase;
    } catch (error) {
      throw new Error(`Failed to update case status: ${error.message}`);
    }
  }

  // Get case statistics
  async getCaseStats() {
    try {
      const [total, active, closed, analyzing] = await Promise.all([
        this.count(),
        this.count({ status: 'open' }),
        this.count({ status: 'closed' }),
        this.count({ status: 'analyzing' })
      ]);

      return {
        total,
        active,
        closed,
        analyzing,
        draft: total - active - closed - analyzing
      };
    } catch (error) {
      throw new Error(`Failed to get case statistics: ${error.message}`);
    }
  }

  // Search cases
  async searchCases(searchTerm, userId = null, limit = 50) {
    try {
      let query = this.supabase
        .from('cases')
        .select(`
          *,
          case_categories (name),
          users!filed_by (name, email)
        `)
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      // If userId provided, filter to user's accessible cases
      if (userId) {
        const userCaseIds = await this.getUserCaseIds(userId);
        query = query.or(`filed_by.eq.${userId},id.in.(${userCaseIds})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      throw new Error(`Failed to search cases: ${error.message}`);
    }
  }

  // Send notification to defender about case filing
  async notifyDefender(caseId) {
    try {
      const caseData = await this.findById(caseId);
      if (!caseData || !caseData.defender_email) {
        throw new Error('Case or defender email not found');
      }

      const emailService = require('../services/EmailService');
      const smsService = require('../services/SMSService');

      // Send email notification
      await emailService.sendDisputeFileNotification(caseData.defender_email, {
        defenderName: caseData.defender_name,
        caseTitle: caseData.title,
        caseNumber: caseData.case_number,
        complainerName: caseData.filed_by_name,
        caseType: caseData.case_type,
        description: caseData.description
      });

      // Send SMS notification if phone number provided
      if (caseData.defender_phone) {
        await smsService.sendDisputeFileNotification(caseData.defender_phone, {
          defenderName: caseData.defender_name,
          caseTitle: caseData.title,
          caseNumber: caseData.case_number
        });
      }

      // Update case to mark notification sent
      await this.updateById(caseId, {
        defender_notified_at: new Date().toISOString(),
        status: 'open'
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to notify defender: ${error.message}`);
    }
  }

  // Start statement collection phase
  async startStatementPhase(caseId, hours = 48) {
    try {
      const statementDeadline = new Date();
      statementDeadline.setHours(statementDeadline.getHours() + hours);

      await this.updateById(caseId, {
        statement_deadline: statementDeadline.toISOString(),
        status: 'statement_phase'
      });

      // Notify both parties to submit statements
      const notificationService = require('../services/NotificationService');
      await notificationService.notifyStatementsNeeded(caseId);

      return { statementDeadline };
    } catch (error) {
      throw new Error(`Failed to start statement phase: ${error.message}`);
    }
  }

  // Check if statement phase is complete
  async isStatementPhaseComplete(caseId) {
    try {
      const Statement = require('./Statement');
      const statements = await Statement.findAll({ case_id: caseId });
      
      // Check if both parties have submitted statements
      const partyStatements = statements.reduce((acc, stmt) => {
        acc[stmt.party_type] = true;
        return acc;
      }, {});

      return partyStatements.complainer && partyStatements.defender;
    } catch (error) {
      throw new Error(`Failed to check statement phase: ${error.message}`);
    }
  }

  // Start AI analysis phase
  async startAIAnalysisPhase(caseId) {
    try {
      await this.updateById(caseId, {
        ai_analysis_started_at: new Date().toISOString(),
        status: 'ai_analysis'
      });

      // Trigger AI analysis process
      const aiService = require('../services/AdvancedAIService');
      await aiService.analyzeDisputeCase(caseId);

      return true;
    } catch (error) {
      throw new Error(`Failed to start AI analysis: ${error.message}`);
    }
  }
}

module.exports = new Case();