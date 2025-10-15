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

      // Generate case reference number and calculate deadlines
      const { generateCaseReferenceNumber, calculateResponseDeadline } = require('../lib/caseReferenceGenerator');
      const caseReferenceNumber = await generateCaseReferenceNumber();
      const responseDeadline = calculateResponseDeadline();

      // Create the case
      const caseRecord = await this.create({
        title: caseData.title,
        filed_by: filedBy,
        description: caseData.description,
        case_type: caseData.case_type,
        jurisdiction: caseData.jurisdiction,
        dispute_amount: caseData.dispute_amount,
        currency: caseData.currency || 'INR',
        priority: caseData.priority || 'normal',
        deadline: caseData.deadline,
        category_id: caseData.category_id,
        settlement_eligible: caseData.settlement_eligible !== false,
        mediation_required: caseData.mediation_required || false,
        metadata: caseData.metadata || {},
        is_public: caseData.is_public || false,
        status: 'PENDING_RESPONSE',
        case_reference_number: caseReferenceNumber,
        response_deadline: responseDeadline.toISOString(),
        submission_deadline: null,
        other_party_name: caseData.other_party_name,
        other_party_email: caseData.other_party_email,
        other_party_phone: caseData.other_party_phone,
        other_party_address: caseData.other_party_address,
        defendant_user_id: null,
        filed_date: new Date().toISOString()
      });

      // Create initial timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: caseRecord.id,
        event_type: 'case_filed',
        event_title: 'Case Filed',
        event_description: `Case "${caseData.title}" (${caseReferenceNumber}) filed against ${caseData.other_party_name || 'defendant'}`,
        actor_id: filedBy,
        is_public: true,
        metadata: {
          case_reference: caseReferenceNumber,
          response_deadline: responseDeadline.toISOString()
        }
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
      const validStatuses = [
        'draft',
        'PENDING_RESPONSE',
        'ESCALATED',
        'ACTIVE',
        'SUBMISSION_PHASE',
        'AI_ANALYZING',
        'AWAITING_ADDITIONAL_EVIDENCE',
        'FINAL_ANALYSIS',
        'OPTION_SELECTION',
        'SAME_OPTION',
        'DIFFERENT_OPTIONS',
        'RE_ANALYZING',
        'PROMISSORY_NOTE_PREP',
        'SIGNATURE_PENDING',
        'RESOLVED',
        'UNRESOLVED',
        'COURT_FORWARDED',
        'open',
        'analyzing',
        'closed',
        'escalated'
      ];
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Invalid case status');
      }

      const updates = { status: newStatus };
      if (newStatus === 'closed' || newStatus === 'RESOLVED') {
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
}

module.exports = new Case();