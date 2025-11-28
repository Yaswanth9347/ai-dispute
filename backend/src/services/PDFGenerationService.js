// PDF Generation Service - Professional document generation with templates
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');

class PDFGenerationService {
  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates');
    this.outputDir = path.join(__dirname, '../../storage/documents');
    this.assetsDir = path.join(__dirname, '../../assets');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.templatesDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
      await fs.mkdir(this.assetsDir, { recursive: true });
      logger.info('PDF Generation service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PDF Generation service:', error);
    }
  }

  // Generate settlement agreement PDF
  async generateSettlementAgreement(caseData, settlementDetails, parties) {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margin: 50,
        info: {
          Title: `Settlement Agreement - Case ${caseData.id}`,
          Author: 'AI Dispute Resolution Platform',
          Subject: 'Legal Settlement Agreement',
          Creator: 'Legal Tech Solutions'
        }
      });

      const filename = `settlement_agreement_${caseData.id}_${Date.now()}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      
      // Pipe PDF to file
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header with logo and title
      await this.addHeader(doc, 'SETTLEMENT AGREEMENT');
      
      // Case information section
      doc.fontSize(12).text('Case Information', 50, 150, { underline: true });
      doc.moveDown();
      doc.fontSize(10)
         .text(`Case ID: ${caseData.id}`)
         .text(`Case Title: ${caseData.title}`)
         .text(`Case Type: ${caseData.case_type?.toUpperCase() || 'GENERAL'}`)
         .text(`Agreement Date: ${new Date().toLocaleDateString()}`)
         .moveDown(2);

      // Parties section
      doc.fontSize(12).text('Parties to the Agreement', { underline: true });
      doc.moveDown();
      
      parties.forEach((party, index) => {
        doc.fontSize(10)
           .text(`${index + 1}. ${party.role.toUpperCase()}: ${party.name}`)
           .text(`   Email: ${party.email}`)
           .text(`   Phone: ${party.phone || 'Not provided'}`)
           .moveDown();
      });
      
      doc.moveDown();

      // Settlement terms section
      doc.fontSize(12).text('Settlement Terms and Conditions', { underline: true });
      doc.moveDown();
      
      if (settlementDetails.terms && Array.isArray(settlementDetails.terms)) {
        settlementDetails.terms.forEach((term, index) => {
          doc.fontSize(10)
             .text(`${index + 1}. ${term}`, { 
               align: 'justify',
               lineGap: 2
             })
             .moveDown();
        });
      }

      // Financial terms if applicable
      if (settlementDetails.financial) {
        doc.addPage();
        doc.fontSize(12).text('Financial Terms', { underline: true });
        doc.moveDown();
        
        const financial = settlementDetails.financial;
        if (financial.compensation) {
          doc.fontSize(10)
             .text(`Total Compensation: ₹${financial.compensation.toLocaleString()}`)
             .text(`Payment Method: ${financial.paymentMethod || 'Bank Transfer'}`)
             .text(`Payment Schedule: ${financial.schedule || 'Lump sum within 30 days'}`)
             .moveDown();
        }
      }

      // Legal clauses
      doc.addPage();
      await this.addLegalClauses(doc);

      // Signature section
      doc.addPage();
      await this.addSignatureSection(doc, parties);

      // Footer
      await this.addFooter(doc);

      doc.end();

      // Wait for file to be written
      await new Promise((resolve) => {
        stream.on('finish', resolve);
      });

      return {
        filename,
        filepath,
        size: (await fs.stat(filepath)).size,
        type: 'settlement_agreement',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating settlement agreement:', error);
      throw new Error('Failed to generate settlement agreement PDF');
    }
  }

  // Generate case summary report
  async generateCaseSummaryReport(caseData, analysis, timeline) {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const filename = `case_summary_${caseData.id}_${Date.now()}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      await this.addHeader(doc, 'CASE SUMMARY REPORT');
      
      // Case overview
      doc.fontSize(12).text('Case Overview', 50, 150, { underline: true });
      doc.moveDown();
      doc.fontSize(10)
         .text(`Case ID: ${caseData.id}`)
         .text(`Title: ${caseData.title}`)
         .text(`Type: ${caseData.case_type}`)
         .text(`Status: ${caseData.status}`)
         .text(`Filed Date: ${new Date(caseData.created_at).toLocaleDateString()}`)
         .text(`Last Updated: ${new Date(caseData.updated_at).toLocaleDateString()}`)
         .moveDown(2);

      // Case description
      doc.fontSize(12).text('Case Description', { underline: true });
      doc.moveDown();
      doc.fontSize(10).text(caseData.description || 'No description provided', {
        align: 'justify',
        lineGap: 2
      }).moveDown(2);

      // AI Analysis section if available
      if (analysis) {
        doc.addPage();
        doc.fontSize(12).text('AI Analysis Summary', { underline: true });
        doc.moveDown();
        
        if (analysis.summary) {
          doc.fontSize(10).text('Summary:', { underline: true });
          doc.text(analysis.summary, { align: 'justify', lineGap: 2 });
          doc.moveDown();
        }
        
        if (analysis.legal_issues && analysis.legal_issues.length > 0) {
          doc.text('Key Legal Issues:', { underline: true });
          analysis.legal_issues.forEach((issue, index) => {
            doc.text(`${index + 1}. ${issue}`);
          });
          doc.moveDown();
        }
        
        if (analysis.recommendations && analysis.recommendations.length > 0) {
          doc.text('AI Recommendations:', { underline: true });
          analysis.recommendations.forEach((rec, index) => {
            doc.text(`${index + 1}. ${rec}`);
          });
          doc.moveDown();
        }
      }

      // Timeline section
      if (timeline && timeline.length > 0) {
        doc.addPage();
        doc.fontSize(12).text('Case Timeline', { underline: true });
        doc.moveDown();
        
        timeline.forEach((event, index) => {
          doc.fontSize(10)
             .text(`${new Date(event.timestamp).toLocaleDateString()} - ${event.event_type}:`)
             .text(`   ${event.description}`, { indent: 20 })
             .moveDown();
        });
      }

      await this.addFooter(doc);
      doc.end();

      await new Promise((resolve) => {
        stream.on('finish', resolve);
      });

      return {
        filename,
        filepath,
        size: (await fs.stat(filepath)).size,
        type: 'case_summary',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating case summary:', error);
      throw new Error('Failed to generate case summary PDF');
    }
  }

  // Generate court referral document
  async generateCourtReferralDocument(caseData, referralReason, attempts) {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const filename = `court_referral_${caseData.id}_${Date.now()}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      await this.addHeader(doc, 'COURT REFERRAL DOCUMENT');
      
      // Referral information
      doc.fontSize(12).text('Referral Information', 50, 150, { underline: true });
      doc.moveDown();
      doc.fontSize(10)
         .text(`Case ID: ${caseData.id}`)
         .text(`Case Title: ${caseData.title}`)
         .text(`Referral Date: ${new Date().toLocaleDateString()}`)
         .text(`Reason for Referral: ${referralReason}`)
         .moveDown(2);

      // Settlement attempts
      doc.fontSize(12).text('Settlement Attempts Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(10)
         .text(`Total Attempts: ${attempts.length}`)
         .text(`Platform Resolution Failed: Yes`)
         .moveDown();

      attempts.forEach((attempt, index) => {
        doc.text(`${index + 1}. ${new Date(attempt.date).toLocaleDateString()} - ${attempt.method}:`)
           .text(`   Outcome: ${attempt.outcome}`, { indent: 20 })
           .moveDown();
      });

      // Recommendation
      doc.addPage();
      doc.fontSize(12).text('Platform Recommendation', { underline: true });
      doc.moveDown();
      doc.fontSize(10).text(
        'Based on the unsuccessful resolution attempts through our AI-powered dispute resolution platform, ' +
        'we recommend that this case be referred to the appropriate court for judicial determination. ' +
        'All relevant documentation and evidence are attached for court review.',
        { align: 'justify', lineGap: 3 }
      );

      await this.addFooter(doc);
      doc.end();

      await new Promise((resolve) => {
        stream.on('finish', resolve);
      });

      return {
        filename,
        filepath,
        size: (await fs.stat(filepath)).size,
        type: 'court_referral',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating court referral document:', error);
      throw new Error('Failed to generate court referral document');
    }
  }

  // Generate HTML to PDF using Puppeteer
  async generateFromHTML(htmlContent, options = {}) {
    let browser;
    try {
      browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const filename = `html_document_${Date.now()}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        ...options
      });

      return {
        filename,
        filepath,
        size: (await fs.stat(filepath)).size,
        type: 'html_conversion',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating PDF from HTML:', error);
      throw new Error('Failed to generate PDF from HTML');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Helper method to add professional header
  async addHeader(doc, title) {
    doc.fontSize(20)
       .text('AI DISPUTE RESOLUTION PLATFORM', 50, 50, { align: 'center' })
       .fontSize(16)
       .text(title, 50, 80, { align: 'center' })
       .moveTo(50, 100)
       .lineTo(550, 100)
       .stroke();
    
    return doc;
  }

  // Helper method to add legal clauses
  async addLegalClauses(doc) {
    doc.fontSize(12).text('Legal Clauses and Conditions', { underline: true });
    doc.moveDown();
    
    const clauses = [
      'This settlement agreement is binding upon all parties and their heirs, successors, and assigns.',
      'This agreement represents the full and complete understanding between the parties.',
      'Any modifications to this agreement must be made in writing and signed by all parties.',
      'This agreement shall be governed by the laws of India.',
      'If any provision of this agreement is found to be unenforceable, the remainder shall remain in effect.',
      'The parties acknowledge that they have read and understood this agreement and enter into it voluntarily.'
    ];

    clauses.forEach((clause, index) => {
      doc.fontSize(10)
         .text(`${index + 1}. ${clause}`, { 
           align: 'justify',
           lineGap: 2
         })
         .moveDown();
    });

    return doc;
  }

  // Helper method to add signature section
  async addSignatureSection(doc, parties) {
    doc.fontSize(12).text('Signatures', { underline: true });
    doc.moveDown(2);
    
    parties.forEach((party, index) => {
      const yPosition = doc.y + (index * 100);
      
      doc.fontSize(10)
         .text(`${party.role.toUpperCase()}: ${party.name}`, 50, yPosition)
         .text('Date: _______________', 50, yPosition + 20)
         .text('Signature: ___________________________', 50, yPosition + 40)
         .text('(Digital signature will be applied here)', 50, yPosition + 60, { 
           fontSize: 8, 
           fillColor: 'gray' 
         });
    });

    return doc;
  }

  // Helper method to add footer
  async addFooter(doc) {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      doc.fontSize(8)
         .text(
           `Generated by AI Dispute Resolution Platform - ${new Date().toLocaleDateString()}`,
           50,
           doc.page.height - 50,
           { align: 'center' }
         )
         .text(
           `Page ${i + 1} of ${pages.count}`,
           doc.page.width - 100,
           doc.page.height - 30
         );
    }
    
    return doc;
  }

  // Batch generate multiple documents
  async batchGenerate(requests) {
    try {
      const results = await Promise.allSettled(
        requests.map(async (request) => {
          switch (request.type) {
            case 'settlement':
              return await this.generateSettlementAgreement(
                request.caseData,
                request.settlementDetails,
                request.parties
              );
            case 'summary':
              return await this.generateCaseSummaryReport(
                request.caseData,
                request.analysis,
                request.timeline
              );
            case 'court_referral':
              return await this.generateCourtReferralDocument(
                request.caseData,
                request.referralReason,
                request.attempts
              );
            default:
              throw new Error(`Unknown document type: ${request.type}`);
          }
        })
      );

      return {
        total: requests.length,
        successful: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
      };
    } catch (error) {
      logger.error('Error in batch document generation:', error);
      throw new Error('Batch generation failed');
    }
  }
}

module.exports = new PDFGenerationService();