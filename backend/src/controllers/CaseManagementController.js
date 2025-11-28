// Case Management Controller - Enhanced case operations
const Case = require('../models/Case');
const Statement = require('../models/Statement');
const Evidence = require('../models/Evidence');
const EmailService = require('../services/EmailService');
const SMSService = require('../services/SMSService');
const RealTimeService = require('../services/RealTimeService');
const { validationResult } = require('express-validator');

class CaseManagementController {
  // Get all cases for user with advanced filtering
  async getCases(req, res) {
    try {
      const userId = req.user.id;
      const {
        page = 1,
        limit = 10,
        status,
        search,
        sort = 'created_at',
        order = 'desc',
        role, // 'complainer', 'defender', 'all'
        dateFrom,
        dateTo
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build filter conditions
      const filters = {
        limit: parseInt(limit),
        offset,
        status,
        search,
        dateFrom,
        dateTo,
        role
      };

      const cases = await Case.getUserCases(userId, filters);
      const totalCount = await Case.getUserCasesCount(userId, filters);

      // Get additional metadata for each case
      const casesWithMetadata = await Promise.all(
        cases.map(async (caseItem) => {
          const statementStatus = await Statement.checkStatementsComplete(caseItem.id);
          const evidenceCount = await Evidence.getCaseEvidenceCount(caseItem.id);
          const userRole = caseItem.filed_by === userId ? 'complainer' : 'defender';
          
          return {
            ...caseItem,
            statementStatus,
            evidenceCount,
            userRole,
            timeRemaining: this.calculateTimeRemaining(caseItem),
            canTakeAction: this.canUserTakeAction(caseItem, userId, statementStatus)
          };
        })
      );

      res.json({
        success: true,
        data: {
          cases: casesWithMetadata,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / parseInt(limit))
          },
          summary: {
            total: totalCount,
            byStatus: await this.getCaseSummaryByStatus(userId),
            byRole: await this.getCaseSummaryByRole(userId)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching cases:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch cases'
      });
    }
  }

  // Get detailed case information with 2-part layout
  async getCaseDetail(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      // Get complete case details
      const caseDetails = await Case.getCaseWithDetails(caseId, userId);
      if (!caseDetails) {
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied'
        });
      }

      // Get statements with evidence
      const statements = await Statement.getCaseStatements(caseId, userId);
      const statementStatus = await Statement.checkStatementsComplete(caseId);
      
      // Get evidence by party
      const complainerEvidence = await Evidence.getEvidenceByParty(caseId, 'complainer');
      const defenderEvidence = await Evidence.getEvidenceByParty(caseId, 'defender');
      
      // Get case timeline
      const timeline = await this.getCaseTimeline(caseId);
      
      // Determine user role and permissions
      const userRole = caseDetails.filed_by === userId ? 'complainer' : 'defender';
      const canSubmitStatement = this.canSubmitStatement(caseDetails, userId, statementStatus);
      const canUploadEvidence = this.canUploadEvidence(caseDetails, userId);
      
      // Calculate time remaining for current phase
      const timeRemaining = this.calculateTimeRemaining(caseDetails);

      res.json({
        success: true,
        data: {
          // Part 1: Filing Details
          filingDetails: {
            case: {
              id: caseDetails.id,
              title: caseDetails.title,
              description: caseDetails.description,
              case_type: caseDetails.case_type,
              status: caseDetails.status,
              priority: caseDetails.priority,
              dispute_amount: caseDetails.dispute_amount,
              currency: caseDetails.currency,
              created_at: caseDetails.created_at,
              case_number: caseDetails.case_number
            },
            parties: {
              complainer: {
                name: caseDetails.filed_by_name,
                email: caseDetails.filed_by_email,
                role: 'Complainer'
              },
              defender: {
                name: caseDetails.defender_name,
                email: caseDetails.defender_email,
                phone: caseDetails.defender_phone,
                address: caseDetails.defender_address,
                role: 'Defender'
              }
            },
            workflow: {
              currentPhase: this.getCurrentPhase(caseDetails),
              timeRemaining,
              statementDeadline: caseDetails.statement_deadline,
              aiAnalysisStarted: caseDetails.ai_analysis_started_at,
              solutionOptionsGenerated: caseDetails.solution_options_generated_at
            }
          },
          // Part 2: Statements & Evidence
          statementsSection: {
            statements,
            statementStatus,
            evidence: {
              complainer: complainerEvidence,
              defender: defenderEvidence
            },
            timeline,
            permissions: {
              canSubmitStatement,
              canUploadEvidence,
              canEditStatement: this.canEditStatement(statements, userId),
              userRole
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching case detail:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch case details'
      });
    }
  }

  // Submit statement with real-time updates
  async submitStatement(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { caseId } = req.params;
      const { content, evidenceIds = [] } = req.body;
      const userId = req.user.id;

      // Verify case access and statement submission permissions
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      const hasAccess = await Case.checkUserAccess(caseId, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this case'
        });
      }

      // Check if statement submission is allowed
      const statementStatus = await Statement.checkStatementsComplete(caseId);
      if (!this.canSubmitStatement(caseData, userId, statementStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Statement submission is not allowed at this time'
        });
      }

      // Submit the statement
      const statement = await Statement.createStatement({
        case_id: caseId,
        user_id: userId,
        content,
        statement_type: 'written'
      });

      // Attach evidence if provided
      if (evidenceIds.length > 0) {
        await Statement.attachEvidence(statement.id, evidenceIds, userId);
      }

      // Check if both parties have now submitted statements
      const updatedStatus = await Statement.checkStatementsComplete(caseId);
      if (updatedStatus.isComplete && !statementStatus.isComplete) {
        // Automatically start AI analysis phase
        await Case.startAIAnalysisPhase(caseId);
        
        // Notify both parties
        await this.notifyAIAnalysisStarted(caseId);
      }

      // Real-time update to all case participants
      RealTimeService.broadcastToCaseRoom(caseId, 'statement_submitted', {
        statementId: statement.id,
        partyType: statement.party_type,
        userId,
        content,
        createdAt: statement.created_at,
        isPhaseComplete: updatedStatus.isComplete
      });

      res.status(201).json({
        success: true,
        message: 'Statement submitted successfully',
        data: {
          statement,
          statementStatus: updatedStatus,
          nextPhase: updatedStatus.isComplete ? 'ai_analysis' : 'waiting_for_other_party'
        }
      });

    } catch (error) {
      console.error('Error submitting statement:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit statement'
      });
    }
  }

  // Upload evidence with file handling
  async uploadEvidence(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;
      const files = req.files || [];
      const { description, evidenceType = 'document', statementId } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      // Verify case access
      const hasAccess = await Case.checkUserAccess(caseId, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this case'
        });
      }

      const uploadedEvidence = [];
      const errors = [];

      for (const file of files) {
        try {
          // Validate file
          const validation = this.validateEvidenceFile(file);
          if (!validation.isValid) {
            errors.push({
              filename: file.originalname,
              error: validation.error
            });
            continue;
          }

          // Create evidence record
          const evidence = await Evidence.createEvidence({
            case_id: caseId,
            uploader_id: userId,
            file_path: file.path,
            file_name: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
            description,
            evidence_type: evidenceType,
            statement_id: statementId,
            sha256: file.hash || null
          });

          uploadedEvidence.push(evidence);

          // Trigger AI processing for supported file types
          if (this.shouldProcessWithAI(file.mimetype)) {
            this.processEvidenceWithAI(evidence.id);
          }

        } catch (error) {
          errors.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      // Real-time update
      if (uploadedEvidence.length > 0) {
        RealTimeService.broadcastToCaseRoom(caseId, 'evidence_uploaded', {
          evidence: uploadedEvidence,
          uploaderId: userId,
          statementId
        });
      }

      res.json({
        success: uploadedEvidence.length > 0,
        message: `${uploadedEvidence.length} files uploaded successfully`,
        data: {
          uploaded: uploadedEvidence,
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
      console.error('Error uploading evidence:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload evidence'
      });
    }
  }

  // Get case timeline with events
  async getCaseTimeline(caseId) {
    try {
      const { data: timeline } = await Case.supabase
        .from('case_timeline')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      return timeline || [];
    } catch (error) {
      console.error('Error fetching timeline:', error);
      return [];
    }
  }

  // Helper methods for permissions and status
  canSubmitStatement(caseData, userId, statementStatus) {
    // Check if case is in statement phase
    if (!['open', 'statement_phase'].includes(caseData.status)) {
      return false;
    }

    // Check if deadline has passed
    if (caseData.statement_deadline) {
      const deadline = new Date(caseData.statement_deadline);
      if (new Date() > deadline) {
        return false;
      }
    }

    // Determine user role
    const userRole = caseData.filed_by === userId ? 'complainer' : 'defender';
    
    // Check if user has already submitted
    if (userRole === 'complainer' && statementStatus.hasComplainer) {
      return false;
    }
    if (userRole === 'defender' && statementStatus.hasDefender) {
      return false;
    }

    return true;
  }

  canUploadEvidence(caseData, userId) {
    // Can upload evidence during statement phase or until case is closed
    return ['open', 'statement_phase', 'ai_analysis'].includes(caseData.status);
  }

  canEditStatement(statements, userId) {
    const userStatement = statements.find(s => s.user_id === userId);
    if (!userStatement) return false;

    // Check 15-minute edit window
    const createdAt = new Date(userStatement.created_at);
    const now = new Date();
    const timeDiff = (now - createdAt) / (1000 * 60);
    
    return timeDiff <= 15;
  }

  canUserTakeAction(caseData, userId, statementStatus) {
    if (this.canSubmitStatement(caseData, userId, statementStatus)) {
      return { type: 'submit_statement', message: 'Submit your statement' };
    }
    
    if (caseData.status === 'settlement_options') {
      return { type: 'select_option', message: 'Select settlement option' };
    }

    if (caseData.status === 'consensus_pending') {
      return { type: 'sign_agreement', message: 'Sign settlement agreement' };
    }

    return null;
  }

  getCurrentPhase(caseData) {
    const phaseMap = {
      'filed': 'Case Filed',
      'open': 'Awaiting Statements',
      'statement_phase': 'Statement Collection',
      'ai_analysis': 'AI Analysis in Progress',
      'settlement_options': 'Review Settlement Options',
      'consensus_pending': 'Awaiting Signatures',
      'settled': 'Case Resolved',
      'forwarded_to_court': 'Escalated to Court',
      'closed': 'Case Closed'
    };
    
    return phaseMap[caseData.status] || 'Unknown Phase';
  }

  calculateTimeRemaining(caseData) {
    let deadline = null;
    let phase = '';

    if (caseData.statement_deadline && ['open', 'statement_phase'].includes(caseData.status)) {
      deadline = new Date(caseData.statement_deadline);
      phase = 'statement_submission';
    } else if (caseData.parties_response_deadline && caseData.status === 'settlement_options') {
      deadline = new Date(caseData.parties_response_deadline);
      phase = 'option_selection';
    }

    if (!deadline) return null;

    const now = new Date();
    const timeLeft = deadline - now;

    if (timeLeft <= 0) {
      return { expired: true, phase };
    }

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return {
      deadline,
      phase,
      hoursLeft: hours,
      minutesLeft: minutes,
      totalMinutes: Math.floor(timeLeft / (1000 * 60)),
      expired: false
    };
  }

  async getCaseSummaryByStatus(userId) {
    try {
      const { data } = await Case.supabase
        .from('cases')
        .select('status')
        .or(`filed_by.eq.${userId},id.in.(${await Case.getUserCaseIds(userId)})`);

      const summary = {};
      data.forEach(item => {
        summary[item.status] = (summary[item.status] || 0) + 1;
      });

      return summary;
    } catch (error) {
      return {};
    }
  }

  async getCaseSummaryByRole(userId) {
    try {
      const complainerCount = await Case.count({ filed_by: userId });
      const totalCases = await Case.getUserCasesCount(userId);
      
      return {
        complainer: complainerCount,
        defender: totalCases - complainerCount
      };
    } catch (error) {
      return { complainer: 0, defender: 0 };
    }
  }

  validateEvidenceFile(file) {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'audio/mpeg', 'audio/wav',
      'video/mp4', 'video/avi'
    ];

    if (file.size > maxSize) {
      return { isValid: false, error: 'File size exceeds 50MB limit' };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return { isValid: false, error: 'File type not allowed' };
    }

    return { isValid: true };
  }

  shouldProcessWithAI(mimeType) {
    const processableTypes = [
      'image/jpeg', 'image/png',
      'application/pdf',
      'text/plain'
    ];
    return processableTypes.includes(mimeType);
  }

  async processEvidenceWithAI(evidenceId) {
    try {
      // This would integrate with your AI service
      // For now, just mark as processing
      await Evidence.updateProcessingStatus(evidenceId, 'processing');
      
      // Simulate AI processing
      setTimeout(async () => {
        await Evidence.updateProcessingStatus(evidenceId, 'processed', {
          ai_summary: 'AI analysis completed',
          ai_relevance_score: 0.85
        });
      }, 5000);
    } catch (error) {
      console.error('Error processing evidence with AI:', error);
    }
  }

  async notifyAIAnalysisStarted(caseId) {
    try {
      const caseData = await Case.findById(caseId);
      if (!caseData) return;

      // Send notifications to both parties
      const parties = [
        { email: caseData.filed_by_email, phone: caseData.filed_by_phone },
        { email: caseData.defender_email, phone: caseData.defender_phone }
      ];

      for (const party of parties) {
        if (party.email) {
          await EmailService.sendAIAnalysisComplete(party.email, {
            caseNumber: caseData.case_number,
            caseId
          });
        }
        
        if (party.phone) {
          await SMSService.sendAIAnalysisComplete(party.phone, {
            caseNumber: caseData.case_number,
            caseId
          });
        }
      }
    } catch (error) {
      console.error('Error sending AI analysis notifications:', error);
    }
  }
}

module.exports = new CaseManagementController();