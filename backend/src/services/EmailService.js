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