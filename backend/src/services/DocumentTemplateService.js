// Document Template System - Dynamic template management and rendering
const fs = require('fs').promises;
const path = require('path');
const logger = require('../lib/logger');

class DocumentTemplateService {
  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.templatesDir, { recursive: true });
      await this.createDefaultTemplates();
      logger.info('Document Template service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Document Template service:', error);
    }
  }

  // Create default HTML templates
  async createDefaultTemplates() {
    const templates = {
      'settlement-agreement.html': this.getSettlementAgreementTemplate(),
      'case-summary.html': this.getCaseSummaryTemplate(),
      'court-referral.html': this.getCourtReferralTemplate(),
      'email-notification.html': this.getEmailNotificationTemplate(),
      'signature-request.html': this.getSignatureRequestTemplate()
    };

    for (const [filename, content] of Object.entries(templates)) {
      const filepath = path.join(this.templatesDir, filename);
      try {
        await fs.access(filepath);
      } catch {
        await fs.writeFile(filepath, content);
        logger.info(`Created template: ${filename}`);
      }
    }
  }

  // Render template with dynamic data
  async renderTemplate(templateName, data) {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`);
      let template = await fs.readFile(templatePath, 'utf8');

      // Replace placeholders with actual data
      template = this.replacePlaceholders(template, data);

      return {
        html: template,
        templateName,
        renderedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error rendering template ${templateName}:`, error);
      throw new Error(`Failed to render template: ${templateName}`);
    }
  }

  // Replace template placeholders with data
  replacePlaceholders(template, data) {
    return template.replace(/{{([^}]+)}}/g, (match, key) => {
      const keys = key.trim().split('.');
      let value = data;
      
      for (const k of keys) {
        value = value?.[k];
      }
      
      if (value === null || value === undefined) {
        return match; // Keep placeholder if value not found
      }
      
      // Handle arrays and objects
      if (Array.isArray(value)) {
        return value.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ');
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      
      return String(value);
    });
  }

  // Settlement Agreement Template
  getSettlementAgreementTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settlement Agreement - Case {{case.id}}</title>
    <style>
        body { font-family: 'Times New Roman', serif; margin: 0; padding: 20px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { font-size: 24px; margin: 0; }
        .header h2 { font-size: 20px; margin: 10px 0 0 0; }
        .section { margin: 20px 0; }
        .section h3 { font-size: 16px; text-decoration: underline; margin-bottom: 10px; }
        .parties { margin: 20px 0; }
        .party { margin: 10px 0; }
        .terms { margin: 20px 0; }
        .term { margin: 15px 0; text-align: justify; }
        .signature-section { margin-top: 50px; }
        .signature-block { margin: 30px 0; }
        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
        .financial-terms { background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd; }
        .legal-clauses { font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI DISPUTE RESOLUTION PLATFORM</h1>
        <h2>SETTLEMENT AGREEMENT</h2>
    </div>

    <div class="section">
        <h3>Case Information</h3>
        <p><strong>Case ID:</strong> {{case.id}}</p>
        <p><strong>Case Title:</strong> {{case.title}}</p>
        <p><strong>Case Type:</strong> {{case.case_type}}</p>
        <p><strong>Agreement Date:</strong> {{agreement.date}}</p>
        <p><strong>Settlement Amount:</strong> {{settlement.amount}}</p>
    </div>

    <div class="section parties">
        <h3>Parties to the Agreement</h3>
        {{#each parties}}
        <div class="party">
            <p><strong>{{@index}}. {{role}}:</strong> {{name}}</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Email:</strong> {{email}}</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Phone:</strong> {{phone}}</p>
        </div>
        {{/each}}
    </div>

    <div class="section terms">
        <h3>Settlement Terms and Conditions</h3>
        {{#each settlement.terms}}
        <div class="term">
            <p>{{@index}}. {{this}}</p>
        </div>
        {{/each}}
    </div>

    {{#if settlement.financial}}
    <div class="section financial-terms">
        <h3>Financial Terms</h3>
        <p><strong>Total Compensation:</strong> ₹{{settlement.financial.amount}}</p>
        <p><strong>Payment Method:</strong> {{settlement.financial.method}}</p>
        <p><strong>Payment Schedule:</strong> {{settlement.financial.schedule}}</p>
    </div>
    {{/if}}

    <div class="section legal-clauses">
        <h3>Legal Clauses and Conditions</h3>
        <div class="term">1. This settlement agreement is binding upon all parties and their heirs, successors, and assigns.</div>
        <div class="term">2. This agreement represents the full and complete understanding between the parties.</div>
        <div class="term">3. Any modifications to this agreement must be made in writing and signed by all parties.</div>
        <div class="term">4. This agreement shall be governed by the laws of India.</div>
        <div class="term">5. If any provision of this agreement is found to be unenforceable, the remainder shall remain in effect.</div>
        <div class="term">6. The parties acknowledge that they have read and understood this agreement and enter into it voluntarily.</div>
    </div>

    <div class="signature-section">
        <h3>Digital Signatures</h3>
        {{#each parties}}
        <div class="signature-block">
            <p><strong>{{role}}:</strong> {{name}}</p>
            <p>Date: ________________</p>
            <p>Digital Signature: ___________________________</p>
            <p><em style="color: #666; font-size: 10px;">(Digital signature applied electronically)</em></p>
        </div>
        {{/each}}
    </div>

    <div class="footer">
        <p>Generated by AI Dispute Resolution Platform - {{generated.date}}</p>
        <p>This document is digitally signed and legally binding under Indian law</p>
    </div>
</body>
</html>`;
  }

  // Case Summary Template
  getCaseSummaryTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Case Summary Report - {{case.id}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin: 25px 0; }
        .section h3 { font-size: 16px; color: #2c5282; text-decoration: underline; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .info-item { margin: 8px 0; }
        .ai-analysis { background-color: #f0f8ff; padding: 20px; border-left: 4px solid #2c5282; }
        .timeline { background-color: #f9f9f9; padding: 15px; }
        .timeline-item { margin: 15px 0; padding: 10px; border-left: 3px solid #38a169; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .status-active { background-color: #48bb78; color: white; }
        .status-pending { background-color: #ed8936; color: white; }
        .status-closed { background-color: #718096; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI DISPUTE RESOLUTION PLATFORM</h1>
        <h2>CASE SUMMARY REPORT</h2>
    </div>

    <div class="section">
        <h3>Case Overview</h3>
        <div class="info-grid">
            <div>
                <div class="info-item"><strong>Case ID:</strong> {{case.id}}</div>
                <div class="info-item"><strong>Title:</strong> {{case.title}}</div>
                <div class="info-item"><strong>Type:</strong> {{case.case_type}}</div>
                <div class="info-item"><strong>Filed Date:</strong> {{case.filed_date}}</div>
            </div>
            <div>
                <div class="info-item"><strong>Status:</strong> <span class="status-badge status-{{case.status}}">{{case.status}}</span></div>
                <div class="info-item"><strong>Last Updated:</strong> {{case.updated_date}}</div>
                <div class="info-item"><strong>Priority:</strong> {{case.priority}}</div>
                <div class="info-item"><strong>Estimated Value:</strong> ₹{{case.estimated_value}}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h3>Case Description</h3>
        <p style="text-align: justify;">{{case.description}}</p>
    </div>

    {{#if analysis}}
    <div class="section ai-analysis">
        <h3>AI Analysis Summary</h3>
        <div class="info-item"><strong>Analysis Date:</strong> {{analysis.date}}</div>
        <div class="info-item"><strong>Confidence Score:</strong> {{analysis.confidence}}%</div>
        
        <h4>Summary:</h4>
        <p style="text-align: justify;">{{analysis.summary}}</p>
        
        <h4>Key Legal Issues:</h4>
        <ul>
            {{#each analysis.legal_issues}}
            <li>{{this}}</li>
            {{/each}}
        </ul>
        
        <h4>AI Recommendations:</h4>
        <ul>
            {{#each analysis.recommendations}}
            <li>{{this}}</li>
            {{/each}}
        </ul>
    </div>
    {{/if}}

    {{#if timeline}}
    <div class="section">
        <h3>Case Timeline</h3>
        <div class="timeline">
            {{#each timeline}}
            <div class="timeline-item">
                <strong>{{date}}</strong> - {{event_type}}<br>
                <span style="color: #666;">{{description}}</span>
            </div>
            {{/each}}
        </div>
    </div>
    {{/if}}

    <div class="footer">
        <p>Generated by AI Dispute Resolution Platform - {{generated.date}}</p>
        <p>This report contains confidential information and is intended for authorized parties only</p>
    </div>
</body>
</html>`;
  }

  // Court Referral Template
  getCourtReferralTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Court Referral Document - {{case.id}}</title>
    <style>
        body { font-family: 'Times New Roman', serif; margin: 0; padding: 20px; line-height: 1.8; }
        .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin: 30px 0; }
        .section h3 { font-size: 16px; text-decoration: underline; margin-bottom: 15px; }
        .referral-info { background-color: #fff8dc; padding: 20px; border: 2px solid #daa520; }
        .attempts-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .attempts-table th, .attempts-table td { border: 1px solid #000; padding: 10px; text-align: left; }
        .attempts-table th { background-color: #f0f0f0; font-weight: bold; }
        .recommendation { background-color: #f0f8ff; padding: 20px; border: 1px solid #4169e1; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI DISPUTE RESOLUTION PLATFORM</h1>
        <h2>COURT REFERRAL DOCUMENT</h2>
        <p><strong>OFFICIAL REFERRAL FOR JUDICIAL REVIEW</strong></p>
    </div>

    <div class="section referral-info">
        <h3>Referral Information</h3>
        <p><strong>Case ID:</strong> {{case.id}}</p>
        <p><strong>Case Title:</strong> {{case.title}}</p>
        <p><strong>Case Type:</strong> {{case.case_type}}</p>
        <p><strong>Referral Date:</strong> {{referral.date}}</p>
        <p><strong>Reason for Referral:</strong> {{referral.reason}}</p>
        <p><strong>Referring Authority:</strong> AI Dispute Resolution Platform</p>
    </div>

    <div class="section">
        <h3>Settlement Attempts Summary</h3>
        <p><strong>Total Resolution Attempts:</strong> {{attempts.count}}</p>
        <p><strong>Platform Resolution Status:</strong> Failed</p>
        <p><strong>Duration of Resolution Process:</strong> {{attempts.duration}} days</p>
        
        <table class="attempts-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Outcome</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                {{#each attempts.list}}
                <tr>
                    <td>{{date}}</td>
                    <td>{{method}}</td>
                    <td>{{outcome}}</td>
                    <td>{{notes}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h3>Parties Information</h3>
        {{#each parties}}
        <p><strong>{{role}}:</strong></p>
        <p>&nbsp;&nbsp;&nbsp;&nbsp;Name: {{name}}</p>
        <p>&nbsp;&nbsp;&nbsp;&nbsp;Email: {{email}}</p>
        <p>&nbsp;&nbsp;&nbsp;&nbsp;Phone: {{phone}}</p>
        <p>&nbsp;&nbsp;&nbsp;&nbsp;Address: {{address}}</p>
        <br>
        {{/each}}
    </div>

    <div class="section recommendation">
        <h3>Platform Recommendation</h3>
        <p style="text-align: justify;">
            Based on the comprehensive analysis and multiple unsuccessful resolution attempts through our 
            AI-powered dispute resolution platform, we formally recommend that this case be referred to 
            the appropriate judicial court for legal determination.
        </p>
        <p style="text-align: justify;">
            Our platform has exhausted all available alternative dispute resolution mechanisms including 
            AI-mediated negotiations, automated settlement proposals, and structured communication facilitation. 
            The complexity and nature of the dispute require judicial intervention for proper resolution.
        </p>
        <p style="text-align: justify;">
            All relevant documentation, evidence, communication records, and analysis reports are attached 
            herewith for the court's review and consideration.
        </p>
    </div>

    <div class="section">
        <h3>Attached Documents</h3>
        <ul>
            <li>Complete Case File and Documentation</li>
            <li>AI Analysis and Recommendations Report</li>
            <li>Communication History Between Parties</li>
            <li>Evidence and Supporting Documents</li>
            <li>Settlement Attempt Records</li>
            <li>Platform Activity Timeline</li>
        </ul>
    </div>

    <div class="footer">
        <p><strong>AI Dispute Resolution Platform</strong></p>
        <p>Authorized Legal Technology Service Provider</p>
        <p>Generated on: {{generated.date}} | Document ID: {{document.id}}</p>
        <p>This document is digitally signed and authenticated</p>
    </div>
</body>
</html>`;
  }

  // Email Notification Template
  getEmailNotificationTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{notification.title}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        .case-info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .urgent { border-left: 4px solid #e74c3c; }
        .info { border-left: 4px solid #3498db; }
        .success { border-left: 4px solid #27ae60; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AI Dispute Resolution Platform</h1>
            <p>{{notification.title}}</p>
        </div>
        
        <div class="content">
            <p>Dear {{user.name}},</p>
            
            <p>{{notification.message}}</p>
            
            {{#if case}}
            <div class="case-info {{notification.type}}">
                <h3>Case Information</h3>
                <p><strong>Case ID:</strong> {{case.id}}</p>
                <p><strong>Title:</strong> {{case.title}}</p>
                <p><strong>Status:</strong> {{case.status}}</p>
                <p><strong>Last Updated:</strong> {{case.updated}}</p>
            </div>
            {{/if}}
            
            {{#if notification.action_url}}
            <p style="text-align: center;">
                <a href="{{notification.action_url}}" class="button">{{notification.action_text}}</a>
            </p>
            {{/if}}
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br>
            The AI Dispute Resolution Team</p>
        </div>
        
        <div class="footer">
            <p>© 2025 AI Dispute Resolution Platform. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>Generated on: {{generated.timestamp}}</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Signature Request Template
  getSignatureRequestTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Signature Request</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #667eea; }
        .signature-section { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px dashed #667eea; }
        .document-preview { background-color: #fff; border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .action-buttons { text-align: center; margin: 30px 0; }
        .btn-sign { background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px; display: inline-block; }
        .btn-view { background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px; display: inline-block; }
        .security-info { background-color: #fff8dc; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f39c12; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Digital Signature Request</h1>
            <p>Your signature is required for the following document</p>
        </div>
        
        <div class="content">
            <p>Dear {{recipient.name}},</p>
            
            <p>A document has been prepared and requires your digital signature to proceed. Please review the document carefully before signing.</p>
            
            <div class="document-preview">
                <h3>{{document.title}}</h3>
                <p><strong>Document Type:</strong> {{document.type}}</p>
                <p><strong>Case ID:</strong> {{case.id}}</p>
                <p><strong>Prepared On:</strong> {{document.created}}</p>
                <p><strong>Deadline for Signature:</strong> {{signature.deadline}}</p>
            </div>
            
            <div class="signature-section">
                <h3>Signature Required</h3>
                <p><strong>Your Role:</strong> {{recipient.role}}</p>
                <p><strong>Signature Type:</strong> Digital Certificate</p>
                <p><strong>Legal Binding:</strong> Yes, under Indian IT Act 2000</p>
                <p><strong>Security Level:</strong> 2048-bit RSA Encryption</p>
            </div>
            
            <div class="action-buttons">
                <a href="{{urls.view_document}}" class="btn-view">View Document</a>
                <a href="{{urls.sign_document}}" class="btn-sign">Sign Document</a>
            </div>
            
            <div class="security-info">
                <h4>Security Information</h4>
                <p>• Your signature will be cryptographically secured</p>
                <p>• Document integrity is guaranteed through blockchain technology</p>
                <p>• All signatures are legally binding under Indian law</p>
                <p>• Full audit trail maintained for compliance</p>
            </div>
            
            <p><strong>Important:</strong> Please sign the document before {{signature.deadline}} to avoid delays in the dispute resolution process.</p>
            
            <p>If you have any questions about this document or the signing process, please contact our support team immediately.</p>
            
            <p>Best regards,<br>
            The AI Dispute Resolution Team</p>
        </div>
        
        <div class="footer">
            <p>© 2025 AI Dispute Resolution Platform. All rights reserved.</p>
            <p>This signature request was generated automatically - Request ID: {{request.id}}</p>
            <p>For support, email: support@aidispute.com or call: +91-1800-XXX-XXXX</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Create custom template
  async createTemplate(name, htmlContent) {
    try {
      const filepath = path.join(this.templatesDir, `${name}.html`);
      await fs.writeFile(filepath, htmlContent);
      
      return {
        templateName: name,
        filepath,
        created: true,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error creating template ${name}:`, error);
      throw new Error(`Failed to create template: ${name}`);
    }
  }

  // List all templates
  async listTemplates() {
    try {
      const files = await fs.readdir(this.templatesDir);
      const templates = files
        .filter(file => file.endsWith('.html'))
        .map(file => ({
          name: path.basename(file, '.html'),
          filename: file,
          path: path.join(this.templatesDir, file)
        }));

      return templates;
    } catch (error) {
      logger.error('Error listing templates:', error);
      throw new Error('Failed to list templates');
    }
  }

  // Delete template
  async deleteTemplate(templateName) {
    try {
      const filepath = path.join(this.templatesDir, `${templateName}.html`);
      await fs.unlink(filepath);
      
      return {
        templateName,
        deleted: true,
        deletedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error deleting template ${templateName}:`, error);
      throw new Error(`Failed to delete template: ${templateName}`);
    }
  }

  // Validate template syntax
  validateTemplate(htmlContent) {
    const errors = [];
    
    // Check for unclosed placeholders
    const unclosedPlaceholders = htmlContent.match(/{{[^}]*$/gm);
    if (unclosedPlaceholders) {
      errors.push('Unclosed template placeholders found');
    }
    
    // Check for unmatched braces
    const openBraces = (htmlContent.match(/{{/g) || []).length;
    const closeBraces = (htmlContent.match(/}}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unmatched template braces');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new DocumentTemplateService();