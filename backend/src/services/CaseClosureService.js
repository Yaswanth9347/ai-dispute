// Case Closure Service - Complete case closure workflow with documentation and archival
const logger = require('../lib/logger');
const { supabase } = require('../lib/supabaseClient');
const PDFGenerationService = require('./PDFGenerationService');
const ESignatureService = require('./ESignatureService');
const EmailService = require('./EmailService');
const DocumentTemplateService = require('./DocumentTemplateService');
const DisputeWorkflowService = require('./DisputeWorkflowService');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CaseClosureService {
  constructor() {
    this.archiveDir = path.join(__dirname, '../../storage/archive');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.archiveDir, { recursive: true });
      logger.info('Case Closure service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Case Closure service:', error);
    }
  }

  // Initiate case closure process
  async initiateClosure(caseId, closureType, initiatedBy, closureDetails = {}) {
    try {
      // Validate case can be closed
      const canClose = await this.validateClosure(caseId, closureType);
      if (!canClose.valid) {
        throw new Error(canClose.reason);
      }

      // Get case data with all related information
      const caseData = await this.getCaseDataForClosure(caseId);
      
      // Start closure process based on type
      let closureResult;
      switch (closureType) {
        case 'settlement':
          closureResult = await this.processSettlementClosure(caseData, closureDetails, initiatedBy);
          break;
        case 'court_referral':
          closureResult = await this.processCourtReferral(caseData, closureDetails, initiatedBy);
          break;
        case 'withdrawn':
          closureResult = await this.processWithdrawal(caseData, closureDetails, initiatedBy);
          break;
        case 'rejected':
          closureResult = await this.processRejection(caseData, closureDetails, initiatedBy);
          break;
        default:
          throw new Error(`Unknown closure type: ${closureType}`);
      }

      // Update case status and workflow
      await DisputeWorkflowService.transitionToStage(
        caseId,
        this.getClosureStage(closureType)
      );

      // Record closure in database
      const closureRecord = await this.recordClosure(caseId, closureType, closureResult, initiatedBy);

      // Archive case documents
      const archiveResult = await this.archiveCase(caseData, closureRecord);

      return {
        success: true,
        closureId: closureRecord.id,
        type: closureType,
        documents: closureResult.documents || [],
        notifications: closureResult.notifications || [],
        archiveLocation: archiveResult.archivePath,
        closedAt: closureRecord.closed_at
      };
    } catch (error) {
      logger.error('Error initiating case closure:', error);
      throw new Error(`Failed to initiate case closure: ${error.message}`);
    }
  }

  // Process settlement closure
  async processSettlementClosure(caseData, settlementDetails, initiatedBy) {
    try {
      const documents = [];
      const notifications = [];

      // Generate final settlement agreement
      const settlementPDF = await PDFGenerationService.generateSettlementAgreement(
        caseData.case,
        settlementDetails,
        caseData.parties
      );
      documents.push(settlementPDF);

      // Generate case summary report
      const summaryPDF = await PDFGenerationService.generateCaseSummaryReport(
        caseData.case,
        caseData.analysis,
        caseData.timeline
      );
      documents.push(summaryPDF);

      // Send final documents to all parties
      const emailResult = await EmailService.sendCaseClosureNotification(
        caseData.parties,
        caseData.case,
        documents
      );
      notifications.push(emailResult);

      // Update case status
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'closed_settled',
          settlement_amount: settlementDetails.amount || null,
          settlement_terms: settlementDetails.terms || null,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', caseData.case.id);

      if (error) throw error;

      return {
        success: true,
        documents,
        notifications,
        settlementAmount: settlementDetails.amount
      };
    } catch (error) {
      logger.error('Error processing settlement closure:', error);
      throw new Error('Failed to process settlement closure');
    }
  }

  // Process court referral
  async processCourtReferral(caseData, referralDetails, initiatedBy) {
    try {
      const documents = [];
      const notifications = [];

      // Prepare settlement attempts data
      const attempts = await this.getSettlementAttempts(caseData.case.id);

      // Generate court referral document
      const referralPDF = await PDFGenerationService.generateCourtReferralDocument(
        caseData.case,
        referralDetails.reason || 'Settlement attempts unsuccessful',
        attempts
      );
      documents.push(referralPDF);

      // Generate comprehensive case file
      const caseFilePDF = await PDFGenerationService.generateCaseSummaryReport(
        caseData.case,
        caseData.analysis,
        caseData.timeline
      );
      documents.push(caseFilePDF);

      // Send court referral notifications
      const emailResult = await EmailService.sendCourtReferralNotification(
        caseData.parties,
        caseData.case,
        referralPDF
      );
      notifications.push(emailResult);

      // Update case status
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'forwarded_to_court',
          court_referral_reason: referralDetails.reason,
          court_referral_date: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', caseData.case.id);

      if (error) throw error;

      // Create court referral record
      await this.createCourtReferralRecord(caseData.case.id, referralDetails, referralPDF);

      return {
        success: true,
        documents,
        notifications,
        referralReason: referralDetails.reason
      };
    } catch (error) {
      logger.error('Error processing court referral:', error);
      throw new Error('Failed to process court referral');
    }
  }

  // Process case withdrawal
  async processWithdrawal(caseData, withdrawalDetails, initiatedBy) {
    try {
      // Update case status
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'withdrawn',
          withdrawal_reason: withdrawalDetails.reason,
          withdrawn_by: initiatedBy,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', caseData.case.id);

      if (error) throw error;

      // Notify all parties
      const notifications = [];
      for (const party of caseData.parties) {
        const emailResult = await EmailService.sendNotificationEmail(
          party.email,
          party.name,
          'Case Withdrawn',
          `Case ${caseData.case.id} has been withdrawn. Reason: ${withdrawalDetails.reason}`
        );
        notifications.push({ party: party.email, success: emailResult.success });
      }

      return {
        success: true,
        notifications,
        withdrawalReason: withdrawalDetails.reason
      };
    } catch (error) {
      logger.error('Error processing withdrawal:', error);
      throw new Error('Failed to process case withdrawal');
    }
  }

  // Process case rejection
  async processRejection(caseData, rejectionDetails, initiatedBy) {
    try {
      // Update case status
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'rejected',
          rejection_reason: rejectionDetails.reason,
          rejected_by: initiatedBy,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', caseData.case.id);

      if (error) throw error;

      // Notify parties
      const notifications = [];
      for (const party of caseData.parties) {
        const emailResult = await EmailService.sendNotificationEmail(
          party.email,
          party.name,
          'Case Rejected',
          `Case ${caseData.case.id} has been rejected. Reason: ${rejectionDetails.reason}`
        );
        notifications.push({ party: party.email, success: emailResult.success });
      }

      return {
        success: true,
        notifications,
        rejectionReason: rejectionDetails.reason
      };
    } catch (error) {
      logger.error('Error processing rejection:', error);
      throw new Error('Failed to process case rejection');
    }
  }

  // Validate if case can be closed
  async validateClosure(caseId, closureType) {
    try {
      // Get case status
      const { data: caseData, error } = await supabase
        .from('cases')
        .select('status, created_at')
        .eq('id', caseId)
        .single();

      if (error) {
        return { valid: false, reason: 'Case not found' };
      }

      // Check if case is already closed
      const closedStatuses = ['closed_settled', 'forwarded_to_court', 'withdrawn', 'rejected'];
      if (closedStatuses.includes(caseData.status)) {
        return { valid: false, reason: 'Case is already closed' };
      }

      // Validate specific closure types
      switch (closureType) {
        case 'settlement':
          // Check if settlement process is complete
          if (!['consensus_reached', 'signature_pending'].includes(caseData.status)) {
            return { valid: false, reason: 'Settlement not ready for closure' };
          }
          break;
        case 'court_referral':
          // Court referral can happen from most stages
          if (['draft', 'awaiting_respondent'].includes(caseData.status)) {
            return { valid: false, reason: 'Case too early for court referral' };
          }
          break;
        case 'withdrawn':
        case 'rejected':
          // These can happen at any stage
          break;
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error validating closure:', error);
      return { valid: false, reason: 'Validation failed' };
    }
  }

  // Get comprehensive case data for closure
  async getCaseDataForClosure(caseId) {
    try {
      // Get case with parties
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select(`
          *,
          users!filed_by (
            id, email, full_name, phone
          )
        `)
        .eq('id', caseId)
        .single();

      if (caseError) throw caseError;

      // Get AI analysis
      const { data: analysis } = await supabase
        .from('ai_analysis')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get case timeline
      const { data: timeline } = await supabase
        .from('case_timeline')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at');

      // Prepare parties array
      const parties = [
        {
          role: 'complainer',
          name: caseData.users.full_name,
          email: caseData.users.email,
          phone: caseData.users.phone
        }
      ];

      // Add defender if available
      if (caseData.defender_email) {
        parties.push({
          role: 'defender',
          name: caseData.defender_name,
          email: caseData.defender_email,
          phone: caseData.defender_phone
        });
      }

      return {
        case: caseData,
        parties,
        analysis: analysis?.analysis || null,
        timeline: timeline || []
      };
    } catch (error) {
      logger.error('Error getting case data for closure:', error);
      throw new Error('Failed to get case data');
    }
  }

  // Record closure in database
  async recordClosure(caseId, closureType, closureResult, initiatedBy) {
    try {
      const closureRecord = {
        id: uuidv4(),
        case_id: caseId,
        closure_type: closureType,
        closure_details: closureResult,
        initiated_by: initiatedBy,
        closed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('case_closures')
        .insert(closureRecord)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Error recording closure:', error);
      throw new Error('Failed to record case closure');
    }
  }

  // Archive case documents
  async archiveCase(caseData, closureRecord) {
    try {
      const archivePath = path.join(this.archiveDir, `case_${caseData.case.id}_${Date.now()}`);
      await fs.mkdir(archivePath, { recursive: true });

      // Create archive manifest
      const manifest = {
        caseId: caseData.case.id,
        closureId: closureRecord.id,
        archivedAt: new Date().toISOString(),
        closureType: closureRecord.closure_type,
        contents: {
          caseData: caseData.case,
          parties: caseData.parties,
          analysis: caseData.analysis,
          timeline: caseData.timeline,
          closure: closureRecord
        }
      };

      await fs.writeFile(
        path.join(archivePath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      return {
        archivePath,
        manifestPath: path.join(archivePath, 'manifest.json'),
        archivedAt: manifest.archivedAt
      };
    } catch (error) {
      logger.error('Error archiving case:', error);
      throw new Error('Failed to archive case');
    }
  }

  // Get settlement attempts for court referral
  async getSettlementAttempts(caseId) {
    try {
      const { data: timeline } = await supabase
        .from('case_timeline')
        .select('*')
        .eq('case_id', caseId)
        .in('event_type', ['ai_analysis', 'settlement_generated', 'option_selected', 'negotiation_attempt'])
        .order('created_at');

      return (timeline || []).map(event => ({
        date: new Date(event.created_at).toLocaleDateString(),
        method: event.event_type.replace('_', ' ').toUpperCase(),
        outcome: event.outcome || 'No consensus reached',
        notes: event.description || ''
      }));
    } catch (error) {
      logger.error('Error getting settlement attempts:', error);
      return [];
    }
  }

  // Create court referral record
  async createCourtReferralRecord(caseId, referralDetails, referralDocument) {
    try {
      const referralRecord = {
        id: uuidv4(),
        case_id: caseId,
        referral_reason: referralDetails.reason,
        referral_date: new Date().toISOString(),
        referral_document_path: referralDocument.filepath,
        court_jurisdiction: referralDetails.jurisdiction || 'To be determined',
        estimated_court_filing_date: referralDetails.estimatedFilingDate || null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('court_referrals')
        .insert(referralRecord)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Error creating court referral record:', error);
      throw new Error('Failed to create court referral record');
    }
  }

  // Get closure stage based on type
  getClosureStage(closureType) {
    const stageMap = {
      settlement: 'CLOSED_SETTLED',
      court_referral: 'FORWARDED_TO_COURT',
      withdrawn: 'CLOSED_REJECTED',
      rejected: 'CLOSED_REJECTED'
    };
    return stageMap[closureType] || 'CLOSED_REJECTED';
  }

  // Get case closure statistics
  async getClosureStats(dateRange = null) {
    try {
      let query = supabase
        .from('case_closures')
        .select('closure_type, closed_at');

      if (dateRange) {
        query = query
          .gte('closed_at', dateRange.start)
          .lte('closed_at', dateRange.end);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        byType: {},
        thisMonth: 0,
        thisWeek: 0
      };

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisWeek = new Date(now.setDate(now.getDate() - 7));

      data.forEach(closure => {
        // Count by type
        stats.byType[closure.closure_type] = (stats.byType[closure.closure_type] || 0) + 1;
        
        // Count this month
        if (new Date(closure.closed_at).getMonth() === thisMonth) {
          stats.thisMonth++;
        }
        
        // Count this week
        if (new Date(closure.closed_at) >= thisWeek) {
          stats.thisWeek++;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting closure statistics:', error);
      throw new Error('Failed to get closure statistics');
    }
  }
}

module.exports = new CaseClosureService();