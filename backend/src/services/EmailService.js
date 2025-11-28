const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.init();
  }

  init() {
    try {
      // Configure the email transporter based on environment
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        this.isConfigured = true;
      } else if (process.env.SENDGRID_API_KEY) {
        // SendGrid configuration
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
        this.isConfigured = true;
      } else {
        // Development/test mode - use ethereal or console logging
        console.log('📧 Email service running in development mode (no real emails sent)');
        this.isConfigured = false;
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  async sendEmail(options) {
    if (!options.to || !options.subject) {
      throw new Error('Email requires "to" and "subject" fields');
    }

    // In test or development mode without proper config, just log
    if (!this.isConfigured || process.env.NODE_ENV === 'test') {
      console.log('📧 Email (dev mode):', {
        to: options.to,
        subject: options.subject,
        body: options.html || options.text
      });
      return { messageId: 'dev-mode-' + Date.now() };
    }

    try {
      const mailOptions = {
        from: options.from || process.env.EMAIL_FROM || 'noreply@ai-dispute-resolver.com',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  // Negotiation-specific email templates
  async sendNegotiationInvitation(participantEmail, sessionDetails) {
    const subject = `Invitation: Settlement Negotiation for ${sessionDetails.caseTitle}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Settlement Negotiation Invitation</h2>
        
        <p>You have been invited to participate in a settlement negotiation session.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Session Details:</h3>
          <ul>
            <li><strong>Case:</strong> ${sessionDetails.caseTitle || 'N/A'}</li>
            <li><strong>Session ID:</strong> ${sessionDetails.sessionId}</li>
            <li><strong>Deadline:</strong> ${new Date(sessionDetails.deadline).toLocaleString()}</li>
            <li><strong>Max Rounds:</strong> ${sessionDetails.maxRounds || 'Unlimited'}</li>
          </ul>
        </div>
        
        <p>Please review the initial offer and submit your response before the deadline.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/negotiations/${sessionDetails.sessionId}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Negotiation Session
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated message from the AI Dispute Resolver system.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  async sendNegotiationUpdate(participantEmail, updateDetails) {
    const subject = `Negotiation Update: ${updateDetails.sessionId}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Negotiation Session Update</h2>
        
        <p>There has been an update to your negotiation session.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Update Details:</h3>
          <ul>
            <li><strong>Session ID:</strong> ${updateDetails.sessionId}</li>
            <li><strong>Update Type:</strong> ${updateDetails.updateType}</li>
            <li><strong>Current Round:</strong> ${updateDetails.currentRound}</li>
            <li><strong>Status:</strong> ${updateDetails.status}</li>
          </ul>
          
          ${updateDetails.message ? `<p><strong>Message:</strong> ${updateDetails.message}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/negotiations/${updateDetails.sessionId}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Session
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated message from the AI Dispute Resolver system.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  async sendNegotiationReminder(participantEmail, reminderDetails) {
    const subject = `Reminder: Negotiation Response Required - ${reminderDetails.sessionId}`;
    
    const timeRemaining = new Date(reminderDetails.deadline) - new Date();
    const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⏰ Negotiation Response Reminder</h2>
        
        <p>You have a pending response required for your negotiation session.</p>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <h3>Urgent Action Required:</h3>
          <ul>
            <li><strong>Session ID:</strong> ${reminderDetails.sessionId}</li>
            <li><strong>Time Remaining:</strong> ${hoursRemaining > 0 ? `${hoursRemaining} hours` : 'Less than 1 hour'}</li>
            <li><strong>Deadline:</strong> ${new Date(reminderDetails.deadline).toLocaleString()}</li>
          </ul>
        </div>
        
        <p>Please submit your response before the deadline to avoid automatic session expiration.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/negotiations/${reminderDetails.sessionId}" 
             style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Respond Now
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated message from the AI Dispute Resolver system.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  async sendNegotiationCompletion(participantEmail, completionDetails) {
    const isSuccess = completionDetails.status === 'completed_accepted';
    const subject = `Negotiation ${isSuccess ? 'Completed Successfully' : 'Concluded'}: ${completionDetails.sessionId}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isSuccess ? '#059669' : '#dc2626'};">
          ${isSuccess ? '✅ Negotiation Successful' : '❌ Negotiation Concluded'}
        </h2>
        
        <p>Your negotiation session has concluded.</p>
        
        <div style="background-color: ${isSuccess ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Final Results:</h3>
          <ul>
            <li><strong>Session ID:</strong> ${completionDetails.sessionId}</li>
            <li><strong>Final Status:</strong> ${completionDetails.status}</li>
            <li><strong>Total Rounds:</strong> ${completionDetails.finalRound}</li>
            <li><strong>Concluded At:</strong> ${new Date(completionDetails.finalizedAt).toLocaleString()}</li>
          </ul>
          
          ${completionDetails.finalOutcome ? `<p><strong>Outcome:</strong> ${completionDetails.finalOutcome}</p>` : ''}
        </div>
        
        ${isSuccess ? `
          <p>🎉 Congratulations! An agreement has been reached. The next steps will be communicated separately.</p>
        ` : `
          <p>The negotiation session has concluded without an agreement. You may explore other resolution options.</p>
        `}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/negotiations/${completionDetails.sessionId}" 
             style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Session History
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated message from the AI Dispute Resolver system.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  async sendCompromiseGenerated(participantEmail, compromiseDetails) {
    const subject = `AI Compromise Generated: ${compromiseDetails.sessionId}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">🤖 AI-Generated Compromise Available</h2>
        
        <p>Our AI system has analyzed your negotiation and generated a potential compromise solution.</p>
        
        <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Compromise Details:</h3>
          <ul>
            <li><strong>Session ID:</strong> ${compromiseDetails.sessionId}</li>
            <li><strong>AI Confidence:</strong> ${Math.round(compromiseDetails.confidence * 100)}%</li>
            <li><strong>Generated At:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          
          <p><strong>AI Reasoning:</strong> ${compromiseDetails.reasoning}</p>
        </div>
        
        <p>Please review the compromise proposal and decide whether to accept, reject, or use it as a basis for further negotiation.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/negotiations/${compromiseDetails.sessionId}" 
             style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Review Compromise
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          This is an automated message from the AI Dispute Resolver system.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: participantEmail,
      subject,
      html
    });
  }

  // Bulk email for all participants
  async sendBulkEmail(participantEmails, templateFunction, details) {
    const promises = participantEmails.map(email => 
      templateFunction.call(this, email, details)
    );
    
    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`📧 Bulk email results: ${successful} sent, ${failed} failed`);
      return { successful, failed, results };
    } catch (error) {
      console.error('❌ Bulk email error:', error);
      throw error;
    }
  }

  // Dispute filing notification email
  async sendDisputeFileNotification(defenderEmail, disputeDetails) {
    const subject = `LEGAL NOTICE: Dispute Case Filed Against You - ${disputeDetails.caseNumber || 'Case Reference'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin-bottom: 10px;">⚖️ LEGAL NOTICE</h1>
            <p style="color: #6b7280; font-size: 16px; margin: 0;">AI Dispute Resolver System</p>
          </div>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <h2 style="color: #dc2626; margin-top: 0;">A Dispute Case Has Been Filed Against You</h2>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Case Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Case Title:</td><td style="padding: 8px 0;">${disputeDetails.caseTitle}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Case Number:</td><td style="padding: 8px 0;">${disputeDetails.caseNumber || 'Will be assigned shortly'}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Filed By:</td><td style="padding: 8px 0;">${disputeDetails.complainerName}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Case Type:</td><td style="padding: 8px 0;">${disputeDetails.caseType}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Filed Date:</td><td style="padding: 8px 0;">${new Date().toLocaleDateString()}</td></tr>
            </table>
          </div>
          
          <div style="margin: 30px 0;">
            <h3 style="color: #374151;">Case Description:</h3>
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px; line-height: 1.6;">
              ${disputeDetails.description}
            </p>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #856404; margin-top: 0;">⏰ Important Notice:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
              <li>You have <strong>48 hours</strong> to respond once the statement phase begins</li>
              <li>Both parties will have equal time to present their statements and evidence</li>
              <li>After 48 hours, our AI Sheriff will analyze the case and provide fair settlement options</li>
              <li>Failure to respond may result in the case being decided in favor of the complainant</li>
            </ul>
          </div>
          
          <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3 style="color: #0277bd; margin-top: 0;">📋 Next Steps:</h3>
            <ol style="margin: 10px 0; padding-left: 20px; color: #0277bd;">
              <li><strong>Create an account</strong> on our platform using this email address</li>
              <li><strong>Access your case</strong> using the case number provided</li>
              <li><strong>Review the complaint</strong> details carefully</li>
              <li><strong>Submit your response</strong> and evidence within the time limit</li>
              <li><strong>Participate in AI-mediated resolution</strong> process</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/register?email=${encodeURIComponent(defenderEmail)}" 
               style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Access Your Case
            </a>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h4 style="margin-top: 0; color: #374151;">About AI Dispute Resolver:</h4>
            <p style="color: #6b7280; line-height: 1.6; margin: 0;">
              Our AI-powered system provides fair, efficient, and cost-effective dispute resolution. 
              The AI Sheriff analyzes both parties' arguments and evidence to generate unbiased settlement options. 
              If consensus cannot be reached, the case is automatically forwarded to the appropriate court.
            </p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>This is an automated legal notice from the AI Dispute Resolver System.</p>
            <p>For technical support: <a href="mailto:support@ai-dispute-resolver.com">support@ai-dispute-resolver.com</a></p>
            <p>For legal queries: <a href="mailto:legal@ai-dispute-resolver.com">legal@ai-dispute-resolver.com</a></p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: defenderEmail,
      subject,
      html
    });
  }

  // Statement deadline reminder email
  async sendStatementDeadlineReminder(recipientEmail, reminderDetails) {
    const hoursRemaining = Math.ceil((new Date(reminderDetails.deadline) - new Date()) / (1000 * 60 * 60));
    const subject = `URGENT: Statement Submission Required - ${reminderDetails.caseNumber}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: white; padding: 30px; border-radius: 8px;">
          <h2 style="color: #dc2626;">⏰ URGENT: Statement Deadline Approaching</h2>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <h3>Time Remaining: ${hoursRemaining} hours</h3>
            <p><strong>Case Number:</strong> ${reminderDetails.caseNumber}</p>
            <p><strong>Deadline:</strong> ${new Date(reminderDetails.deadline).toLocaleString()}</p>
          </div>
          
          <p>You must submit your statement and evidence before the deadline to participate in the dispute resolution process.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/cases/${reminderDetails.caseId}/statements" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Submit Statement Now
            </a>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html
    });
  }

  // AI analysis completion notification
  async sendAIAnalysisComplete(recipientEmail, analysisDetails) {
    const subject = `AI Analysis Complete - Settlement Options Available for ${analysisDetails.caseNumber}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">🤖 AI Sheriff Analysis Complete</h2>
        
        <p>The AI Sheriff has completed analysis of your dispute case and generated 3 fair settlement options.</p>
        
        <div style="background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Case: ${analysisDetails.caseNumber}</h3>
          <p>Both parties must review and select their preferred option within the specified timeframe.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/cases/${analysisDetails.caseId}/settlement-options" 
             style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Settlement Options
          </a>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html
    });
  }

  // Settlement consensus reached email
  async sendConsensusReached(recipientEmail, settlementDetails) {
    const subject = `🎉 Settlement Agreement Reached - ${settlementDetails.caseNumber}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">🎉 Congratulations! Settlement Reached</h2>
        
        <p>Both parties have agreed on a settlement option for your dispute case.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Case: ${settlementDetails.caseNumber}</h3>
          <p>Please proceed to sign the final settlement agreement to close the case.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/cases/${settlementDetails.caseId}/sign-settlement" 
             style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Sign Agreement
          </a>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html
    });
  }

  // Case forwarded to court email
  async sendCaseForwardedNotification(recipientEmail, forwardDetails) {
    const subject = `Case Escalated to Court - ${forwardDetails.caseNumber}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">⚖️ Case Forwarded to Court</h2>
        
        <p>Your dispute case has been escalated to the court system due to lack of consensus on AI-generated settlement options.</p>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Court Details:</h3>
          <p><strong>Court:</strong> ${forwardDetails.courtName}</p>
          <p><strong>Reference Number:</strong> ${forwardDetails.courtReferenceNumber}</p>
          <p><strong>Expected Hearing:</strong> ${forwardDetails.expectedHearingDate || 'To be announced'}</p>
        </div>
        
        <p>All case documents and evidence have been compiled and sent to the court. You will receive further communication directly from the court system.</p>
      </div>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html
    });
  }

  // Final settlement document email
  async sendFinalSettlementDocument(recipientEmail, documentDetails) {
    const subject = `Final Settlement Document - ${documentDetails.caseNumber}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">✅ Dispute Successfully Resolved</h2>
        
        <p>Your dispute case has been successfully resolved and closed. Please find the final settlement document attached.</p>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Case Summary:</h3>
          <p><strong>Case Number:</strong> ${documentDetails.caseNumber}</p>
          <p><strong>Resolution Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Settlement Type:</strong> ${documentDetails.settlementType}</p>
        </div>
        
        <p>This document is legally binding and serves as proof of the agreed settlement. Keep it for your records.</p>
        
        <p style="font-style: italic;">Thank you for using AI Dispute Resolver for your dispute resolution needs.</p>
      </div>
    `;

    const attachments = documentDetails.documentUrl ? [{
      filename: `Settlement_${documentDetails.caseNumber}.pdf`,
      path: documentDetails.documentUrl
    }] : [];

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
      attachments
    });
  }

  // Service health check
  async healthCheck() {
    if (!this.isConfigured) {
      return { status: 'warning', message: 'Email service not configured (development mode)' };
    }

    try {
      await this.transporter.verify();
      return { status: 'healthy', message: 'Email service operational' };
    } catch (error) {
      return { status: 'error', message: 'Email service connection failed', error: error.message };
    }
  }
}

module.exports = new EmailService();