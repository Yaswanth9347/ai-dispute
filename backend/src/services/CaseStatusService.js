// Case Status Service - Handle case status transitions and workflow automation
const Case = require('../models/Case');
const TimelineService = require('./TimelineService');
const CaseEmailService = require('./CaseEmailService');
const CaseNotification = require('../models/CaseNotification');

class CaseStatusService {
  constructor() {
    // Define all valid status states
    this.STATUSES = {
      PENDING_RESPONSE: 'PENDING_RESPONSE',
      ACTIVE: 'ACTIVE',
      EVIDENCE_SUBMISSION: 'EVIDENCE_SUBMISSION',
      UNDER_ANALYSIS: 'UNDER_ANALYSIS',
      MEDIATION: 'MEDIATION',
      MEDIATION_SUCCESSFUL: 'MEDIATION_SUCCESSFUL',
      MEDIATION_FAILED: 'MEDIATION_FAILED',
      COURT_FILING: 'COURT_FILING',
      CLOSED: 'CLOSED',
      CANCELLED: 'CANCELLED',
      DRAFT: 'draft' // Legacy support
    };

    // Define valid status transitions
    this.TRANSITIONS = {
      PENDING_RESPONSE: ['ACTIVE', 'COURT_FILING', 'CANCELLED'],
      ACTIVE: ['EVIDENCE_SUBMISSION', 'MEDIATION', 'CANCELLED'],
      EVIDENCE_SUBMISSION: ['UNDER_ANALYSIS', 'CANCELLED'],
      UNDER_ANALYSIS: ['MEDIATION', 'COURT_FILING', 'CANCELLED'],
      MEDIATION: ['MEDIATION_SUCCESSFUL', 'MEDIATION_FAILED', 'CANCELLED'],
      MEDIATION_SUCCESSFUL: ['CLOSED'],
      MEDIATION_FAILED: ['COURT_FILING', 'MEDIATION'],
      COURT_FILING: ['CLOSED'],
      DRAFT: ['PENDING_RESPONSE', 'CANCELLED'],
      CANCELLED: [], // Terminal state
      CLOSED: [] // Terminal state
    };

    // Event types for timeline
    this.EVENT_TYPES = {
      STATUS_CHANGE: 'status_change',
      DEFENDANT_JOINED: 'defendant_joined',
      DEADLINE_APPROACHING: 'deadline_approaching',
      DEADLINE_PASSED: 'deadline_passed',
      EVIDENCE_UPLOADED: 'evidence_uploaded',
      SETTLEMENT_PROPOSED: 'settlement_proposed',
      SETTLEMENT_ACCEPTED: 'settlement_accepted',
      SETTLEMENT_REJECTED: 'settlement_rejected',
      COURT_FILING_PREPARED: 'court_filing_prepared',
      AI_ANALYSIS_STARTED: 'ai_analysis_started',
      AI_ANALYSIS_COMPLETED: 'ai_analysis_completed'
    };
  }

  /**
   * Validate if a status transition is allowed
   */
  validateTransition(currentStatus, newStatus) {
    const allowedTransitions = this.TRANSITIONS[currentStatus];
    
    if (!allowedTransitions) {
      throw new Error(`Invalid current status: ${currentStatus}`);
    }

    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${currentStatus} to ${newStatus}. ` +
        `Allowed transitions: ${allowedTransitions.join(', ')}`
      );
    }

    return true;
  }

  /**
   * Update case status with validation and timeline logging
   */
  async updateCaseStatus(caseId, newStatus, actorId, reason = '', metadata = {}) {
    try {
      // Get current case
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      const currentStatus = caseData.status || 'DRAFT';

      // Validate transition
      this.validateTransition(currentStatus, newStatus);

      // Update status in database
      await Case.update({ status: newStatus }, { id: caseId });

      // Log to timeline
      await TimelineService.addEvent(caseId, {
        event_type: this.EVENT_TYPES.STATUS_CHANGE,
        event_title: `Status Changed: ${currentStatus} → ${newStatus}`,
        event_description: reason || `Case status updated to ${newStatus}`,
        actor_id: actorId,
        metadata: {
          previous_status: currentStatus,
          new_status: newStatus,
          reason,
          ...metadata
        },
        is_public: true
      });

      // Execute post-transition actions
      await this.executePostTransitionActions(caseId, currentStatus, newStatus, actorId);

      console.log(`✅ Case ${caseId} status updated: ${currentStatus} → ${newStatus}`);
      
      return {
        success: true,
        previous_status: currentStatus,
        new_status: newStatus,
        case_id: caseId
      };
    } catch (error) {
      console.error('Status update error:', error);
      throw new Error(`Failed to update case status: ${error.message}`);
    }
  }

  /**
   * Execute actions after status transition
   */
  async executePostTransitionActions(caseId, oldStatus, newStatus, actorId) {
    const caseData = await Case.getCaseWithDetails(caseId, null);

    switch (newStatus) {
      case this.STATUSES.ACTIVE:
        await this.onCaseActivated(caseData, actorId);
        break;

      case this.STATUSES.EVIDENCE_SUBMISSION:
        await this.onEvidenceSubmissionStarted(caseData, actorId);
        break;

      case this.STATUSES.UNDER_ANALYSIS:
        await this.onAnalysisStarted(caseData, actorId);
        break;

      case this.STATUSES.MEDIATION:
        await this.onMediationStarted(caseData, actorId);
        break;

      case this.STATUSES.MEDIATION_SUCCESSFUL:
        await this.onMediationSuccessful(caseData, actorId);
        break;

      case this.STATUSES.COURT_FILING:
        await this.onCourtFilingPrepared(caseData, actorId);
        break;

      case this.STATUSES.CLOSED:
        await this.onCaseClosed(caseData, actorId);
        break;

      default:
        break;
    }
  }

  /**
   * Handle defendant joining case (PENDING_RESPONSE → ACTIVE)
   */
  async onDefendantJoined(caseId, defendantUserId) {
    try {
      const caseData = await Case.findById(caseId);
      
      // Update defendant_user_id if not set
      if (!caseData.defendant_user_id) {
        await Case.update({ defendant_user_id: defendantUserId }, { id: caseId });
      }

      // Calculate submission deadline (24 hours from now)
      const submissionDeadline = new Date();
      submissionDeadline.setHours(submissionDeadline.getHours() + 24);

      await Case.update({
        submission_deadline: submissionDeadline.toISOString()
      }, { id: caseId });

      // Transition to ACTIVE status
      await this.updateCaseStatus(
        caseId,
        this.STATUSES.ACTIVE,
        defendantUserId,
        'Defendant joined the case',
        { submission_deadline: submissionDeadline.toISOString() }
      );

      // Log defendant joined event
      await TimelineService.addEvent(caseId, {
        event_type: this.EVENT_TYPES.DEFENDANT_JOINED,
        event_title: 'Defendant Joined Case',
        event_description: `${caseData.other_party_name} has joined the case and can now respond`,
        actor_id: defendantUserId,
        metadata: {
          defendant_id: defendantUserId,
          submission_deadline: submissionDeadline.toISOString()
        },
        is_public: true
      });

      // Send notification to plaintiff
      const notification = await CaseNotification.createNotification({
        case_id: caseId,
        recipient_email: caseData.plaintiff_email,
        recipient_name: caseData.plaintiff_name,
        notification_type: 'defendant_joined',
        subject: `${caseData.other_party_name} has joined case ${caseData.case_reference_number}`,
        status: 'pending'
      });

      CaseEmailService.sendDefendantJoinedNotification({
        caseId: caseId,
        caseReferenceNumber: caseData.case_reference_number,
        plaintiffEmail: caseData.plaintiff_email,
        plaintiffName: caseData.plaintiff_name,
        defendantName: caseData.other_party_name,
        submissionDeadline: submissionDeadline.toISOString()
      }).then(result => {
        CaseNotification.updateStatus(
          notification.id,
          result.success ? 'sent' : 'failed',
          result.error || null
        );
      }).catch(err => {
        console.error('Failed to send defendant joined email:', err);
      });

      console.log(`✅ Defendant joined case ${caseId}, transitioned to ACTIVE`);
      return { success: true };
    } catch (error) {
      console.error('Error handling defendant join:', error);
      throw error;
    }
  }

  /**
   * Handle case activated
   */
  async onCaseActivated(caseData, actorId) {
    console.log(`📋 Case ${caseData.id} is now ACTIVE - both parties can submit evidence`);
    // Additional activation logic can be added here
  }

  /**
   * Handle evidence submission period started
   */
  async onEvidenceSubmissionStarted(caseData, actorId) {
    console.log(`📄 Evidence submission period started for case ${caseData.id}`);
    
    // Send notifications to both parties
    // TODO: Implement evidence submission notifications
  }

  /**
   * Handle AI analysis started
   */
  async onAnalysisStarted(caseData, actorId) {
    console.log(`🤖 AI analysis started for case ${caseData.id}`);
    
    await TimelineService.addEvent(caseData.id, {
      event_type: this.EVENT_TYPES.AI_ANALYSIS_STARTED,
      event_title: 'AI Analysis Started',
      event_description: 'Case is being analyzed by AI to determine strength and recommendations',
      actor_id: null, // System action
      metadata: { automated: true },
      is_public: true
    });

    // TODO: Trigger actual AI analysis service
  }

  /**
   * Handle mediation started
   */
  async onMediationStarted(caseData, actorId) {
    console.log(`🤝 Mediation started for case ${caseData.id}`);
    // TODO: Send mediation invitation emails
  }

  /**
   * Handle successful mediation
   */
  async onMediationSuccessful(caseData, actorId) {
    console.log(`✅ Mediation successful for case ${caseData.id}`);
    // TODO: Generate settlement agreement document
  }

  /**
   * Handle court filing prepared
   */
  async onCourtFilingPrepared(caseData, actorId) {
    console.log(`⚖️  Court filing prepared for case ${caseData.id}`);
    
    await TimelineService.addEvent(caseData.id, {
      event_type: this.EVENT_TYPES.COURT_FILING_PREPARED,
      event_title: 'Case Forwarded to Court',
      event_description: 'Case has been prepared for court filing',
      actor_id: actorId,
      metadata: { ready_for_filing: true },
      is_public: true
    });

    // TODO: Generate court filing documents
  }

  /**
   * Handle case closed
   */
  async onCaseClosed(caseData, actorId) {
    console.log(`🔒 Case ${caseData.id} has been closed`);
    // Archive case data, send final notifications
  }

  /**
   * Check if status transition is automatic or manual
   */
  isAutomaticTransition(fromStatus, toStatus) {
    const automaticTransitions = {
      PENDING_RESPONSE: ['COURT_FILING'], // Auto-escalate after 48h
      EVIDENCE_SUBMISSION: ['UNDER_ANALYSIS'], // Auto-start analysis after deadline
      UNDER_ANALYSIS: ['MEDIATION'] // Auto-suggest mediation after analysis
    };

    return automaticTransitions[fromStatus]?.includes(toStatus) || false;
  }

  /**
   * Get allowed next statuses for a case
   */
  getAllowedNextStatuses(currentStatus) {
    return this.TRANSITIONS[currentStatus] || [];
  }

  /**
   * Get status display information
   */
  getStatusInfo(status) {
    const statusInfo = {
      PENDING_RESPONSE: {
        label: 'Pending Response',
        description: 'Waiting for defendant to join',
        color: 'orange',
        icon: 'clock'
      },
      ACTIVE: {
        label: 'Active',
        description: 'Both parties can submit evidence',
        color: 'blue',
        icon: 'activity'
      },
      EVIDENCE_SUBMISSION: {
        label: 'Evidence Submission',
        description: 'Final evidence submission period',
        color: 'purple',
        icon: 'file-text'
      },
      UNDER_ANALYSIS: {
        label: 'Under Analysis',
        description: 'AI is analyzing the case',
        color: 'indigo',
        icon: 'cpu'
      },
      MEDIATION: {
        label: 'Mediation',
        description: 'Attempting to reach settlement',
        color: 'yellow',
        icon: 'users'
      },
      MEDIATION_SUCCESSFUL: {
        label: 'Settlement Reached',
        description: 'Case settled via mediation',
        color: 'green',
        icon: 'check-circle'
      },
      MEDIATION_FAILED: {
        label: 'Mediation Failed',
        description: 'Settlement could not be reached',
        color: 'red',
        icon: 'x-circle'
      },
      COURT_FILING: {
        label: 'Court Filing',
        description: 'Case forwarded to court',
        color: 'gray',
        icon: 'briefcase'
      },
      CLOSED: {
        label: 'Closed',
        description: 'Case has been resolved',
        color: 'green',
        icon: 'check'
      },
      CANCELLED: {
        label: 'Cancelled',
        description: 'Case was withdrawn',
        color: 'gray',
        icon: 'slash'
      },
      draft: {
        label: 'Draft',
        description: 'Case is being prepared',
        color: 'gray',
        icon: 'edit'
      }
    };

    return statusInfo[status] || {
      label: status,
      description: 'Unknown status',
      color: 'gray',
      icon: 'help-circle'
    };
  }
}

module.exports = new CaseStatusService();
