// Settlement Document Generator Service
const { supabase } = require('../lib/supabaseClient');
const { logger } = require('../lib/logger');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class SettlementDocumentService {
  // Generate settlement agreement document
  async generateSettlementDocument(caseId, optionId, userId) {
    try {
      logger.info(`Generating settlement document for case ${caseId}`);

      // Get case details
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (caseError || !caseData) {
        throw new Error('Case not found');
      }

      // Get settlement option
      const { data: option, error: optError } = await supabase
        .from('settlement_options')
        .select('*')
        .eq('id', optionId)
        .single();

      if (optError || !option) {
        throw new Error('Settlement option not found');
      }

      // Get parties
      const { data: parties } = await supabase
        .from('case_parties')
        .select(`
          *,
          users!inner(id, full_name, email)
        `)
        .eq('case_id', caseId);

      if (!parties || parties.length < 2) {
        throw new Error('Need at least 2 parties for settlement document');
      }

      const complainant = parties.find(p => p.role === 'claimant') || parties[0];
      const respondent = parties.find(p => p.role === 'respondent') || parties[1];

      // Parse JSON fields
      const legalBasis = JSON.parse(option.legal_basis || '{}');
      const conditions = JSON.parse(option.conditions || '[]');
      const nonMonetaryTerms = JSON.parse(option.non_monetary_terms || '[]');

      // Build document content
      const documentContent = this.buildDocumentContent({
        caseData,
        option,
        complainant,
        respondent,
        legalBasis,
        conditions,
        nonMonetaryTerms
      });

      // Generate PDF
      const pdfPath = await this.generatePDF(documentContent, caseId);

      // Store document
      const { data: document, error: docError } = await supabase
        .from('settlement_documents')
        .insert([{
          id: uuidv4(),
          case_id: caseId,
          option_id: optionId,
          document_type: 'settlement_agreement',
          title: `Settlement Agreement - Case ${caseData.case_number}`,
          content: documentContent.text,
          pdf_url: pdfPath,
          status: 'ready',
          generated_at: new Date().toISOString(),
          metadata: JSON.stringify({
            generatedBy: userId,
            optionRank: option.rank,
            settlementAmount: option.settlement_amount
          })
        }])
        .select()
        .single();

      if (docError) {
        throw new Error(`Failed to store document: ${docError.message}`);
      }

      logger.info(`Settlement document generated successfully`, { documentId: document.id });

      return {
        success: true,
        document
      };

    } catch (error) {
      logger.error('Failed to generate settlement document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Build document content
  buildDocumentContent({ caseData, option, complainant, respondent, legalBasis, conditions, nonMonetaryTerms }) {
    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const text = `
AI-MEDIATED SETTLEMENT AGREEMENT

Case Number: ${caseData.case_number || 'N/A'}
Date: ${date}

BETWEEN:

1. ${complainant.users.full_name} (hereinafter referred to as the "Complainant")
   Email: ${complainant.users.email}
   
AND

2. ${respondent.users.full_name} (hereinafter referred to as the "Respondent")
   Email: ${respondent.users.email}

(Hereinafter collectively referred to as the "Parties")

WHEREAS:

A. A dispute arose between the Parties concerning: ${caseData.title}

B. Both Parties agreed to participate in Alternative Dispute Resolution (ADR) through the AI Dispute Resolver system.

C. After comprehensive analysis of statements and evidence submitted by both Parties, the AI mediator generated settlement options based on principles of fairness and Indian law.

D. Both Parties have mutually selected and agreed upon the following settlement terms.

NOW THEREFORE, in consideration of the mutual promises and covenants contained herein, the Parties agree as follows:

1. SETTLEMENT AMOUNT AND PAYMENT TERMS

The Respondent agrees to pay the Complainant the sum of ₹${option.settlement_amount} (Rupees ${this.numberToWords(option.settlement_amount)} only) as full and final settlement of all claims.

Payment Terms: ${option.payment_terms}

2. SETTLEMENT CONDITIONS

The Parties agree to the following conditions:

${conditions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${nonMonetaryTerms.length > 0 ? `
3. NON-MONETARY TERMS

${nonMonetaryTerms.map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''}

${nonMonetaryTerms.length > 0 ? '4' : '3'}. LEGAL BASIS

This settlement agreement is executed in accordance with the following legal provisions:

Constitutional Provisions:
${legalBasis.constitutionalArticles?.map(a => `- ${a}`).join('\n') || '- Indian Constitution'}

Civil Laws:
${legalBasis.civilLaws?.map(l => `- ${l}`).join('\n') || '- Civil Procedure Code, 1908'}

${legalBasis.precedents && legalBasis.precedents.length > 0 ? `
Applicable Precedents:
${legalBasis.precedents.map(p => `- ${p}`).join('\n')}
` : ''}

${nonMonetaryTerms.length > 0 ? '5' : '4'}. FULL AND FINAL SETTLEMENT

This Agreement constitutes a full and final settlement of all claims, counterclaims, and disputes between the Parties arising from or related to the dispute described above. Upon execution of this Agreement and fulfillment of the payment obligations, both Parties hereby release and forever discharge each other from any and all claims, demands, and causes of action.

${nonMonetaryTerms.length > 0 ? '6' : '5'}. CONFIDENTIALITY

The Parties agree to keep the terms of this settlement confidential, except as required by law or for enforcement purposes.

${nonMonetaryTerms.length > 0 ? '7' : '6'}. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of India. Any disputes arising from this Agreement shall be subject to the jurisdiction of courts in ${caseData.jurisdiction || 'India'}.

${nonMonetaryTerms.length > 0 ? '8' : '7'}. TIMELINE

The terms of this settlement shall be implemented within: ${option.timeline}

${nonMonetaryTerms.length > 0 ? '9' : '8'}. ENFORCEMENT

${option.enforcement_mechanism || 'This agreement may be enforced through legal proceedings if necessary.'}

${nonMonetaryTerms.length > 0 ? '10' : '9'}. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the Parties and supersedes all prior negotiations, understandings, and agreements between them relating to the subject matter hereof.

IN WITNESS WHEREOF, the Parties have executed this Settlement Agreement as of the date first written above.

_________________________                 _________________________
${complainant.users.full_name}            ${respondent.users.full_name}
(Complainant)                              (Respondent)

Date: _______________                      Date: _______________


FACILITATED BY:
AI Dispute Resolver System
Powered by Gemini AI
Session ID: ${caseData.id}
Generated: ${date}

This settlement was reached through AI-mediated alternative dispute resolution, with a fairness score of ${option.fairness_score}/100 and AI confidence of ${Math.round(option.ai_confidence * 100)}%.

---
This is a legally binding agreement. Both parties are advised to seek independent legal counsel before signing.
`;

    return {
      text,
      title: `Settlement Agreement - Case ${caseData.case_number}`,
      metadata: {
        caseId: caseData.id,
        caseNumber: caseData.case_number,
        optionId: option.id,
        settlementAmount: option.settlement_amount,
        generatedDate: date
      }
    };
  }

  // Generate PDF document
  async generatePDF(documentContent, caseId) {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `settlement_${caseId}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../storage/documents', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const doc = new PDFDocument({
          size: 'A4',
          margin: 50
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Add header
        doc.fontSize(18).font('Helvetica-Bold').text('AI-MEDIATED SETTLEMENT AGREEMENT', {
          align: 'center'
        });
        doc.moveDown();

        // Add content
        doc.fontSize(11).font('Helvetica').text(documentContent.text, {
          align: 'justify',
          lineGap: 3
        });

        // Add footer
        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica-Oblique').text(
          'Generated by AI Dispute Resolver System',
          {
            align: 'center'
          }
        );

        doc.end();

        stream.on('finish', () => {
          logger.info(`PDF generated successfully: ${fileName}`);
          resolve(`/storage/documents/${fileName}`);
        });

        stream.on('error', (error) => {
          logger.error('PDF generation error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Helper: Convert number to words (simplified)
  numberToWords(num) {
    if (num === 0) return 'Zero';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + this.numberToWords(num % 100) : '');
    if (num < 100000) return this.numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + this.numberToWords(num % 1000) : '');
    if (num < 10000000) return this.numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + this.numberToWords(num % 100000) : '');
    
    return num.toString(); // Fallback for very large numbers
  }

  // Request signatures from both parties
  async requestSignatures(documentId, caseId) {
    try {
      const { data: parties } = await supabase
        .from('case_parties')
        .select(`
          *,
          users!inner(id, full_name, email)
        `)
        .eq('case_id', caseId);

      const signatures = [];

      for (const party of parties) {
        const { data, error } = await supabase
          .from('case_signatures')
          .insert([{
            id: uuidv4(),
            document_id: documentId,
            case_id: caseId,
            signer_id: party.user_id,
            signer_role: party.role,
            signature_method: 'email_otp',
            status: 'pending'
          }])
          .select()
          .single();

        if (!error) {
          signatures.push(data);
        }
      }

      return {
        success: true,
        signatures
      };

    } catch (error) {
      logger.error('Failed to request signatures:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SettlementDocumentService();
