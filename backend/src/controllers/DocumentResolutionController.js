// Document & Resolution Controller - Comprehensive document management and case resolution
const { logger } = require('../lib/logger');
const ESignatureService = require('../services/ESignatureService');
const PDFGenerationService = require('../services/PDFGenerationService');
const DocumentTemplateService = require('../services/DocumentTemplateService');
const EmailService = require('../services/EmailService');
const CaseClosureService = require('../services/CaseClosureService');
const CourtReferralService = require('../services/CourtReferralService');
const { supabase } = require('../lib/supabaseClient');
const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');

class DocumentResolutionController {
  
  // Generate and sign settlement agreement
  generateSettlementAgreement = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { settlementTerms, parties } = req.body;

    try {
      // Get case data
      const { data: caseData, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (error || !caseData) {
        throw new HttpError('Case not found', 404);
      }

      // Generate settlement agreement PDF
      const settlementPDF = await PDFGenerationService.generateSettlementAgreement(
        caseData,
        settlementTerms,
        parties
      );

      // Send for signatures
      const emailResult = await EmailService.sendSettlementAgreement(
        parties,
        caseData,
        settlementPDF.filepath
      );

      // Record document generation
      await this.recordDocumentGeneration(caseId, 'settlement_agreement', settlementPDF, req.user.id);

      res.json({
        success: true,
        message: 'Settlement agreement generated and sent for signatures',
        document: {
          filename: settlementPDF.filename,
          path: settlementPDF.filepath,
          signatures_sent: emailResult.success
        },
        email_results: emailResult.results
      });
    } catch (error) {
      logger.error('Error generating settlement agreement:', error);
      throw new HttpError('Failed to generate settlement agreement', 500);
    }
  });

  // Sign document with e-signature
  signDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { signerInfo, signatureType = 'settlement' } = req.body;

    try {
      // Get or create user certificate
      let certificate = await ESignatureService.getUserCertificate(req.user.id);
      if (!certificate) {
        certificate = await ESignatureService.createUserCertificate(req.user.id, {
          commonName: req.user.full_name,
          email: req.user.email,
          organization: 'AI Dispute Resolution Platform'
        });
      }

      // Get document to sign
      const { data: document, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !document) {
        throw new HttpError('Document not found', 404);
      }

      // Sign the document
      const signatureResult = await ESignatureService.signDocument(
        document.file_path,
        req.user.id,
        {
          ...signerInfo,
          purpose: `Digital signature for ${signatureType}`,
          timestamp: new Date().toISOString()
        }
      );

      // Update document with signature
      await supabase
        .from('case_documents')
        .update({
          is_signed: true,
          signature_info: signatureResult.signatureInfo,
          signed_at: new Date().toISOString(),
          signed_by: req.user.id
        })
        .eq('id', documentId);

      // Check if all parties have signed
      const allSigned = await this.checkAllPartiesSigned(document.case_id);
      if (allSigned) {
        // Trigger case closure process
        await this.handleDocumentFullySigned(document.case_id);
      }

      res.json({
        success: true,
        message: 'Document signed successfully',
        signature: {
          signatureId: signatureResult.signatureId,
          timestamp: signatureResult.timestamp,
          certificate: signatureResult.certificate
        },
        document_status: allSigned ? 'fully_signed' : 'partially_signed'
      });
    } catch (error) {
      logger.error('Error signing document:', error);
      throw new HttpError('Failed to sign document', 500);
    }
  });

  // Verify document signature
  verifySignature = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    try {
      // Get document
      const { data: document, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !document) {
        throw new HttpError('Document not found', 404);
      }

      if (!document.is_signed) {
        return res.json({
          success: false,
          message: 'Document is not signed',
          verified: false
        });
      }

      // Verify signature
      const verification = await ESignatureService.verifySignature(
        document.file_path,
        document.signature_info
      );

      res.json({
        success: true,
        verified: verification.valid,
        signature_details: verification,
        document_info: {
          signed_at: document.signed_at,
          signed_by: document.signed_by
        }
      });
    } catch (error) {
      logger.error('Error verifying signature:', error);
      throw new HttpError('Failed to verify signature', 500);
    }
  });

  // Generate case summary report
  generateCaseSummary = asyncHandler(async (req, res) => {
    const { caseId } = req.params;

    try {
      // Get comprehensive case data
      const caseData = await this.getComprehensiveCaseData(caseId);
      
      // Generate PDF report
      const summaryPDF = await PDFGenerationService.generateCaseSummaryReport(
        caseData.case,
        caseData.analysis,
        caseData.timeline
      );

      // Record document generation
      await this.recordDocumentGeneration(caseId, 'case_summary', summaryPDF, req.user.id);

      res.json({
        success: true,
        message: 'Case summary generated successfully',
        document: {
          filename: summaryPDF.filename,
          download_url: `/api/documents/download/${summaryPDF.filename}`,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error generating case summary:', error);
      throw new HttpError('Failed to generate case summary', 500);
    }
  });

  // Close case with settlement
  closeCaseWithSettlement = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { settlementDetails } = req.body;

    try {
      const closureResult = await CaseClosureService.initiateClosure(
        caseId,
        'settlement',
        req.user.id,
        settlementDetails
      );

      res.json({
        success: true,
        message: 'Case closed successfully with settlement',
        closure: {
          closureId: closureResult.closureId,
          type: closureResult.type,
          documents: closureResult.documents.map(doc => ({
            type: doc.type || 'unknown',
            filename: doc.filename,
            description: doc.description || ''
          })),
          notifications_sent: closureResult.notifications.length,
          archive_location: closureResult.archiveLocation,
          closed_at: closureResult.closedAt
        }
      });
    } catch (error) {
      logger.error('Error closing case with settlement:', error);
      throw new HttpError('Failed to close case with settlement', 500);
    }
  });

  // Refer case to court
  referToCourtRoute = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { referralReason, courtPreference } = req.body;

    try {
      const referralResult = await CourtReferralService.processCourtReferral(
        caseId,
        referralReason || 'Settlement attempts unsuccessful',
        req.user.id,
        { 
          courtPreference,
          jurisdiction: req.body.jurisdiction,
          estimatedFilingDate: req.body.estimatedFilingDate
        }
      );

      res.json({
        success: true,
        message: 'Case successfully referred to court',
        referral: {
          referralId: referralResult.referralId,
          court: {
            name: referralResult.court.name,
            jurisdiction: referralResult.court.jurisdiction,
            location: referralResult.court.location,
            contact: {
              phone: referralResult.court.phone,
              email: referralResult.court.email
            }
          },
          documents: referralResult.documents.map(doc => ({
            type: doc.type,
            filename: doc.filename,
            description: doc.description
          })),
          next_steps: referralResult.nextSteps,
          estimated_filing_date: referralResult.estimatedFilingDate,
          notifications_sent: referralResult.notifications.length
        }
      });
    } catch (error) {
      logger.error('Error referring case to court:', error);
      throw new HttpError('Failed to refer case to court', 500);
    }
  });

  // Withdraw case
  withdrawCase = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { withdrawalReason } = req.body;

    try {
      const closureResult = await CaseClosureService.initiateClosure(
        caseId,
        'withdrawn',
        req.user.id,
        { reason: withdrawalReason }
      );

      res.json({
        success: true,
        message: 'Case withdrawn successfully',
        closure: {
          closureId: closureResult.closureId,
          type: closureResult.type,
          reason: withdrawalReason,
          notifications_sent: closureResult.notifications.length,
          closed_at: closureResult.closedAt
        }
      });
    } catch (error) {
      logger.error('Error withdrawing case:', error);
      throw new HttpError('Failed to withdraw case', 500);
    }
  });

  // Get document templates
  getDocumentTemplates = asyncHandler(async (req, res) => {
    try {
      const templates = await DocumentTemplateService.listTemplates();
      
      res.json({
        success: true,
        templates: templates.map(template => ({
          name: template.name,
          description: template.description,
          category: template.category,
          last_modified: template.lastModified,
          placeholders: template.placeholders || []
        }))
      });
    } catch (error) {
      logger.error('Error getting document templates:', error);
      throw new HttpError('Failed to get document templates', 500);
    }
  });

  // Render custom document from template
  renderDocumentTemplate = asyncHandler(async (req, res) => {
    const { templateName } = req.params;
    const { templateData, outputFormat = 'html' } = req.body;

    try {
      const rendered = await DocumentTemplateService.renderTemplate(templateName, templateData);

      if (outputFormat === 'pdf') {
        // Convert to PDF
        const pdfResult = await PDFGenerationService.generateFromHTML(
          rendered.html,
          `custom_document_${Date.now()}.pdf`
        );

        res.json({
          success: true,
          document: {
            format: 'pdf',
            filename: pdfResult.filename,
            download_url: `/api/documents/download/${pdfResult.filename}`
          }
        });
      } else {
        res.json({
          success: true,
          document: {
            format: 'html',
            content: rendered.html,
            placeholders_used: rendered.placeholders || []
          }
        });
      }
    } catch (error) {
      logger.error('Error rendering document template:', error);
      throw new HttpError('Failed to render document template', 500);
    }
  });

  // Send signature reminder
  sendSignatureReminder = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { partyEmail } = req.body;

    try {
      // Get document and case data
      const { data: document, error } = await supabase
        .from('case_documents')
        .select('*, cases(*)')
        .eq('id', documentId)
        .single();

      if (error || !document) {
        throw new HttpError('Document not found', 404);
      }

      // Get party information
      const party = await this.getPartyByEmail(document.cases.id, partyEmail);
      if (!party) {
        throw new HttpError('Party not found', 404);
      }

      // Send reminder
      const reminderResult = await EmailService.sendSignatureReminder(
        party,
        document.cases,
        {
          id: documentId,
          type: document.document_type,
          name: document.original_filename
        }
      );

      res.json({
        success: reminderResult.success,
        message: 'Signature reminder sent successfully',
        sent_to: partyEmail,
        message_id: reminderResult.messageId
      });
    } catch (error) {
      logger.error('Error sending signature reminder:', error);
      throw new HttpError('Failed to send signature reminder', 500);
    }
  });

  // Get document and resolution statistics
  getStatistics = asyncHandler(async (req, res) => {
    try {
      const [closureStats, referralStats] = await Promise.all([
        CaseClosureService.getClosureStats(),
        CourtReferralService.getReferralStatistics()
      ]);

      // Get document generation stats
      const { data: documentStats, error } = await supabase
        .from('case_documents')
        .select('document_type, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const docStats = {
        total: documentStats?.length || 0,
        byType: (documentStats || []).reduce((acc, doc) => {
          acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
          return acc;
        }, {})
      };

      res.json({
        success: true,
        statistics: {
          case_closures: closureStats,
          court_referrals: referralStats,
          documents: docStats,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting statistics:', error);
      throw new HttpError('Failed to get statistics', 500);
    }
  });

  // Helper methods
  async recordDocumentGeneration(caseId, documentType, documentInfo, userId) {
    try {
      await supabase
        .from('case_documents')
        .insert({
          case_id: caseId,
          document_type: documentType,
          original_filename: documentInfo.filename,
          file_path: documentInfo.filepath,
          file_size: documentInfo.size || 0,
          generated_by: userId,
          status: 'active',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error recording document generation:', error);
    }
  }

  async getComprehensiveCaseData(caseId) {
    try {
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('*, users!filed_by(*)')
        .eq('id', caseId)
        .single();

      if (caseError) throw caseError;

      const [analysisResult, timelineResult] = await Promise.all([
        supabase
          .from('ai_analysis')
          .select('*')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('case_timeline')
          .select('*')
          .eq('case_id', caseId)
          .order('created_at')
      ]);

      return {
        case: caseData,
        analysis: analysisResult.data?.analysis || null,
        timeline: timelineResult.data || []
      };
    } catch (error) {
      logger.error('Error getting comprehensive case data:', error);
      throw new Error('Failed to get case data');
    }
  }

  async checkAllPartiesSigned(caseId) {
    try {
      // Get settlement documents for this case
      const { data: documents, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId)
        .eq('document_type', 'settlement_agreement');

      if (error || !documents.length) return false;

      // Check if all required parties have signed
      const unsignedDocs = documents.filter(doc => !doc.is_signed);
      return unsignedDocs.length === 0;
    } catch (error) {
      logger.error('Error checking signatures:', error);
      return false;
    }
  }

  async handleDocumentFullySigned(caseId) {
    try {
      // Update case status
      await supabase
        .from('cases')
        .update({
          status: 'signature_complete',
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      // Could trigger automatic case closure or other workflows
      logger.info(`All parties have signed documents for case ${caseId}`);
    } catch (error) {
      logger.error('Error handling fully signed document:', error);
    }
  }

  async getPartyByEmail(caseId, email) {
    try {
      const { data: caseData } = await supabase
        .from('cases')
        .select('*, users!filed_by(*)')
        .eq('id', caseId)
        .single();

      if (caseData.users.email === email) {
        return {
          name: caseData.users.full_name,
          email: caseData.users.email,
          role: 'complainer'
        };
      }

      if (caseData.defender_email === email) {
        return {
          name: caseData.defender_name,
          email: caseData.defender_email,
          role: 'defender'
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting party by email:', error);
      return null;
    }
  }
}

module.exports = new DocumentResolutionController();