/**
 * Case-Related Email Templates and Functions
 * Extension to EmailService for case filing workflow
 */

const EmailService = require('./EmailService');

class CaseEmailService {
  /**
   * Send case filed notification to defendant
   */
  static async sendCaseFiledNotification({ 
    caseId, 
    caseReferenceNumber, 
    caseTitle, 
    plaintiffName, 
    defendantName, 
    defendantEmail,
    responseDeadline
  }) {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupLink = `${appUrl}/auth/signup?case_ref=${encodeURIComponent(caseReferenceNumber)}`;
    const deadlineDate = new Date(responseDeadline);
    const formattedDeadline = deadlineDate.toLocaleString('en-IN', { 
      dateStyle: 'full', 
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });

    const subject = `⚖️ Legal Notice: Case ${caseReferenceNumber} Filed Against You`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Case Filed Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⚖️ Legal Notice</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">AI Dispute Resolver</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                Dear ${defendantName || 'Sir/Madam'},
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; color: #991b1b; font-weight: 600;">
                  ⚠️ A dispute case has been filed against you
                </p>
              </div>
              
              <p style="margin: 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                <strong>${plaintiffName}</strong> has filed a dispute case against you through our AI-powered Dispute Resolution platform.
              </p>
              
              <!-- Case Details Box -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin: 25px 0;">
                <h2 style="margin: 0 0 15px; font-size: 18px; color: #111827;">📋 Case Details</h2>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #6b7280; width: 40%;">Case Reference:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 600;">${caseReferenceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Case Title:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 600;">${caseTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Filed By:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 600;">${plaintiffName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #6b7280; vertical-align: top;">Response Deadline:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #dc2626; font-weight: 700;">${formattedDeadline}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Important Notice -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 10px; font-size: 16px; color: #92400e;">⏰ Important: 48-Hour Response Window</h3>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #78350f;">
                  You have <strong>48 hours</strong> to respond to this case. If you do not create an account and join the case within this timeframe, the matter will be escalated to legal representation.
                </p>
              </div>
              
              <!-- How to Respond -->
              <h2 style="margin: 30px 0 15px; font-size: 18px; color: #111827;">📝 How to Respond</h2>
              <ol style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #374151;">
                <li>Click the button below to create your account on AI Dispute Resolver</li>
                <li>Your account will be automatically linked to this case</li>
                <li>Review the case details and evidence presented</li>
                <li>Submit your statement and supporting evidence within 24 hours of joining</li>
                <li>Our AI will analyze both sides and propose fair resolution options</li>
              </ol>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${signupLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  Create Account & Respond
                </a>
              </div>
              
              <p style="margin: 25px 0 0; font-size: 13px; color: #6b7280; text-align: center;">
                Or copy this link: <a href="${signupLink}" style="color: #667eea; text-decoration: underline;">${signupLink}</a>
              </p>
              
              <!-- Benefits -->
              <div style="margin: 30px 0;">
                <h3 style="margin: 0 0 15px; font-size: 16px; color: #111827;">✨ Why Use AI Dispute Resolver?</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #4b5563;">
                  <li><strong>Fast Resolution:</strong> Most cases resolved within 48-72 hours</li>
                  <li><strong>Cost-Effective:</strong> No expensive legal fees</li>
                  <li><strong>Fair & Unbiased:</strong> AI-powered analysis ensures fairness</li>
                  <li><strong>Legally Binding:</strong> Digital agreements are enforceable</li>
                  <li><strong>Private & Secure:</strong> Your information is protected</li>
                </ul>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 13px; color: #6b7280;">
                This is an automated legal notice from AI Dispute Resolver
              </p>
              <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                © ${new Date().getFullYear()} AI Dispute Resolver. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await EmailService.sendEmail({
      to: defendantEmail,
      subject,
      html
    });
  }

  /**
   * Send 48-hour reminder notification
   */
  static async sendResponseReminderNotification({
    caseReferenceNumber,
    caseTitle,
    defendantName,
    defendantEmail,
    hoursRemaining
  }) {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const signupLink = `${appUrl}/auth/signup?case_ref=${encodeURIComponent(caseReferenceNumber)}`;

    const subject = `⏰ Urgent: ${hoursRemaining} Hours Remaining - Case ${caseReferenceNumber}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px;">
          
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⏰ Urgent Reminder</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">Dear ${defendantName || 'Sir/Madam'},</p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 10px; font-size: 20px; color: #991b1b;">⚠️ Only ${hoursRemaining} Hours Remaining!</h2>
                <p style="margin: 0; font-size: 15px; color: #7f1d1d;">
                  Your response deadline for case <strong>${caseReferenceNumber}</strong> is approaching.
                </p>
              </div>
              
              <p style="margin: 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                You have not yet responded to the dispute case filed against you. If you do not create an account and respond within the next <strong>${hoursRemaining} hours</strong>, this matter will be escalated to legal representation, which may result in additional costs and complications.
              </p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${signupLink}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Respond Now
                </a>
              </div>
              
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">© ${new Date().getFullYear()} AI Dispute Resolver</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await EmailService.sendEmail({
      to: defendantEmail,
      subject,
      html
    });
  }

  /**
   * Send defendant joined notification to plaintiff
   */
  static async sendDefendantJoinedNotification({
    caseReferenceNumber,
    caseTitle,
    plaintiffName,
    plaintiffEmail,
    defendantName
  }) {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const caseUrl = `${appUrl}/cases/${caseReferenceNumber}`;

    const subject = `✅ Case ${caseReferenceNumber}: Defendant Has Joined`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px;">
          
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✅ Good News!</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">Dear ${plaintiffName || 'Sir/Madam'},</p>
              
              <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; color: #065f46; font-weight: 600;">
                  <strong>${defendantName}</strong> has created an account and joined your case.
                </p>
              </div>
              
              <p style="margin: 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                The case <strong>${caseReferenceNumber}</strong> is now ACTIVE. Both parties now have 24 hours to submit their final statements and evidence.
              </p>
              
              <div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 6px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 10px; font-size: 16px; color: #1e40af;">📝 Next Steps:</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #1e3a8a;">
                  <li>Review and update your statement if needed</li>
                  <li>Upload any additional evidence</li>
                  <li>Submit everything within 24 hours</li>
                  <li>AI will analyze and propose resolution options</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${caseUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View Case
                </a>
              </div>
              
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">© ${new Date().getFullYear()} AI Dispute Resolver</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await EmailService.sendEmail({
      to: plaintiffEmail,
      subject,
      html
    });
  }

  /**
   * Send welcome email to new user (with or without case)
   */
  static async sendWelcomeEmail({ userName, userEmail, caseReference = null }) {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const subject = caseReference 
      ? `Welcome to AI Dispute Resolver - Case ${caseReference}`
      : 'Welcome to AI Dispute Resolver';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px;">
          
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">👋 Welcome!</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #374151;">Dear ${userName},</p>
              
              <p style="margin: 20px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                Welcome to <strong>AI Dispute Resolver</strong>! Your account has been successfully created.
              </p>
              
              ${caseReference ? `
              <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; color: #065f46;">
                  ✅ Your account has been linked to case <strong>${caseReference}</strong>
                </p>
              </div>
              ` : ''}
              
              <h2 style="margin: 30px 0 15px; font-size: 18px; color: #111827;">🚀 What's Next?</h2>
              <ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #374151;">
                ${caseReference ? `
                <li>Review the case details and evidence</li>
                <li>Submit your statement and supporting documents</li>
                <li>Respond within the given timeframe</li>
                ` : `
                <li>Complete your profile</li>
                <li>Explore the platform features</li>
                <li>File a case or manage existing cases</li>
                `}
              </ul>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${appUrl}${caseReference ? `/cases/${caseReference}` : '/dashboard'}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  ${caseReference ? 'View Your Case' : 'Go to Dashboard'}
                </a>
              </div>
              
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">© ${new Date().getFullYear()} AI Dispute Resolver</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await EmailService.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  /**
   * Send defendant joined notification to plaintiff
   */
  static async sendDefendantJoinedNotification({
    caseId,
    caseReferenceNumber,
    plaintiffName,
    plaintiffEmail,
    defendantName,
    submissionDeadline
  }) {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const caseLink = `${appUrl}/cases/${caseId}`;
    const deadlineDate = new Date(submissionDeadline);
    const formattedDeadline = deadlineDate.toLocaleString('en-IN', { 
      dateStyle: 'full', 
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });

    const subject = `✅ ${defendantName} has joined case ${caseReferenceNumber}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Defendant Joined Case</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✅ Defendant Joined</h1>
              <p style="margin: 10px 0 0 0; color: #d1fae5; font-size: 16px;">Case ${caseReferenceNumber}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937;">Dear ${plaintiffName},</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Great news! <strong>${defendantName}</strong> has joined your case and is now able to respond and submit evidence.
              </p>

              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #059669; font-size: 18px; font-weight: 600;">📋 Next Steps</h3>
                <ul style="margin: 0; padding-left: 20px; color: #065f46;">
                  <li style="margin-bottom: 8px;">Both parties can now submit evidence and statements</li>
                  <li style="margin-bottom: 8px;">The evidence submission period is now active</li>
                  <li style="margin-bottom: 8px;">All submissions must be completed by the deadline</li>
                  <li>After the deadline, AI analysis will begin automatically</li>
                </ul>
              </div>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px; font-weight: 600;">⏰ Evidence Submission Deadline</h4>
                    <p style="margin: 0; font-size: 18px; color: #78350f; font-weight: 700;">${formattedDeadline}</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #92400e;">All evidence must be submitted before this time</p>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${caseLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View Case Details
                </a>
              </div>

              <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #1e40af; font-weight: 600;">💡 Tip:</p>
                <p style="margin: 0; font-size: 14px; color: #1e3a8a; line-height: 1.6;">
                  Organize your evidence well and provide clear explanations. Strong documentation increases your chances of a favorable resolution.
                </p>
              </div>

              <p style="margin: 30px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                If you have any questions, please don't hesitate to contact our support team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">AI Dispute Resolver</p>
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #9ca3af;">Fast, Fair, AI-Powered Dispute Resolution</p>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">© ${new Date().getFullYear()} AI Dispute Resolver</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await EmailService.sendEmail({
      to: plaintiffEmail,
      subject,
      html
    });
  }
}

module.exports = CaseEmailService;
