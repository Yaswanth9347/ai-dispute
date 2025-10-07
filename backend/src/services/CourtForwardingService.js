// Court Auto-Forwarding Service
const logger = require('../lib/logger');
const { supabaseAdmin } = require('../lib/supabaseClient');
const NotificationService = require('./NotificationService');
const CourtIntegrationService = require('./CourtIntegrationService');

class CourtForwardingService {
  /**
   * Automatically forward case to court when settlement fails
   */
  async autoForwardCase(caseId, reason = 'settlement_failed') {
    try {
      logger.info('Auto-forwarding case to court', { caseId, reason });

      // Get case details
      const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .select(`
          *,
          case_parties!inner(user_id, party_role, users(full_name, email, phone))
        `)
        .eq('case_id', caseId)
        .single();

      if (caseError || !caseData) {
        throw new Error('Case not found');
      }

      // Get all statements
      const { data: statements } = await supabaseAdmin
        .from('case_statements')
        .select('*')
        .eq('case_id', caseId)
        .eq('is_finalized', true);

      // Get settlement options that were presented
      const { data: settlementOptions } = await supabaseAdmin
        .from('settlement_options')
        .select('*')
        .eq('case_id', caseId);

      // Get party selections
      const { data: selections } = await supabaseAdmin
        .from('party_option_selections')
        .select('*')
        .eq('case_id', caseId);

      // Get all evidence documents
      const { data: documents } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('case_id', caseId)
        .eq('document_type', 'evidence');

      // Compile case summary for court
      const courtSummary = this._compileCaseSummary(
        caseData,
        statements,
        settlementOptions,
        selections,
        documents,
        reason
      );

      // Determine appropriate court system
      const courtSystem = await this._determineCourtSystem(caseData);

      // Prepare court filing
      const filingData = {
        caseId: caseId,
        courtSystemId: courtSystem.court_system_id,
        filingType: 'civil_suit',
        caseTitle: caseData.case_title,
        caseDescription: courtSummary.description,
        plaintiffDetails: courtSummary.complainant,
        defendantDetails: courtSummary.respondent,
        reliefSought: courtSummary.reliefSought,
        documents: documents.map(d => ({
          documentId: d.document_id,
          documentType: d.document_type,
          fileName: d.file_name
        })),
        additionalInfo: {
          aiMediationAttempted: true,
          settlementOptionsPresented: settlementOptions.length,
          mediationFailureReason: reason,
          statements: statements.map(s => ({
            party: s.party_role,
            content: s.statement_content,
            finalizedAt: s.finalized_at
          }))
        }
      };

      // File case in court
      const courtFiling = await CourtIntegrationService.fileCase(filingData);

      // Update case status
      await supabaseAdmin
        .from('cases')
        .update({
          status: 'forwarded_to_court',
          court_filing_id: courtFiling.filing_id,
          forwarded_at: new Date().toISOString(),
          forwarding_reason: reason
        })
        .eq('case_id', caseId);

      // Create archive record
      await supabaseAdmin
        .from('closed_cases_archive')
        .insert({
          case_id: caseId,
          case_data: caseData,
          settlement_data: { 
            options: settlementOptions,
            selections: selections,
            reason: 'No settlement reached - forwarded to court'
          },
          closed_at: new Date().toISOString(),
          resolution_type: 'court_forwarded',
          court_filing_reference: courtFiling.court_reference_number
        });

      // Notify all parties
      await this._notifyCourtForwarding(caseId, courtFiling);

      logger.info('Case successfully forwarded to court', {
        caseId,
        filingId: courtFiling.filing_id,
        courtReference: courtFiling.court_reference_number
      });

      return {
        success: true,
        filingId: courtFiling.filing_id,
        courtReference: courtFiling.court_reference_number,
        courtSystem: courtSystem.court_name
      };

    } catch (error) {
      logger.error('Error auto-forwarding case to court:', error);
      throw error;
    }
  }

  /**
   * Compile comprehensive case summary for court
   */
  _compileCaseSummary(caseData, statements, settlementOptions, selections, documents, reason) {
    const complainant = caseData.case_parties.find(p => p.party_role === 'complainant');
    const respondent = caseData.case_parties.find(p => p.party_role === 'respondent');

    const complainantStmt = statements.find(s => s.party_role === 'complainant');
    const respondentStmt = statements.find(s => s.party_role === 'respondent');

    const description = `
CASE SUMMARY - AI MEDIATION FAILED

Case Type: ${caseData.case_type}
Dispute Amount: ₹${(caseData.dispute_amount || 0).toLocaleString('en-IN')}
Filing Date: ${new Date(caseData.created_at).toLocaleDateString('en-IN')}

AI MEDIATION ATTEMPT:
The parties attempted resolution through AI-mediated dispute resolution platform.
${settlementOptions.length} settlement options were generated based on AI analysis of both parties' statements.

Mediation Outcome: ${reason.replace('_', ' ').toUpperCase()}

COMPLAINANT'S POSITION:
${complainantStmt?.statement_content || 'Statement not available'}

RESPONDENT'S POSITION:
${respondentStmt?.statement_content || 'Statement not available'}

SETTLEMENT OPTIONS PRESENTED:
${settlementOptions.map((opt, i) => `
${i + 1}. ${opt.option_type.toUpperCase()}
   Amount: ₹${opt.complainant_receives.toLocaleString('en-IN')}
   Description: ${opt.description}
   Legal Basis: ${opt.legal_basis}
`).join('\n')}

PARTY SELECTIONS:
${selections.map(s => `- ${s.party_role}: Selected option ${s.option_id}`).join('\n')}

EVIDENCE SUBMITTED:
${documents.length} document(s) submitted as evidence.

The parties have been unable to reach a settlement through AI mediation. 
This case is hereby forwarded to the court for judicial determination.
    `.trim();

    return {
      description,
      complainant: {
        name: complainant?.users.full_name,
        email: complainant?.users.email,
        phone: complainant?.users.phone
      },
      respondent: {
        name: respondent?.users.full_name,
        email: respondent?.users.email,
        phone: respondent?.users.phone
      },
      reliefSought: `Payment of ₹${(caseData.dispute_amount || 0).toLocaleString('en-IN')} with interest and costs`,
      evidenceCount: documents.length,
      mediationAttempted: true
    };
  }

  /**
   * Determine appropriate court system based on case details
   */
  async _determineCourtSystem(caseData) {
    try {
      const disputeAmount = caseData.dispute_amount || 0;

      // Determine court level based on dispute amount
      let courtLevel;
      if (disputeAmount <= 300000) { // Up to 3 lakhs
        courtLevel = 'district';
      } else if (disputeAmount <= 2000000) { // Up to 20 lakhs
        courtLevel = 'high_court';
      } else {
        courtLevel = 'high_court'; // Large disputes
      }

      // Get available court system
      const { data: courtSystem } = await supabaseAdmin
        .from('court_systems')
        .select('*')
        .eq('court_level', courtLevel)
        .eq('jurisdiction', caseData.jurisdiction || 'Karnataka')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!courtSystem) {
        // Fallback to any available district court
        const { data: fallbackCourt } = await supabaseAdmin
          .from('court_systems')
          .select('*')
          .eq('court_level', 'district')
          .eq('is_active', true)
          .limit(1)
          .single();

        return fallbackCourt;
      }

      return courtSystem;

    } catch (error) {
      logger.error('Error determining court system:', error);
      throw error;
    }
  }

  /**
   * Notify parties about court forwarding
   */
  async _notifyCourtForwarding(caseId, courtFiling) {
    try {
      const { data: parties } = await supabaseAdmin
        .from('case_parties')
        .select('user_id, party_role, users(full_name, email)')
        .eq('case_id', caseId);

      for (const party of parties) {
        await NotificationService.createNotification({
          userId: party.user_id,
          caseId,
          type: NotificationService.notificationTypes.CASE_UPDATE,
          title: 'Case Forwarded to Court',
          message: `Your case has been forwarded to ${courtFiling.court_system_name} as no settlement could be reached through mediation. Court Reference: ${courtFiling.court_reference_number}`,
          priority: NotificationService.priorities.HIGH,
          actionUrl: `/cases/${caseId}/court-filing`,
          actionData: {
            filingId: courtFiling.filing_id,
            courtReference: courtFiling.court_reference_number
          }
        });
      }

    } catch (error) {
      logger.error('Error notifying court forwarding:', error);
    }
  }

  /**
   * Check if case should be auto-forwarded
   */
  async shouldAutoForward(caseId) {
    try {
      // Get party selections
      const { data: selections } = await supabaseAdmin
        .from('party_option_selections')
        .select('*')
        .eq('case_id', caseId);

      // Check if both parties have rejected multiple times
      if (selections.length >= 4) { // Both parties rejected twice
        const rejectCount = selections.filter(s => 
          s.selection_comments?.toLowerCase().includes('reject')
        ).length;

        if (rejectCount >= 4) {
          return {
            shouldForward: true,
            reason: 'multiple_rejections'
          };
        }
      }

      // Check workflow timeout (e.g., 30 days in mediation)
      const { data: workflow } = await supabaseAdmin
        .from('dispute_workflows')
        .select('*')
        .eq('case_id', caseId)
        .single();

      if (workflow) {
        const daysSinceCreation = Math.floor(
          (new Date() - new Date(workflow.created_at)) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceCreation > 30 && workflow.current_stage !== 'CLOSED_SETTLED') {
          return {
            shouldForward: true,
            reason: 'mediation_timeout'
          };
        }
      }

      return { shouldForward: false };

    } catch (error) {
      logger.error('Error checking auto-forward conditions:', error);
      return { shouldForward: false };
    }
  }
}

module.exports = new CourtForwardingService();
