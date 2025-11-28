// SMS Service using Twilio for defender notifications and alerts
const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    this.isConfigured = false;
    this.fromNumber = null;
    this.init();
  }

  init() {
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        this.fromNumber = process.env.TWILIO_FROM_NUMBER;
        this.isConfigured = true;
        console.log('📱 SMS service initialized successfully');
      } else {
        console.log('📱 SMS service running in development mode (no real SMS sent)');
        this.isConfigured = false;
      }
    } catch (error) {
      console.error('Failed to initialize SMS service:', error);
      this.isConfigured = false;
    }
  }

  async sendSMS(options) {
    if (!options.to || !options.body) {
      throw new Error('SMS requires "to" and "body" fields');
    }

    // Format phone number to ensure it starts with country code
    let phoneNumber = options.to.trim();
    if (!phoneNumber.startsWith('+')) {
      // Assume Indian number if no country code
      phoneNumber = '+91' + phoneNumber.replace(/^0+/, '');
    }

    // In test or development mode without proper config, just log
    if (!this.isConfigured || process.env.NODE_ENV === 'test') {
      console.log('📱 SMS (dev mode):', {
        to: phoneNumber,
        body: options.body
      });
      return { messageId: 'dev-mode-' + Date.now(), to: phoneNumber };
    }

    try {
      const message = await this.client.messages.create({
        body: options.body,
        from: this.fromNumber,
        to: phoneNumber
      });

      console.log('✅ SMS sent successfully:', message.sid);
      return { 
        messageId: message.sid, 
        to: phoneNumber,
        status: message.status
      };
    } catch (error) {
      console.error('❌ Failed to send SMS:', error);
      throw error;
    }
  }

  /**
   * Send defender notification SMS when case is filed
   * @param {string} phoneNumber - Defender's phone number
   * @param {string} caseId - Case ID
   * @param {string} complainerName - Complainer's name
   * @returns {Promise<Object>} Result
   */
  async sendDefenderNotification(phoneNumber, caseId, complainerName) {
    const message = `⚖️ DISPUTE CASE FILED AGAINST YOU

A dispute case (ID: ${caseId}) has been filed against you by ${complainerName}.

You have been automatically registered on our AI Dispute Resolution Platform.

Check your email for login credentials and case details.

Please respond within 48 hours.

Visit: ${process.env.FRONTEND_URL || 'https://ai-dispute.com'}`;
    
    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // Dispute filing notification SMS
  async sendDisputeFileNotification(phoneNumber, disputeDetails) {
    const message = `🏛️ AI DISPUTE RESOLVER
    
NOTICE: A dispute case has been filed against you.

Case: ${disputeDetails.caseTitle}
Case No: ${disputeDetails.caseNumber || 'Pending'}
Filed By: ${disputeDetails.complainerName}

You have 48 hours to respond with your statement once the case opens. Check your email for detailed information.

For queries: support@ai-dispute-resolver.com`;

    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // Statement deadline reminder SMS
  async sendStatementDeadlineReminder(phoneNumber, reminderDetails) {
    const hoursRemaining = Math.ceil((new Date(reminderDetails.deadline) - new Date()) / (1000 * 60 * 60));
    
    const message = `⏰ URGENT: Statement Required
    
Case No: ${reminderDetails.caseNumber}
Time Remaining: ${hoursRemaining} hours

Please submit your statement before the deadline to avoid case escalation.

Submit at: ${process.env.FRONTEND_URL || 'https://ai-dispute-resolver.com'}/cases/${reminderDetails.caseId}`;

    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // AI analysis completion notification
  async sendAIAnalysisComplete(phoneNumber, analysisDetails) {
    const message = `🤖 AI Analysis Complete
    
Case No: ${analysisDetails.caseNumber}

The AI Sheriff has completed analysis and generated 3 fair settlement options. Please review and choose your preferred option.

View options: ${process.env.FRONTEND_URL || 'https://ai-dispute-resolver.com'}/cases/${analysisDetails.caseId}/options`;

    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // Settlement consensus reached notification
  async sendConsensusReached(phoneNumber, settlementDetails) {
    const message = `🎉 Settlement Agreement Reached!
    
Case No: ${settlementDetails.caseNumber}

Both parties have agreed on a settlement option. Please proceed to sign the final agreement.

Sign agreement: ${process.env.FRONTEND_URL || 'https://ai-dispute-resolver.com'}/cases/${settlementDetails.caseId}/sign`;

    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // Case forwarded to court notification
  async sendCaseForwardedNotification(phoneNumber, forwardDetails) {
    const message = `⚖️ Case Escalated to Court
    
Case No: ${forwardDetails.caseNumber}

Your dispute case has been forwarded to ${forwardDetails.courtName} due to no consensus on AI-generated settlement options.

Court Reference: ${forwardDetails.courtReferenceNumber}
Expected hearing: ${forwardDetails.expectedHearingDate || 'TBD'}

Check email for detailed court documents.`;

    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // Case closure notification
  async sendCaseClosedNotification(phoneNumber, closureDetails) {
    const message = `✅ Dispute Resolved Successfully
    
Case No: ${closureDetails.caseNumber}

Your dispute has been successfully resolved and closed. Final settlement document has been sent to your email.

Thank you for using AI Dispute Resolver.`;

    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // Generic case update notification
  async sendCaseUpdateNotification(phoneNumber, updateDetails) {
    const message = `📋 Case Update
    
Case No: ${updateDetails.caseNumber}
Status: ${updateDetails.newStatus}

${updateDetails.message}

View case: ${process.env.FRONTEND_URL || 'https://ai-dispute-resolver.com'}/cases/${updateDetails.caseId}`;

    return this.sendSMS({
      to: phoneNumber,
      body: message
    });
  }

  // Bulk SMS to multiple recipients
  async sendBulkSMS(recipients, messageTemplate, templateData) {
    try {
      const results = [];
      
      for (const recipient of recipients) {
        try {
          // Replace template variables
          let message = messageTemplate;
          Object.keys(templateData).forEach(key => {
            message = message.replace(new RegExp(`{{${key}}}`, 'g'), templateData[key]);
          });

          const result = await this.sendSMS({
            to: recipient.phoneNumber,
            body: message
          });
          
          results.push({ 
            success: true, 
            recipient: recipient.phoneNumber,
            messageId: result.messageId 
          });
        } catch (error) {
          results.push({ 
            success: false, 
            recipient: recipient.phoneNumber,
            error: error.message 
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`📱 Bulk SMS results: ${successful} sent, ${failed} failed`);
      return { successful, failed, results };
    } catch (error) {
      console.error('❌ Bulk SMS error:', error);
      throw error;
    }
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;
    
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid length (10-15 digits)
    if (digits.length < 10 || digits.length > 15) {
      return false;
    }
    
    // Indian mobile number validation (starts with 6-9 after country code)
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return true;
    }
    
    // International format validation
    if (digits.length >= 10) {
      return true;
    }
    
    return false;
  }

  // Format phone number for international use
  formatPhoneNumber(phoneNumber, countryCode = '91') {
    if (!phoneNumber) return null;
    
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If already has country code, return as is
    if (cleaned.length > 10) {
      return '+' + cleaned;
    }
    
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');
    
    // Add country code
    return '+' + countryCode + cleaned;
  }

  // Service health check
  async healthCheck() {
    if (!this.isConfigured) {
      return { 
        status: 'warning', 
        message: 'SMS service not configured (development mode)' 
      };
    }

    try {
      // Test Twilio connection by fetching account info
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return { 
        status: 'healthy', 
        message: 'SMS service operational',
        accountStatus: account.status 
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: 'SMS service connection failed', 
        error: error.message 
      };
    }
  }

  // Get message delivery status
  async getMessageStatus(messageId) {
    if (!this.isConfigured) {
      return { status: 'unknown', message: 'SMS service not configured' };
    }

    try {
      const message = await this.client.messages(messageId).fetch();
      return {
        messageId: message.sid,
        status: message.status,
        to: message.to,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}

module.exports = new SMSService();