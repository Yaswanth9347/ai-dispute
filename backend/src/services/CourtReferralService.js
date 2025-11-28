// Court Referral Service - Automated court referral mechanism with proper documentation and filing preparation
const logger = require('../lib/logger');
const { supabase } = require('../lib/supabaseClient');
const PDFGenerationService = require('./PDFGenerationService');
const EmailService = require('./EmailService');
const DocumentTemplateService = require('./DocumentTemplateService');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CourtReferralService {
  constructor() {
    this.referralDir = path.join(__dirname, '../../storage/court_referrals');
    this.courtDatabase = path.join(__dirname, '../../storage/courts.json');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.referralDir, { recursive: true });
      
      // Initialize court database if not exists
      try {
        await fs.access(this.courtDatabase);
      } catch {
        await this.initializeCourtDatabase();
      }
      
      logger.info('Court Referral service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Court Referral service:', error);
    }
  }

  // Initialize court database with major Indian courts
  async initializeCourtDatabase() {
    try {
      const courts = {
        "supreme_court": {
          name: "Supreme Court of India",
          jurisdiction: "National",
          location: "New Delhi",
          address: "Tilak Marg, New Delhi 110001",
          phone: "+91-11-2338-4535",
          email: "supremecourt@nic.in",
          filing_process: "Online e-filing through Supreme Court website",
          court_fees: "Variable based on case type",
          applicable_cases: ["Constitutional matters", "Appeals from High Courts", "Special leave petitions"]
        },
        "delhi_high_court": {
          name: "Delhi High Court",
          jurisdiction: "Delhi",
          location: "New Delhi",
          address: "Sher Shah Road, New Delhi 110003",
          phone: "+91-11-2389-3037",
          email: "delhihc@nic.in",
          filing_process: "Physical filing or e-filing portal",
          court_fees: "₹10,000 - ₹50,000 (civil disputes)",
          applicable_cases: ["Civil disputes above ₹20 lakhs", "Writ petitions", "Appeals"]
        },
        "mumbai_high_court": {
          name: "Bombay High Court",
          jurisdiction: "Maharashtra, Goa, Dadra and Nagar Haveli",
          location: "Mumbai",
          address: "Fort, Mumbai 400001",
          phone: "+91-22-2266-1224",
          email: "bombayhc@nic.in",
          filing_process: "Physical filing or e-filing portal",
          court_fees: "₹10,000 - ₹50,000 (civil disputes)",
          applicable_cases: ["Civil disputes above ₹20 lakhs", "Commercial disputes", "IP matters"]
        },
        "bangalore_high_court": {
          name: "Karnataka High Court",
          jurisdiction: "Karnataka",
          location: "Bangalore",
          address: "Attara Kacheri Road, Bangalore 560001",
          phone: "+91-80-2221-4652",
          email: "karnatakahc@nic.in",
          filing_process: "Physical filing or e-filing portal",
          court_fees: "₹10,000 - ₹50,000 (civil disputes)",
          applicable_cases: ["Civil disputes", "Service matters", "Land disputes"]
        },
        "district_court_civil": {
          name: "District Court (Civil)",
          jurisdiction: "District level",
          location: "Various",
          address: "As per district",
          phone: "District specific",
          email: "District specific",
          filing_process: "Physical filing at court premises",
          court_fees: "₹500 - ₹10,000 (civil disputes)",
          applicable_cases: ["Civil disputes up to ₹20 lakhs", "Property disputes", "Contract disputes"]
        },
        "consumer_court": {
          name: "Consumer Disputes Redressal Forum",
          jurisdiction: "Consumer matters",
          location: "Various",
          address: "District/State/National level",
          phone: "Forum specific",
          email: "Forum specific",
          filing_process: "Online through National Consumer Helpline or physical filing",
          court_fees: "No court fees for disputes up to ₹20 lakhs",
          applicable_cases: ["Consumer complaints", "Service deficiency", "Product defects"]
        }
      };

      await fs.writeFile(this.courtDatabase, JSON.stringify(courts, null, 2));
      logger.info('Court database initialized');
    } catch (error) {
      logger.error('Error initializing court database:', error);
    }
  }

  // Determine appropriate court based on case details
  async determineAppropriateCourt(caseData) {
    try {
      const courts = JSON.parse(await fs.readFile(this.courtDatabase, 'utf8'));
      
      // Analyze case for court determination
      const disputeAmount = this.extractDisputeAmount(caseData);
      const caseType = this.determineCaseType(caseData);
      const location = caseData.location || 'delhi';

      let recommendedCourt;

      // Consumer disputes
      if (caseType === 'consumer') {
        recommendedCourt = courts.consumer_court;
      }
      // High value civil disputes
      else if (disputeAmount > 2000000) { // Above ₹20 lakhs
        recommendedCourt = this.getHighCourtByLocation(courts, location);
      }
      // Regular civil disputes
      else {
        recommendedCourt = courts.district_court_civil;
        recommendedCourt.location = location;
        recommendedCourt.address = `District Court, ${location}`;
      }

      return {
        court: recommendedCourt,
        reasoning: this.generateCourtSelectionReasoning(caseData, disputeAmount, caseType),
        alternativeCourts: this.getAlternativeCourts(courts, caseType, disputeAmount)
      };
    } catch (error) {
      logger.error('Error determining appropriate court:', error);
      throw new Error('Failed to determine appropriate court');
    }
  }

  // Process court referral
  async processCourtReferral(caseId, referralReason, initiatedBy, options = {}) {
    try {
      // Get case data
      const caseData = await this.getCaseDataForReferral(caseId);
      
      // Determine appropriate court
      const courtRecommendation = await this.determineAppropriateCourt(caseData);
      
      // Prepare settlement attempts history
      const settlementAttempts = await this.getSettlementAttempts(caseId);
      
      // Generate court referral documents
      const referralDocuments = await this.generateReferralDocuments(
        caseData,
        courtRecommendation,
        referralReason,
        settlementAttempts
      );
      
      // Create referral record
      const referralRecord = await this.createReferralRecord(
        caseId,
        courtRecommendation,
        referralReason,
        referralDocuments,
        initiatedBy
      );
      
      // Send notifications to parties
      const notifications = await this.sendReferralNotifications(
        caseData.parties,
        caseData,
        courtRecommendation,
        referralDocuments
      );
      
      // Update case status
      await this.updateCaseStatus(caseId, referralRecord.id);
      
      return {
        success: true,
        referralId: referralRecord.id,
        court: courtRecommendation.court,
        documents: referralDocuments,
        notifications,
        nextSteps: this.generateNextSteps(courtRecommendation.court),
        estimatedFilingDate: this.calculateEstimatedFilingDate()
      };
    } catch (error) {
      logger.error('Error processing court referral:', error);
      throw new Error(`Failed to process court referral: ${error.message}`);
    }
  }

  // Generate comprehensive referral documents
  async generateReferralDocuments(caseData, courtRecommendation, referralReason, settlementAttempts) {
    try {
      const documents = [];
      const timestamp = Date.now();
      
      // 1. Main Court Referral Document
      const referralPDF = await PDFGenerationService.generateCourtReferralDocument(
        caseData,
        referralReason,
        settlementAttempts
      );
      documents.push({
        type: 'court_referral',
        filename: `court_referral_${caseData.id}_${timestamp}.pdf`,
        filepath: referralPDF.filepath,
        description: 'Official court referral document with case summary and settlement attempts'
      });
      
      // 2. Case Summary for Court Filing
      const caseSummary = await PDFGenerationService.generateCaseSummaryReport(
        caseData,
        caseData.ai_analysis,
        caseData.timeline
      );
      documents.push({
        type: 'case_summary',
        filename: `case_summary_${caseData.id}_${timestamp}.pdf`,
        filepath: caseSummary.filepath,
        description: 'Comprehensive case summary for court filing'
      });
      
      // 3. Evidence Compilation
      const evidenceCompilation = await this.generateEvidenceCompilation(caseData);
      if (evidenceCompilation) {
        documents.push({
          type: 'evidence',
          filename: `evidence_compilation_${caseData.id}_${timestamp}.pdf`,
          filepath: evidenceCompilation.filepath,
          description: 'Compilation of all case evidence and supporting documents'
        });
      }
      
      // 4. Court Filing Checklist
      const filingChecklist = await this.generateFilingChecklist(
        courtRecommendation.court,
        caseData
      );
      documents.push({
        type: 'filing_checklist',
        filename: `filing_checklist_${caseData.id}_${timestamp}.pdf`,
        filepath: filingChecklist.filepath,
        description: 'Court-specific filing requirements and checklist'
      });
      
      return documents;
    } catch (error) {
      logger.error('Error generating referral documents:', error);
      throw new Error('Failed to generate referral documents');
    }
  }

  // Generate evidence compilation document
  async generateEvidenceCompilation(caseData) {
    try {
      // Get all case documents
      const { data: documents, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('case_id', caseData.id)
        .eq('status', 'active');

      if (error || !documents.length) {
        return null;
      }

      // Create evidence compilation PDF
      const templateData = {
        case: caseData,
        documents: documents.map(doc => ({
          name: doc.original_filename,
          type: doc.document_type,
          uploadedAt: new Date(doc.created_at).toLocaleDateString(),
          description: doc.description || 'Supporting evidence',
          relevance: doc.legal_relevance || 'Case evidence'
        })),
        summary: {
          totalDocuments: documents.length,
          compiledAt: new Date().toLocaleDateString()
        }
      };

      return await PDFGenerationService.generateFromTemplate(
        'evidence-compilation',
        templateData,
        `evidence_compilation_${caseData.id}_${Date.now()}.pdf`
      );
    } catch (error) {
      logger.error('Error generating evidence compilation:', error);
      return null;
    }
  }

  // Generate court-specific filing checklist
  async generateFilingChecklist(court, caseData) {
    try {
      const templateData = {
        court: court,
        case: caseData,
        requirements: this.getCourtSpecificRequirements(court),
        checklist: this.generateChecklistItems(court, caseData),
        fees: this.calculateCourtFees(court, caseData),
        timeline: {
          generatedAt: new Date().toLocaleDateString(),
          estimatedFilingDate: this.calculateEstimatedFilingDate(),
          expectedFirstHearing: this.calculateExpectedFirstHearing()
        }
      };

      return await PDFGenerationService.generateFromTemplate(
        'filing-checklist',
        templateData,
        `filing_checklist_${caseData.id}_${Date.now()}.pdf`
      );
    } catch (error) {
      logger.error('Error generating filing checklist:', error);
      throw new Error('Failed to generate filing checklist');
    }
  }

  // Get court-specific requirements
  getCourtSpecificRequirements(court) {
    const baseRequirements = [
      'Original plaint/petition with required number of copies',
      'Court fee payment (demand draft or online payment)',
      'Affidavit of truth',
      'Process fee for service of summons',
      'Vakalatnama (if represented by advocate)'
    ];

    const specificRequirements = {
      'Supreme Court of India': [
        'Special leave petition format',
        'Certified copies of impugned judgment',
        'Paper book preparation',
        'Security deposit as per rules'
      ],
      'Delhi High Court': [
        'Case information sheet',
        'Index of documents',
        'E-filing registration (if filing online)',
        'Delhi High Court specific formats'
      ],
      'Consumer Disputes Redressal Forum': [
        'Consumer complaint format',
        'Copy of invoice/bill/agreement',
        'Proof of service deficiency',
        'Medical records (if applicable)'
      ]
    };

    return {
      base: baseRequirements,
      specific: specificRequirements[court.name] || []
    };
  }

  // Generate checklist items
  generateChecklistItems(court, caseData) {
    return [
      {
        category: 'Documents',
        items: [
          { task: 'Prepare plaint/petition', completed: false, priority: 'high' },
          { task: 'Collect all supporting documents', completed: false, priority: 'high' },
          { task: 'Prepare affidavit of truth', completed: false, priority: 'medium' },
          { task: 'Index all documents', completed: false, priority: 'medium' }
        ]
      },
      {
        category: 'Legal',
        items: [
          { task: 'Engage legal counsel (recommended)', completed: false, priority: 'high' },
          { task: 'Review court jurisdiction', completed: true, priority: 'high' },
          { task: 'Prepare legal arguments', completed: false, priority: 'medium' }
        ]
      },
      {
        category: 'Administrative',
        items: [
          { task: 'Calculate and arrange court fees', completed: false, priority: 'high' },
          { task: 'Register for e-filing (if available)', completed: false, priority: 'medium' },
          { task: 'Arrange for document service', completed: false, priority: 'medium' }
        ]
      },
      {
        category: 'Pre-Filing',
        items: [
          { task: 'Review all documents for completeness', completed: false, priority: 'high' },
          { task: 'Ensure proper notarization', completed: false, priority: 'medium' },
          { task: 'Schedule filing appointment', completed: false, priority: 'low' }
        ]
      }
    ];
  }

  // Create referral record in database
  async createReferralRecord(caseId, courtRecommendation, reason, documents, initiatedBy) {
    try {
      const referralRecord = {
        id: uuidv4(),
        case_id: caseId,
        court_name: courtRecommendation.court.name,
        court_jurisdiction: courtRecommendation.court.jurisdiction,
        court_location: courtRecommendation.court.location,
        court_address: courtRecommendation.court.address,
        court_contact: {
          phone: courtRecommendation.court.phone,
          email: courtRecommendation.court.email
        },
        referral_reason: reason,
        referral_documents: documents,
        court_selection_reasoning: courtRecommendation.reasoning,
        alternative_courts: courtRecommendation.alternativeCourts,
        estimated_filing_date: this.calculateEstimatedFilingDate(),
        estimated_first_hearing: this.calculateExpectedFirstHearing(),
        initiated_by: initiatedBy,
        status: 'pending_filing',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('court_referrals')
        .insert(referralRecord)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Error creating referral record:', error);
      throw new Error('Failed to create referral record');
    }
  }

  // Send referral notifications
  async sendReferralNotifications(parties, caseData, courtRecommendation, documents) {
    try {
      const notifications = [];

      for (const party of parties) {
        const templateData = {
          recipient: {
            name: party.name,
            email: party.email,
            role: party.role
          },
          case: caseData,
          court: courtRecommendation.court,
          referral: {
            date: new Date().toLocaleDateString(),
            reason: 'Settlement attempts were unsuccessful',
            nextSteps: this.generateNextSteps(courtRecommendation.court)
          },
          documents: documents,
          timeline: {
            estimatedFilingDate: this.calculateEstimatedFilingDate(),
            expectedFirstHearing: this.calculateExpectedFirstHearing()
          }
        };

        const attachments = documents.map(doc => ({
          filename: doc.filename,
          path: doc.filepath,
          contentType: 'application/pdf'
        }));

        const result = await EmailService.sendTemplateEmail(
          party.email,
          'court-referral-notification',
          templateData,
          attachments
        );

        notifications.push({
          party: party.email,
          success: result.success,
          messageId: result.messageId
        });
      }

      return notifications;
    } catch (error) {
      logger.error('Error sending referral notifications:', error);
      throw new Error('Failed to send referral notifications');
    }
  }

  // Update case status for court referral
  async updateCaseStatus(caseId, referralId) {
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'forwarded_to_court',
          court_referral_id: referralId,
          court_referral_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating case status:', error);
      throw new Error('Failed to update case status');
    }
  }

  // Helper methods
  getCaseDataForReferral(caseId) {
    // Implementation to get case data
    return supabase
      .from('cases')
      .select(`
        *,
        users!filed_by (
          id, email, full_name, phone
        )
      `)
      .eq('id', caseId)
      .single();
  }

  getSettlementAttempts(caseId) {
    return supabase
      .from('case_timeline')
      .select('*')
      .eq('case_id', caseId)
      .in('event_type', ['settlement_attempt', 'ai_analysis', 'negotiation']);
  }

  extractDisputeAmount(caseData) {
    // Extract monetary value from case description or explicit field
    const amount = caseData.dispute_amount || caseData.claimed_amount;
    if (amount) return amount;

    // Try to extract from description
    const description = caseData.description || '';
    const matches = description.match(/(?:Rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi);
    if (matches) {
      return Math.max(...matches.map(m => 
        parseFloat(m.replace(/[^\d.]/g, ''))
      ));
    }

    return 0;
  }

  determineCaseType(caseData) {
    const keywords = {
      consumer: ['defective product', 'service deficiency', 'consumer complaint', 'warranty', 'refund'],
      property: ['property dispute', 'land', 'real estate', 'possession', 'title'],
      contract: ['breach of contract', 'agreement', 'payment default', 'delivery'],
      employment: ['wrongful termination', 'salary dispute', 'workplace harassment']
    };

    const description = (caseData.description || '').toLowerCase();
    
    for (const [type, typeKeywords] of Object.entries(keywords)) {
      if (typeKeywords.some(keyword => description.includes(keyword))) {
        return type;
      }
    }

    return 'civil';
  }

  getHighCourtByLocation(courts, location) {
    const locationMap = {
      delhi: 'delhi_high_court',
      mumbai: 'mumbai_high_court',
      bangalore: 'bangalore_high_court',
      bengaluru: 'bangalore_high_court'
    };

    return courts[locationMap[location.toLowerCase()]] || courts.delhi_high_court;
  }

  generateCourtSelectionReasoning(caseData, amount, type) {
    let reasoning = [];
    
    if (type === 'consumer') {
      reasoning.push('Case involves consumer dispute - Consumer Forum has specialized jurisdiction');
    } else if (amount > 2000000) {
      reasoning.push('Dispute amount exceeds ₹20 lakhs - High Court jurisdiction required');
    } else {
      reasoning.push('District Court has appropriate jurisdiction for this civil matter');
    }

    reasoning.push(`Case type: ${type.toUpperCase()}`);
    if (amount > 0) {
      reasoning.push(`Dispute amount: ₹${amount.toLocaleString('en-IN')}`);
    }

    return reasoning.join('. ');
  }

  getAlternativeCourts(courts, type, amount) {
    // Return 2-3 alternative courts based on case type
    const alternatives = [];
    
    if (type === 'consumer') {
      alternatives.push(courts.district_court_civil);
    } else {
      alternatives.push(courts.consumer_court);
      if (amount > 1000000) {
        alternatives.push(courts.delhi_high_court);
      }
    }

    return alternatives.slice(0, 2);
  }

  generateNextSteps(court) {
    return [
      'Review all generated documents and court referral materials',
      'Engage a qualified legal counsel familiar with court procedures',
      `Arrange court fees as per ${court.name} requirements`,
      'Prepare additional documents as per filing checklist',
      'Schedule appointment for document filing',
      'Serve notice to opposing party as per court rules',
      'Prepare for first hearing appearance'
    ];
  }

  calculateCourtFees(court, caseData) {
    const disputeAmount = this.extractDisputeAmount(caseData);
    let courtFee = 0;

    if (court.name.includes('Consumer')) {
      courtFee = 0; // No court fees for consumer forums
    } else if (court.name.includes('Supreme Court')) {
      courtFee = 50000; // Fixed fee for Supreme Court
    } else if (court.name.includes('High Court')) {
      // Calculate based on dispute amount
      courtFee = Math.min(Math.max(disputeAmount * 0.01, 10000), 50000);
    } else {
      // District court
      courtFee = Math.min(Math.max(disputeAmount * 0.02, 500), 10000);
    }

    return {
      courtFee,
      processService: Math.min(courtFee * 0.1, 5000),
      miscellaneous: 1000,
      total: courtFee + Math.min(courtFee * 0.1, 5000) + 1000
    };
  }

  calculateEstimatedFilingDate() {
    // Add 7-14 days for document preparation
    const filingDate = new Date();
    filingDate.setDate(filingDate.getDate() + 10);
    return filingDate.toISOString().split('T')[0];
  }

  calculateExpectedFirstHearing() {
    // Add 30-60 days from filing (varies by court)
    const hearingDate = new Date();
    hearingDate.setDate(hearingDate.getDate() + 45);
    return hearingDate.toISOString().split('T')[0];
  }

  // Get court referral statistics
  async getReferralStatistics(dateRange = null) {
    try {
      let query = supabase
        .from('court_referrals')
        .select('court_name, status, created_at');

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end);
      }

      const { data, error } = await query;
      if (error) throw error;

      return {
        total: data.length,
        byCourt: data.reduce((acc, referral) => {
          acc[referral.court_name] = (acc[referral.court_name] || 0) + 1;
          return acc;
        }, {}),
        byStatus: data.reduce((acc, referral) => {
          acc[referral.status] = (acc[referral.status] || 0) + 1;
          return acc;
        }, {}),
        thisMonth: data.filter(r => 
          new Date(r.created_at).getMonth() === new Date().getMonth()
        ).length
      };
    } catch (error) {
      logger.error('Error getting referral statistics:', error);
      throw new Error('Failed to get referral statistics');
    }
  }
}

module.exports = new CourtReferralService();