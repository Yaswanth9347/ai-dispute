// Defender Onboarding Service - Auto-create defender accounts when case is filed
const { logger } = require('../lib/logger');
const { supabase } = require('../lib/supabaseClient');
const EmailService = require('./EmailService');
const SMSService = require('./SMSService');
const { generateRandomPassword } = require('../utils/password');
const bcrypt = require('bcrypt');

class DefenderOnboardingService {
  /**
   * Create defender account automatically when case is filed
   * @param {string} caseId - Case ID
   * @param {Object} defenderDetails - Defender information
   * @param {string} complainerName - Name of the person who filed the case
   * @returns {Promise<Object>} Result with user ID and credentials
   */
  async createDefenderAccount(caseId, defenderDetails, complainerName) {
    try {
      logger.info(`Creating defender account for case ${caseId}`, {
        email: defenderDetails.email,
        name: defenderDetails.name
      });

      // Check if user already exists
      const existingUser = await this.checkExistingUser(defenderDetails.email);
      
      if (existingUser) {
        // User exists, just link to case and notify
        await this.linkDefenderToCase(caseId, existingUser.id, defenderDetails);
        await this.notifyExistingDefender(existingUser, caseId, complainerName, defenderDetails);
        
        return {
          success: true,
          userId: existingUser.id,
          isNewUser: false,
          message: 'Existing user linked to case'
        };
      }

      // Generate secure temporary password
      const tempPassword = generateRandomPassword(12);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create user account in database
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: defenderDetails.email,
          password: hashedPassword,
          full_name: defenderDetails.name,
          phone: defenderDetails.phone || null,
          role: 'user',
          account_type: 'defender',
          onboarding_case_id: caseId,
          is_verified: false,
          requires_password_change: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        logger.error('Error creating defender user:', userError);
        throw userError;
      }

      logger.info(`Defender account created successfully: ${newUser.id}`);

      // Link defender to case
      await this.linkDefenderToCase(caseId, newUser.id, defenderDetails);

      // Send welcome email with credentials
      const emailResult = await this.sendDefenderWelcomeEmail(
        defenderDetails,
        tempPassword,
        caseId,
        complainerName
      );

      // Send SMS notification if phone number provided
      let smsResult = null;
      if (defenderDetails.phone) {
        smsResult = await SMSService.sendDefenderNotification(
          defenderDetails.phone,
          caseId,
          complainerName
        );
      }

      // Log onboarding event
      await this.logOnboardingEvent(caseId, newUser.id, {
        emailSent: emailResult.success,
        smsSent: smsResult?.success || false
      });

      return {
        success: true,
        userId: newUser.id,
        isNewUser: true,
        credentials: {
          email: defenderDetails.email,
          temporaryPassword: tempPassword
        },
        notifications: {
          email: emailResult,
          sms: smsResult
        },
        message: 'Defender account created and notified successfully'
      };
    } catch (error) {
      logger.error('Error in defender onboarding:', error);
      throw new Error(`Failed to create defender account: ${error.message}`);
    }
  }

  /**
   * Check if user already exists
   * @param {string} email - Email to check
   * @returns {Promise<Object|null>} User object or null
   */
  async checkExistingUser(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, role')
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error checking existing user:', error);
      return null;
    }
  }

  /**
   * Link defender to case
   * @param {string} caseId - Case ID
   * @param {string} userId - User ID
   * @param {Object} defenderDetails - Defender details
   * @returns {Promise<void>}
   */
  async linkDefenderToCase(caseId, userId, defenderDetails) {
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          defender_user_id: userId,
          defender_name: defenderDetails.name,
          defender_email: defenderDetails.email,
          defender_phone: defenderDetails.phone || null,
          defender_address: defenderDetails.address || null,
          defender_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) throw error;

      logger.info(`Defender ${userId} linked to case ${caseId}`);
    } catch (error) {
      logger.error('Error linking defender to case:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new defender
   * @param {Object} defenderDetails - Defender information
   * @param {string} tempPassword - Temporary password
   * @param {string} caseId - Case ID
   * @param {string} complainerName - Complainer's name
   * @returns {Promise<Object>} Email result
   */
  async sendDefenderWelcomeEmail(defenderDetails, tempPassword, caseId, complainerName) {
    try {
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
      const caseUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cases/${caseId}`;

      const emailSubject = '⚖️ Dispute Case Filed Against You - Action Required';
      
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .credentials-box { background: #e0e7ff; border: 2px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .warning { color: #dc2626; font-weight: bold; }
            .info { background: #dbeafe; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ Dispute Case Notification</h1>
              <p style="margin: 0;">AI Dispute Resolution Platform</p>
            </div>
            
            <div class="content">
              <h2>Hello ${defenderDetails.name},</h2>
              
              <div class="alert-box">
                <strong>⚠️ IMPORTANT:</strong> A dispute case has been filed against you by <strong>${complainerName}</strong>.
              </div>
              
              <p>We have automatically created an account for you on our AI Dispute Resolution Platform to facilitate the dispute resolution process.</p>
              
              <div class="credentials-box">
                <h3>🔐 Your Login Credentials</h3>
                <p><strong>Email:</strong> ${defenderDetails.email}</p>
                <p><strong>Temporary Password:</strong> <code style="background: white; padding: 5px 10px; border-radius: 3px; font-size: 14px;">${tempPassword}</code></p>
                <p class="warning">⚠️ Please change this password after your first login</p>
              </div>
              
              <div class="info">
                <h3>📋 Case Information</h3>
                <p><strong>Case ID:</strong> ${caseId}</p>
                <p><strong>Filed By:</strong> ${complainerName}</p>
                <p><strong>Status:</strong> Awaiting Your Response</p>
              </div>
              
              <h3>⏰ Timeline - 48 Hours</h3>
              <p>You have <strong>48 hours</strong> from now to:</p>
              <ul>
                <li>Login to the platform</li>
                <li>Review the case details</li>
                <li>Submit your statements and evidence</li>
                <li>Respond to the complainer's claims</li>
              </ul>
              
              <p><strong>After 48 hours:</strong> Our AI Sheriff will analyze all submissions and provide fair resolution options to both parties.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" class="button">🔓 Login to Your Account</a>
                <br><br>
                <a href="${caseUrl}" class="button" style="background: #10b981;">📁 View Case Details</a>
              </div>
              
              <h3>🤖 What is AI Sheriff?</h3>
              <p>After the 48-hour period, our AI-powered Sheriff will:</p>
              <ol>
                <li>Analyze all statements and evidence from both parties</li>
                <li>Review the complete case context</li>
                <li>Generate 2 fair settlement options</li>
                <li>Help both parties reach a mutually agreeable resolution</li>
              </ol>
              
              <h3>❓ Need Help?</h3>
              <p>If you have any questions or need assistance:</p>
              <ul>
                <li>📧 Email: support@ai-dispute.com</li>
                <li>📞 Phone: +91-XXXX-XXXXXX</li>
                <li>💬 Live Chat: Available on the platform</li>
              </ul>
              
              <div class="alert-box" style="background: #dcfce7; border-color: #10b981;">
                <strong>✅ Your Rights:</strong> You have full rights to present your case, submit evidence, and participate in the resolution process.
              </div>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from AI Dispute Resolution Platform</p>
              <p>Case ID: ${caseId} | Filed on: ${new Date().toLocaleDateString()}</p>
              <p>&copy; 2025 AI Dispute Resolution Platform. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await EmailService.sendEmail(
        defenderDetails.email,
        emailSubject,
        emailBody
      );
    } catch (error) {
      logger.error('Error sending defender welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify existing defender about new case
   * @param {Object} user - Existing user object
   * @param {string} caseId - Case ID
   * @param {string} complainerName - Complainer's name
   * @param {Object} defenderDetails - Additional defender details
   * @returns {Promise<void>}
   */
  async notifyExistingDefender(user, caseId, complainerName, defenderDetails) {
    try {
      const caseUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cases/${caseId}`;

      const emailSubject = '⚖️ New Dispute Case Filed Against You';
      
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ New Case Notification</h1>
            </div>
            
            <div class="content">
              <h2>Hello ${user.full_name},</h2>
              
              <div class="alert-box">
                <strong>⚠️ NOTICE:</strong> A new dispute case has been filed against you by <strong>${complainerName}</strong>.
              </div>
              
              <p>Case ID: <strong>${caseId}</strong></p>
              <p>You have <strong>48 hours</strong> to respond to this case.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${caseUrl}" class="button">📁 View Case & Respond</a>
              </div>
              
              <p>Please login to your account to review the case details and submit your response.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await EmailService.sendEmail(user.email, emailSubject, emailBody);

      if (defenderDetails.phone || user.phone) {
        await SMSService.sendDefenderNotification(
          defenderDetails.phone || user.phone,
          caseId,
          complainerName
        );
      }

      logger.info(`Existing defender ${user.id} notified about case ${caseId}`);
    } catch (error) {
      logger.error('Error notifying existing defender:', error);
    }
  }

  /**
   * Log onboarding event
   * @param {string} caseId - Case ID
   * @param {string} userId - User ID
   * @param {Object} details - Event details
   * @returns {Promise<void>}
   */
  async logOnboardingEvent(caseId, userId, details) {
    try {
      await supabase
        .from('case_timeline')
        .insert({
          case_id: caseId,
          event_type: 'defender_onboarded',
          user_id: userId,
          description: 'Defender account created and notified',
          metadata: details,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging onboarding event:', error);
    }
  }

  /**
   * Resend credentials to defender
   * @param {string} caseId - Case ID
   * @param {string} email - Defender email
   * @returns {Promise<Object>} Result
   */
  async resendCredentials(caseId, email) {
    try {
      // Get user and case details
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Generate new temporary password
      const newTempPassword = generateRandomPassword(12);
      const hashedPassword = await bcrypt.hash(newTempPassword, 10);

      // Update password
      await supabase
        .from('users')
        .update({
          password: hashedPassword,
          requires_password_change: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      // Get case details
      const { data: caseData } = await supabase
        .from('cases')
        .select('*, users!filed_by(full_name)')
        .eq('id', caseId)
        .single();

      // Send new credentials
      await this.sendDefenderWelcomeEmail(
        { name: user.full_name, email: user.email, phone: user.phone },
        newTempPassword,
        caseId,
        caseData.users.full_name
      );

      logger.info(`Credentials resent to defender ${user.id} for case ${caseId}`);

      return {
        success: true,
        message: 'Credentials resent successfully'
      };
    } catch (error) {
      logger.error('Error resending credentials:', error);
      throw error;
    }
  }
}

module.exports = new DefenderOnboardingService();
