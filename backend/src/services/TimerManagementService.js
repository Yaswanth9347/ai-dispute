// Timer Management Service - 48-hour deadline system for disputes
const Case = require('../models/Case');
const Statement = require('../models/Statement');
const EmailService = require('../services/EmailService');
const SMSService = require('../services/SMSService');
const RealTimeService = require('../services/RealTimeService');
const logger = require('../lib/logger');

class TimerManagementService {
  constructor() {
    this.activeTimers = new Map(); // caseId -> timer info
    this.reminderTimers = new Map(); // caseId -> reminder timer info
    this.isRunning = false;
  }

  // Initialize the timer service
  initialize() {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Timer Management Service initialized');

    // Start the main monitoring loop
    this.startMonitoringLoop();
    
    // Load existing active timers from database
    this.loadActiveTimers();

    return this;
  }

  // Start monitoring loop to check deadlines every minute
  startMonitoringLoop() {
    setInterval(async () => {
      try {
        await this.checkAllDeadlines();
        await this.sendScheduledReminders();
      } catch (error) {
        logger.error('Error in timer monitoring loop:', error);
      }
    }, 60 * 1000); // Check every minute

    logger.info('Timer monitoring loop started');
  }

  // Load active timers from database
  async loadActiveTimers() {
    try {
      const { data: activeCases } = await Case.supabase
        .from('cases')
        .select('id, statement_deadline, parties_response_deadline, status')
        .in('status', ['statement_phase', 'settlement_options'])
        .not('statement_deadline', 'is', null)
        .not('parties_response_deadline', 'is', null);

      for (const caseData of activeCases || []) {
        if (caseData.statement_deadline && caseData.status === 'statement_phase') {
          this.startStatementTimer(caseData.id, new Date(caseData.statement_deadline));
        }
        
        if (caseData.parties_response_deadline && caseData.status === 'settlement_options') {
          this.startResponseTimer(caseData.id, new Date(caseData.parties_response_deadline));
        }
      }

      logger.info(`Loaded ${activeCases?.length || 0} active timers from database`);
    } catch (error) {
      logger.error('Error loading active timers:', error);
    }
  }

  // Start 48-hour statement timer for a case
  async startStatementTimer(caseId, deadline = null) {
    try {
      // Clear existing timer if any
      this.clearTimer(caseId);

      // Set deadline if not provided (48 hours from now)
      if (!deadline) {
        deadline = new Date();
        deadline.setHours(deadline.getHours() + 48);
        
        // Update case with deadline
        await Case.updateById(caseId, {
          statement_deadline: deadline.toISOString(),
          status: 'statement_phase'
        });
      }

      // Store timer info
      const timerInfo = {
        caseId,
        type: 'statement_submission',
        deadline,
        startedAt: new Date(),
        remindersSent: []
      };

      this.activeTimers.set(caseId, timerInfo);

      // Schedule reminders
      this.scheduleReminders(caseId, deadline, 'statement');

      // Notify both parties
      await this.notifyTimerStarted(caseId, deadline, 'statement');

      // Real-time update
      RealTimeService.broadcastToCaseRoom(caseId, 'timer_started', {
        type: 'statement_submission',
        deadline: deadline.toISOString(),
        hoursRemaining: 48
      });

      logger.info(`Statement timer started for case ${caseId}, deadline: ${deadline.toISOString()}`);
      
      return timerInfo;
    } catch (error) {
      logger.error(`Error starting statement timer for case ${caseId}:`, error);
      throw error;
    }
  }

  // Start response timer for settlement options
  async startResponseTimer(caseId, deadline = null, hours = 72) {
    try {
      // Clear existing timer if any
      this.clearTimer(caseId);

      // Set deadline if not provided
      if (!deadline) {
        deadline = new Date();
        deadline.setHours(deadline.getHours() + hours);
        
        // Update case with deadline
        await Case.updateById(caseId, {
          parties_response_deadline: deadline.toISOString(),
          status: 'settlement_options'
        });
      }

      // Store timer info
      const timerInfo = {
        caseId,
        type: 'settlement_response',
        deadline,
        startedAt: new Date(),
        remindersSent: []
      };

      this.activeTimers.set(caseId, timerInfo);

      // Schedule reminders
      this.scheduleReminders(caseId, deadline, 'response');

      // Notify both parties
      await this.notifyTimerStarted(caseId, deadline, 'response');

      // Real-time update
      RealTimeService.broadcastToCaseRoom(caseId, 'timer_started', {
        type: 'settlement_response',
        deadline: deadline.toISOString(),
        hoursRemaining: hours
      });

      logger.info(`Response timer started for case ${caseId}, deadline: ${deadline.toISOString()}`);
      
      return timerInfo;
    } catch (error) {
      logger.error(`Error starting response timer for case ${caseId}:`, error);
      throw error;
    }
  }

  // Schedule reminder notifications
  scheduleReminders(caseId, deadline, type) {
    const now = new Date();
    const timeUntilDeadline = deadline - now;

    // Define reminder times (hours before deadline)
    const reminderTimes = type === 'statement' 
      ? [24, 6, 1] // 24h, 6h, 1h before deadline
      : [48, 12, 2]; // 48h, 12h, 2h before deadline

    reminderTimes.forEach(hours => {
      const reminderTime = new Date(deadline);
      reminderTime.setHours(reminderTime.getHours() - hours);
      
      const timeUntilReminder = reminderTime - now;
      
      if (timeUntilReminder > 0) {
        const timerId = setTimeout(async () => {
          await this.sendReminder(caseId, hours, type);
        }, timeUntilReminder);

        // Store reminder timer
        const reminderKey = `${caseId}_${hours}h`;
        this.reminderTimers.set(reminderKey, {
          timerId,
          caseId,
          hours,
          type,
          scheduledFor: reminderTime
        });
      }
    });
  }

  // Send reminder notification
  async sendReminder(caseId, hoursLeft, type) {
    try {
      const caseData = await Case.findById(caseId);
      if (!caseData) return;

      const timerInfo = this.activeTimers.get(caseId);
      if (!timerInfo) return;

      // Mark reminder as sent
      timerInfo.remindersSent.push({
        hoursLeft,
        sentAt: new Date()
      });

      const reminderData = {
        caseId,
        caseNumber: caseData.case_number || caseData.id,
        deadline: timerInfo.deadline,
        hoursLeft,
        type
      };

      // Send to both parties
      const parties = await this.getCaseParties(caseId);
      
      for (const party of parties) {
        // Send email reminder
        if (party.email) {
          if (type === 'statement') {
            await EmailService.sendStatementDeadlineReminder(party.email, reminderData);
          } else {
            await EmailService.sendResponseDeadlineReminder(party.email, reminderData);
          }
        }

        // Send SMS reminder
        if (party.phone) {
          if (type === 'statement') {
            await SMSService.sendStatementDeadlineReminder(party.phone, reminderData);
          } else {
            await SMSService.sendResponseDeadlineReminder(party.phone, reminderData);
          }
        }
      }

      // Real-time notification
      RealTimeService.broadcastToCaseRoom(caseId, 'deadline_reminder', {
        type,
        hoursLeft,
        deadline: timerInfo.deadline.toISOString()
      });

      logger.info(`Sent ${hoursLeft}h reminder for case ${caseId}`);
    } catch (error) {
      logger.error(`Error sending reminder for case ${caseId}:`, error);
    }
  }

  // Check all deadlines and handle expired ones
  async checkAllDeadlines() {
    const now = new Date();
    
    for (const [caseId, timerInfo] of this.activeTimers.entries()) {
      if (now >= timerInfo.deadline) {
        await this.handleExpiredDeadline(caseId, timerInfo);
      }
    }
  }

  // Handle expired deadline
  async handleExpiredDeadline(caseId, timerInfo) {
    try {
      logger.info(`Handling expired deadline for case ${caseId}, type: ${timerInfo.type}`);

      const caseData = await Case.findById(caseId);
      if (!caseData) {
        this.clearTimer(caseId);
        return;
      }

      if (timerInfo.type === 'statement_submission') {
        await this.handleExpiredStatementDeadline(caseId, caseData);
      } else if (timerInfo.type === 'settlement_response') {
        await this.handleExpiredResponseDeadline(caseId, caseData);
      }

      // Clear the timer
      this.clearTimer(caseId);
      
      // Real-time notification
      RealTimeService.broadcastToCaseRoom(caseId, 'deadline_expired', {
        type: timerInfo.type,
        expiredAt: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`Error handling expired deadline for case ${caseId}:`, error);
    }
  }

  // Handle expired statement submission deadline
  async handleExpiredStatementDeadline(caseId, caseData) {
    const statementStatus = await Statement.checkStatementsComplete(caseId);
    
    if (statementStatus.isComplete) {
      // Both parties submitted, start AI analysis
      await Case.startAIAnalysisPhase(caseId);
      await this.notifyAIAnalysisStarted(caseId);
    } else {
      // Not all parties submitted, check what to do
      if (!statementStatus.hasComplainer && !statementStatus.hasDefender) {
        // No one submitted - close case or extend deadline
        await Case.updateStatus(caseId, 'closed', null, 'No statements submitted within deadline');
        await this.notifyDeadlineExpiredClosure(caseId, 'no_statements');
      } else {
        // Some submitted - proceed with partial statements or extend deadline
        const missingParty = !statementStatus.hasComplainer ? 'complainer' : 'defender';
        
        // Option 1: Proceed with available statements
        await Case.startAIAnalysisPhase(caseId);
        await this.notifyPartialStatementProceeding(caseId, missingParty);
        
        // Option 2: Close case (uncomment if preferred)
        // await Case.updateStatus(caseId, 'closed', null, `${missingParty} did not submit statement`);
        // await this.notifyDeadlineExpiredClosure(caseId, `missing_${missingParty}_statement`);
      }
    }
  }

  // Handle expired settlement response deadline
  async handleExpiredResponseDeadline(caseId, caseData) {
    // Check if consensus was reached
    const { data: responses } = await Case.supabase
      .from('settlement_responses')
      .select('*')
      .eq('case_id', caseId);

    if (!responses || responses.length === 0) {
      // No responses - escalate to court
      await this.escalateToCourtDueToTimeout(caseId, 'no_responses');
    } else {
      // Some responses - check for consensus or escalate
      const uniqueChoices = [...new Set(responses.map(r => r.selected_option))];
      
      if (uniqueChoices.length === 1) {
        // Consensus reached even without all responses
        await Case.updateStatus(caseId, 'consensus_pending', null, 'Consensus reached before deadline');
      } else {
        // No consensus - escalate to court
        await this.escalateToCourtDueToTimeout(caseId, 'no_consensus');
      }
    }
  }

  // Extend deadline for a case
  async extendDeadline(caseId, additionalHours, reason = '') {
    try {
      const timerInfo = this.activeTimers.get(caseId);
      if (!timerInfo) {
        throw new Error('No active timer found for this case');
      }

      const newDeadline = new Date(timerInfo.deadline);
      newDeadline.setHours(newDeadline.getHours() + additionalHours);

      // Update timer info
      timerInfo.deadline = newDeadline;
      timerInfo.extended = true;
      timerInfo.extensionReason = reason;

      // Update database
      const updateData = {};
      if (timerInfo.type === 'statement_submission') {
        updateData.statement_deadline = newDeadline.toISOString();
      } else if (timerInfo.type === 'settlement_response') {
        updateData.parties_response_deadline = newDeadline.toISOString();
      }

      await Case.updateById(caseId, updateData);

      // Clear old reminders and schedule new ones
      this.clearReminders(caseId);
      this.scheduleReminders(caseId, newDeadline, timerInfo.type.includes('statement') ? 'statement' : 'response');

      // Notify parties
      await this.notifyDeadlineExtended(caseId, newDeadline, additionalHours, reason);

      // Real-time update
      RealTimeService.broadcastToCaseRoom(caseId, 'deadline_extended', {
        newDeadline: newDeadline.toISOString(),
        additionalHours,
        reason
      });

      logger.info(`Deadline extended for case ${caseId} by ${additionalHours} hours`);
      
      return { newDeadline, additionalHours };
    } catch (error) {
      logger.error(`Error extending deadline for case ${caseId}:`, error);
      throw error;
    }
  }

  // Clear timer for a case
  clearTimer(caseId) {
    this.activeTimers.delete(caseId);
    this.clearReminders(caseId);
    logger.debug(`Cleared timer for case ${caseId}`);
  }

  // Clear reminder timers for a case
  clearReminders(caseId) {
    const remindersToDelete = [];
    
    for (const [key, reminder] of this.reminderTimers.entries()) {
      if (reminder.caseId === caseId) {
        clearTimeout(reminder.timerId);
        remindersToDelete.push(key);
      }
    }

    remindersToDelete.forEach(key => {
      this.reminderTimers.delete(key);
    });
  }

  // Stop timer for a case (when case is resolved or closed)
  async stopTimer(caseId, reason = 'Case resolved') {
    try {
      const timerInfo = this.activeTimers.get(caseId);
      if (!timerInfo) return;

      this.clearTimer(caseId);

      // Real-time notification
      RealTimeService.broadcastToCaseRoom(caseId, 'timer_stopped', {
        reason,
        stoppedAt: new Date().toISOString()
      });

      logger.info(`Timer stopped for case ${caseId}: ${reason}`);
    } catch (error) {
      logger.error(`Error stopping timer for case ${caseId}:`, error);
    }
  }

  // Get timer info for a case
  getTimerInfo(caseId) {
    const timerInfo = this.activeTimers.get(caseId);
    if (!timerInfo) return null;

    const now = new Date();
    const timeRemaining = timerInfo.deadline - now;
    
    return {
      ...timerInfo,
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
      hoursRemaining: Math.floor(timeRemaining / (1000 * 60 * 60)),
      minutesRemaining: Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)),
      isExpired: timeRemaining <= 0,
      remindersSent: timerInfo.remindersSent.length
    };
  }

  // Get all active timers
  getAllActiveTimers() {
    const activeTimers = [];
    
    for (const [caseId, timerInfo] of this.activeTimers.entries()) {
      activeTimers.push({
        caseId,
        ...this.getTimerInfo(caseId)
      });
    }

    return activeTimers;
  }

  // Helper methods
  async getCaseParties(caseId) {
    try {
      const caseData = await Case.findById(caseId);
      if (!caseData) return [];

      const parties = [];
      
      // Add complainer
      if (caseData.filed_by_email) {
        parties.push({
          role: 'complainer',
          email: caseData.filed_by_email,
          phone: caseData.filed_by_phone
        });
      }

      // Add defender
      if (caseData.defender_email) {
        parties.push({
          role: 'defender',
          email: caseData.defender_email,
          phone: caseData.defender_phone
        });
      }

      return parties;
    } catch (error) {
      logger.error(`Error getting case parties for ${caseId}:`, error);
      return [];
    }
  }

  async notifyTimerStarted(caseId, deadline, type) {
    const caseData = await Case.findById(caseId);
    if (!caseData) return;

    const parties = await this.getCaseParties(caseId);
    const hoursRemaining = Math.ceil((deadline - new Date()) / (1000 * 60 * 60));

    const notificationData = {
      caseId,
      caseNumber: caseData.case_number || caseData.id,
      deadline,
      hoursRemaining,
      type
    };

    for (const party of parties) {
      if (party.email) {
        if (type === 'statement') {
          await EmailService.sendStatementPhaseStarted(party.email, notificationData);
        } else {
          await EmailService.sendResponsePhaseStarted(party.email, notificationData);
        }
      }
    }
  }

  async notifyDeadlineExtended(caseId, newDeadline, additionalHours, reason) {
    const parties = await this.getCaseParties(caseId);
    const caseData = await Case.findById(caseId);

    for (const party of parties) {
      if (party.email) {
        await EmailService.sendDeadlineExtensionNotification(party.email, {
          caseNumber: caseData.case_number || caseData.id,
          newDeadline,
          additionalHours,
          reason
        });
      }
      
      if (party.phone) {
        await SMSService.sendDeadlineExtensionNotification(party.phone, {
          caseNumber: caseData.case_number || caseData.id,
          additionalHours
        });
      }
    }
  }

  async escalateToCourtDueToTimeout(caseId, reason) {
    await Case.updateStatus(caseId, 'forwarded_to_court', null, `Escalated due to timeout: ${reason}`);
    
    // Trigger court forwarding process
    const CourtForwardingService = require('./CourtForwardingService');
    await CourtForwardingService.forwardCase(caseId, `Timeout: ${reason}`);
  }

  // Service stats
  getServiceStats() {
    return {
      activeTimers: this.activeTimers.size,
      activeReminders: this.reminderTimers.size,
      isRunning: this.isRunning,
      uptime: new Date() - this.startTime || new Date(),
      timerDetails: this.getAllActiveTimers().map(t => ({
        caseId: t.caseId,
        type: t.type,
        hoursRemaining: t.hoursRemaining,
        remindersSent: t.remindersSent
      }))
    };
  }
}

module.exports = new TimerManagementService();