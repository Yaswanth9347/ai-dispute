// Court Integration Service - Phase 5.2 Implementation
const { supabase } = require('../lib/supabaseClient');
const documentGeneratorService = require('./DocumentGeneratorService');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const FormData = require('form-data');
const axios = require('axios');

class CourtIntegrationService {
  constructor() {
    this.courtSystemsCache = new Map();
    this.filingStoragePath = process.env.COURT_FILING_STORAGE_PATH || './storage/court_filings';
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.filingStoragePath, { recursive: true });
      await fs.mkdir(path.join(this.filingStoragePath, 'packages'), { recursive: true });
      await fs.mkdir(path.join(this.filingStoragePath, 'responses'), { recursive: true });
      await fs.mkdir(path.join(this.filingStoragePath, 'temp'), { recursive: true });
    } catch (error) {
      console.error('Failed to initialize court filing storage:', error);
    }
  }

  // File case documents with court system
  async fileCaseWithCourt(options) {
    try {
      const {
        caseId,
        courtSystemId,
        documentIds = [],
        filingType = 'initial_complaint',
        filedBy,
        expedited = false,
        serviceMethod = 'electronic',
        metadata = {}
      } = options;

      // Validate inputs
      if (!caseId || !courtSystemId || !filedBy) {
        throw new Error('Case ID, Court System ID, and Filed By are required');
      }

      // Get case and court system details
      const [caseData, courtSystem] = await Promise.all([
        this.getCaseForFiling(caseId),
        this.getCourtSystem(courtSystemId)
      ]);

      // Prepare document package
      const documentPackage = await this.prepareDocumentPackage({
        caseData,
        courtSystem,
        documentIds,
        filingType,
        metadata
      });

      // Create court filing record
      const filingRecord = await this.createFilingRecord({
        caseId,
        courtSystemId,
        filingType,
        documentPackage,
        filedBy,
        expedited,
        serviceMethod,
        metadata
      });

      // Submit to court system
      const submissionResult = await this.submitToCourt({
        courtSystem,
        documentPackage,
        filingRecord,
        expedited
      });

      // Update filing record with submission results
      await this.updateFilingRecord(filingRecord.id, {
        filing_status: submissionResult.success ? 'submitted' : 'failed',
        court_confirmation_number: submissionResult.confirmationNumber,
        court_response: submissionResult.response,
        submission_timestamp: new Date().toISOString(),
        error_details: submissionResult.error
      });

      return {
        success: submissionResult.success,
        filingId: filingRecord.id,
        confirmationNumber: submissionResult.confirmationNumber,
        estimatedProcessingTime: submissionResult.estimatedProcessingTime,
        nextSteps: submissionResult.nextSteps,
        metadata: {
          courtSystem: courtSystem.name,
          filingType,
          documentCount: documentPackage.documents.length,
          packageSize: documentPackage.packageSize,
          expedited
        }
      };

    } catch (error) {
      console.error('Court filing failed:', error);
      throw new Error(`Court filing failed: ${error.message}`);
    }
  }

  // Get case data prepared for court filing
  async getCaseForFiling(caseId) {
    try {
      const { data: caseData, error } = await supabase
        .from('cases')
        .select(`
          *,
          case_parties!inner(*),
          case_evidence(*),
          case_communications(*),
          case_settlements(*),
          generated_documents(*)
        `)
        .eq('id', caseId)
        .single();

      if (error) throw error;
      if (!caseData) throw new Error('Case not found');

      // Validate case is ready for filing
      this.validateCaseForFiling(caseData);

      return caseData;
    } catch (error) {
      throw new Error(`Failed to retrieve case for filing: ${error.message}`);
    }
  }

  // Validate case meets court filing requirements
  validateCaseForFiling(caseData) {
    const errors = [];

    // Check required parties
    if (!caseData.case_parties || caseData.case_parties.length < 2) {
      errors.push('Case must have at least two parties (plaintiff and defendant)');
    }

    // Check case has proper jurisdiction
    if (!caseData.jurisdiction) {
      errors.push('Case must specify jurisdiction');
    }

    // Check dispute amount for jurisdiction requirements
    if (!caseData.dispute_amount || parseFloat(caseData.dispute_amount) <= 0) {
      errors.push('Case must specify valid dispute amount');
    }

    // Check case description
    if (!caseData.description || caseData.description.length < 50) {
      errors.push('Case must have detailed description (minimum 50 characters)');
    }

    if (errors.length > 0) {
      throw new Error(`Case validation failed: ${errors.join('; ')}`);
    }
  }

  // Get court system configuration
  async getCourtSystem(courtSystemId) {
    try {
      // Check cache first
      if (this.courtSystemsCache.has(courtSystemId)) {
        const cached = this.courtSystemsCache.get(courtSystemId);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
          return cached.courtSystem;
        }
      }

      const { data: courtSystem, error } = await supabase
        .from('court_systems')
        .select('*')
        .eq('id', courtSystemId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!courtSystem) throw new Error('Court system not found or inactive');

      // Cache court system
      this.courtSystemsCache.set(courtSystemId, {
        courtSystem,
        timestamp: Date.now()
      });

      return courtSystem;
    } catch (error) {
      throw new Error(`Failed to retrieve court system: ${error.message}`);
    }
  }

  // Prepare document package for court filing
  async prepareDocumentPackage(options) {
    try {
      const { caseData, courtSystem, documentIds, filingType, metadata } = options;
      
      const packageId = `${caseData.id}_${Date.now()}`;
      const packagePath = path.join(this.filingStoragePath, 'packages', `${packageId}.zip`);

      // Collect all documents for filing
      const documents = [];
      
      // Add specified generated documents
      for (const docId of documentIds) {
        const document = await this.getDocumentForFiling(docId);
        documents.push(document);
      }

      // Generate required court forms if not present
      const requiredForms = await this.generateRequiredCourtForms({
        caseData,
        courtSystem,
        filingType,
        documents
      });
      
      documents.push(...requiredForms);

      // Create filing package manifest
      const manifest = this.createFilingManifest({
        caseData,
        courtSystem,
        documents,
        filingType,
        packageId,
        metadata
      });

      // Create ZIP package
      const packageSize = await this.createFilingPackage(packagePath, documents, manifest);

      return {
        packageId,
        packagePath,
        packageSize,
        documents,
        manifest,
        courtSystem: courtSystem.name,
        filingType,
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to prepare document package: ${error.message}`);
    }
  }

  // Get document for court filing
  async getDocumentForFiling(documentId) {
    try {
      const { data: document, error } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) throw error;
      if (!document) throw new Error('Document not found');

      // Verify file exists
      if (document.file_path) {
        try {
          await fs.access(document.file_path);
        } catch (fileError) {
          throw new Error('Document file not found on disk');
        }
      }

      return {
        id: document.id,
        title: document.title,
        type: document.document_type,
        filePath: document.file_path,
        format: document.file_format,
        size: document.file_size,
        generatedAt: document.generated_at
      };

    } catch (error) {
      throw new Error(`Failed to get document for filing: ${error.message}`);
    }
  }

  // Generate required court forms
  async generateRequiredCourtForms(options) {
    try {
      const { caseData, courtSystem, filingType, documents } = options;
      const requiredForms = [];

      // Check what forms are required based on court system and filing type
      const formRequirements = this.getRequiredForms(courtSystem, filingType);

      for (const formType of formRequirements) {
        // Check if form already exists in documents
        const existingForm = documents.find(doc => doc.type === formType);
        if (existingForm) continue;

        // Generate the required form
        const form = await this.generateCourtForm({
          caseData,
          courtSystem,
          formType,
          filingType
        });

        if (form) {
          requiredForms.push(form);
        }
      }

      return requiredForms;

    } catch (error) {
      console.error('Failed to generate required court forms:', error);
      return []; // Return empty array but don't fail the entire process
    }
  }

  // Get required forms for filing type
  getRequiredForms(courtSystem, filingType) {
    const commonForms = ['case_information_sheet', 'service_of_process'];
    
    const filingTypeForms = {
      'initial_complaint': ['complaint', 'summons', 'civil_cover_sheet'],
      'motion': ['motion_form', 'notice_of_motion'],
      'response': ['answer', 'counterclaim'],
      'settlement': ['settlement_agreement', 'stipulation_of_dismissal'],
      'discovery': ['discovery_request', 'certificate_of_service']
    };

    return [...commonForms, ...(filingTypeForms[filingType] || [])];
  }

  // Generate specific court form
  async generateCourtForm(options) {
    try {
      const { caseData, courtSystem, formType, filingType } = options;

      // Get form template for this court system
      const template = await this.getCourtFormTemplate(courtSystem.id, formType);
      if (!template) return null;

      // Prepare variables for form generation
      const formVariables = this.prepareFormVariables(caseData, courtSystem, formType);

      // Generate form using document service
      const result = await documentGeneratorService.generateDocument({
        caseId: caseData.id,
        templateId: template.id,
        variables: formVariables,
        userId: caseData.created_by,
        generateAI: false, // Court forms should be precise, not AI-enhanced
        outputFormat: 'pdf'
      });

      return {
        id: result.documentId,
        title: template.name,
        type: formType,
        filePath: result.filePath,
        format: 'pdf',
        size: result.metadata.fileSize,
        generatedAt: new Date().toISOString(),
        isCourtForm: true
      };

    } catch (error) {
      console.error(`Failed to generate court form ${formType}:`, error);
      return null;
    }
  }

  // Get court form template
  async getCourtFormTemplate(courtSystemId, formType) {
    try {
      const { data: template, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('type', formType)
        .eq('category', 'court_form')
        .eq('jurisdiction', courtSystemId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return template || null;

    } catch (error) {
      console.error(`Failed to get court form template for ${formType}:`, error);
      return null;
    }
  }

  // Prepare variables for court form generation
  prepareFormVariables(caseData, courtSystem, formType) {
    const parties = caseData.case_parties || [];
    const plaintiff = parties.find(p => p.role === 'plaintiff') || {};
    const defendant = parties.find(p => p.role === 'defendant') || {};

    return {
      // Case information
      case_title: caseData.title,
      case_number: caseData.case_number || 'TBD',
      case_type: caseData.case_type,
      dispute_amount: caseData.dispute_amount,
      currency: caseData.currency,
      jurisdiction: caseData.jurisdiction,
      
      // Court information
      court_name: courtSystem.name,
      court_address: courtSystem.address,
      court_jurisdiction: courtSystem.jurisdiction,
      
      // Party information
      plaintiff_name: plaintiff.name || '',
      plaintiff_address: plaintiff.address || '',
      plaintiff_phone: plaintiff.phone || '',
      plaintiff_email: plaintiff.contact_email || '',
      
      defendant_name: defendant.name || '',
      defendant_address: defendant.address || '',
      defendant_phone: defendant.phone || '',
      defendant_email: defendant.contact_email || '',
      
      // Filing information
      filing_date: new Date().toLocaleDateString(),
      filing_type: formType,
      
      // Case description
      case_description: caseData.description || '',
      
      // Additional parties
      additional_parties: parties.slice(2).map(p => ({
        name: p.name,
        role: p.role,
        address: p.address
      }))
    };
  }

  // Create filing manifest
  createFilingManifest(options) {
    const { caseData, courtSystem, documents, filingType, packageId, metadata } = options;
    
    return {
      packageId,
      caseId: caseData.id,
      caseTitle: caseData.title,
      courtSystem: {
        id: courtSystem.id,
        name: courtSystem.name,
        jurisdiction: courtSystem.jurisdiction
      },
      filingType,
      createdAt: new Date().toISOString(),
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        format: doc.format,
        size: doc.size,
        isCourtForm: doc.isCourtForm || false
      })),
      totalDocuments: documents.length,
      metadata: {
        ...metadata,
        disputeAmount: caseData.dispute_amount,
        currency: caseData.currency,
        parties: caseData.case_parties?.length || 0
      }
    };
  }

  // Create ZIP package for court filing
  async createFilingPackage(packagePath, documents, manifest) {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(packagePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      let totalSize = 0;

      output.on('close', () => {
        resolve(archive.pointer());
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Archive warning:', err);
        } else {
          reject(err);
        }
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add manifest file
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      // Add all documents
      documents.forEach((doc, index) => {
        if (doc.filePath && require('fs').existsSync(doc.filePath)) {
          const fileName = `${index + 1}_${doc.title.replace(/[^a-zA-Z0-9\-_]/g, '_')}.${doc.format}`;
          archive.file(doc.filePath, { name: `documents/${fileName}` });
        }
      });

      archive.finalize();
    });
  }

  // Submit package to court system
  async submitToCourt(options) {
    try {
      const { courtSystem, documentPackage, filingRecord, expedited } = options;

      // Different submission methods based on court system type
      switch (courtSystem.integration_type) {
        case 'api':
          return await this.submitViaAPI(courtSystem, documentPackage, expedited);
        case 'efiling':
          return await this.submitViaEFiling(courtSystem, documentPackage, expedited);
        case 'email':
          return await this.submitViaEmail(courtSystem, documentPackage, expedited);
        case 'manual':
          return await this.prepareForManualSubmission(courtSystem, documentPackage);
        default:
          throw new Error(`Unsupported court integration type: ${courtSystem.integration_type}`);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        response: null,
        confirmationNumber: null,
        estimatedProcessingTime: null,
        nextSteps: ['Contact court clerk manually', 'Check filing requirements', 'Resubmit if necessary']
      };
    }
  }

  // Submit via court API
  async submitViaAPI(courtSystem, documentPackage, expedited) {
    try {
      const formData = new FormData();
      formData.append('filing_package', require('fs').createReadStream(documentPackage.packagePath));
      formData.append('manifest', JSON.stringify(documentPackage.manifest));
      formData.append('expedited', expedited.toString());

      const response = await axios.post(courtSystem.api_endpoint, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${courtSystem.api_key}`,
          'X-Court-System': courtSystem.name
        },
        timeout: 60000 // 1 minute timeout
      });

      return {
        success: true,
        confirmationNumber: response.data.confirmation_number,
        response: response.data,
        estimatedProcessingTime: response.data.estimated_processing_days || 5,
        nextSteps: response.data.next_steps || ['Monitor case status', 'Await court confirmation']
      };

    } catch (error) {
      throw new Error(`API submission failed: ${error.message}`);
    }
  }

  // Submit via eFiling system
  async submitViaEFiling(courtSystem, documentPackage, expedited) {
    try {
      // Simulate eFiling system integration
      // In production, this would integrate with actual eFiling platforms
      
      const confirmationNumber = `EF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      return {
        success: true,
        confirmationNumber,
        response: {
          status: 'submitted',
          efiling_system: courtSystem.efiling_system,
          submission_timestamp: new Date().toISOString()
        },
        estimatedProcessingTime: expedited ? 2 : 7,
        nextSteps: [
          'Check eFiling system for updates',
          'Monitor email for court notifications',
          'Await service confirmation'
        ]
      };

    } catch (error) {
      throw new Error(`eFiling submission failed: ${error.message}`);
    }
  }

  // Submit via email
  async submitViaEmail(courtSystem, documentPackage, expedited) {
    try {
      const mailer = require('../lib/mailer');
      
      const emailSubject = `Court Filing Submission - ${documentPackage.manifest.caseTitle} ${expedited ? '[EXPEDITED]' : ''}`;
      const emailBody = this.generateFilingEmailBody(documentPackage, expedited);

      await mailer.sendEmail({
        to: courtSystem.filing_email,
        subject: emailSubject,
        html: emailBody,
        attachments: [{
          filename: `filing_package_${documentPackage.packageId}.zip`,
          path: documentPackage.packagePath
        }]
      });

      const confirmationNumber = `EM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      return {
        success: true,
        confirmationNumber,
        response: {
          status: 'emailed',
          recipient: courtSystem.filing_email,
          submission_timestamp: new Date().toISOString()
        },
        estimatedProcessingTime: expedited ? 3 : 10,
        nextSteps: [
          'Await email confirmation from court clerk',
          'Follow up if no response within 2 business days',
          'Check court docket for case number assignment'
        ]
      };

    } catch (error) {
      throw new Error(`Email submission failed: ${error.message}`);
    }
  }

  // Prepare for manual submission
  async prepareForManualSubmission(courtSystem, documentPackage) {
    return {
      success: true,
      confirmationNumber: `MAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      response: {
        status: 'prepared_for_manual_submission',
        package_location: documentPackage.packagePath,
        court_address: courtSystem.address
      },
      estimatedProcessingTime: null,
      nextSteps: [
        'Download filing package from the system',
        `Visit ${courtSystem.name} clerk\'s office`,
        'Present documents and pay filing fees',
        'Obtain stamped copies and case number'
      ]
    };
  }

  // Generate email body for court filing
  generateFilingEmailBody(documentPackage, expedited) {
    const manifest = documentPackage.manifest;
    
    return `
      <h2>Court Filing Submission ${expedited ? '- EXPEDITED' : ''}</h2>
      
      <h3>Case Information:</h3>
      <ul>
        <li><strong>Case Title:</strong> ${manifest.caseTitle}</li>
        <li><strong>Filing Type:</strong> ${manifest.filingType}</li>
        <li><strong>Dispute Amount:</strong> ${manifest.metadata.disputeAmount} ${manifest.metadata.currency}</li>
        <li><strong>Number of Parties:</strong> ${manifest.metadata.parties}</li>
      </ul>
      
      <h3>Documents Included:</h3>
      <ul>
        ${manifest.documents.map(doc => 
          `<li>${doc.title} (${doc.type}) - ${doc.format.toUpperCase()}</li>`
        ).join('')}
      </ul>
      
      <h3>Package Details:</h3>
      <ul>
        <li><strong>Package ID:</strong> ${manifest.packageId}</li>
        <li><strong>Total Documents:</strong> ${manifest.totalDocuments}</li>
        <li><strong>Submission Date:</strong> ${new Date().toLocaleDateString()}</li>
      </ul>
      
      <p><strong>Please process this filing and provide confirmation with assigned case number.</strong></p>
      
      ${expedited ? '<p><em>This is an expedited filing request.</em></p>' : ''}
      
      <p>Best regards,<br>AI Dispute Resolver System</p>
    `;
  }

  // Create court filing record
  async createFilingRecord(options) {
    try {
      const {
        caseId,
        courtSystemId,
        filingType,
        documentPackage,
        filedBy,
        expedited,
        serviceMethod,
        metadata
      } = options;

      const { data: filingRecord, error } = await supabase
        .from('court_filings')
        .insert({
          case_id: caseId,
          court_system_id: courtSystemId,
          filing_type: filingType,
          filing_status: 'preparing',
          package_path: documentPackage.packagePath,
          package_manifest: documentPackage.manifest,
          filed_by: filedBy,
          expedited,
          service_method: serviceMethod,
          filing_date: new Date().toISOString(),
          metadata
        })
        .select()
        .single();

      if (error) throw error;
      
      return filingRecord;

    } catch (error) {
      throw new Error(`Failed to create filing record: ${error.message}`);
    }
  }

  // Update court filing record
  async updateFilingRecord(filingId, updates) {
    try {
      const { error } = await supabase
        .from('court_filings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', filingId);

      if (error) throw error;
      
    } catch (error) {
      console.error('Failed to update filing record:', error);
    }
  }

  // Get filing status
  async getFilingStatus(filingId) {
    try {
      const { data: filing, error } = await supabase
        .from('court_filings')
        .select(`
          *,
          cases!inner(title, case_number),
          court_systems!inner(name, jurisdiction)
        `)
        .eq('id', filingId)
        .single();

      if (error) throw error;
      if (!filing) throw new Error('Filing not found');

      return filing;

    } catch (error) {
      throw new Error(`Failed to get filing status: ${error.message}`);
    }
  }

  // List court systems
  async listCourtSystems(filters = {}) {
    try {
      let query = supabase
        .from('court_systems')
        .select('*')
        .eq('is_active', true);

      if (filters.jurisdiction) {
        query = query.eq('jurisdiction', filters.jurisdiction);
      }
      
      if (filters.type) {
        query = query.eq('court_type', filters.type);
      }
      
      if (filters.integration_type) {
        query = query.eq('integration_type', filters.integration_type);
      }

      const { data: courtSystems, error } = await query
        .order('name', { ascending: true });

      if (error) throw error;
      
      return courtSystems || [];

    } catch (error) {
      throw new Error(`Failed to list court systems: ${error.message}`);
    }
  }

  // Health check for court integration service
  async healthCheck() {
    try {
      const checks = {
        service: 'Court Integration Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {}
      };

      // Check database connectivity
      try {
        const { data, error } = await supabase
          .from('court_systems')
          .select('count')
          .limit(1);
        checks.components.database = error ? 'failed' : 'operational';
      } catch (error) {
        checks.components.database = 'failed';
      }

      // Check storage accessibility
      try {
        await fs.access(this.filingStoragePath);
        checks.components.storage = 'operational';
      } catch (error) {
        checks.components.storage = 'failed';
      }

      // Check document generator service
      try {
        const docHealth = await documentGeneratorService.healthCheck();
        checks.components.document_generator = docHealth.status === 'healthy' ? 'operational' : 'degraded';
      } catch (error) {
        checks.components.document_generator = 'failed';
      }

      // Determine overall status
      const failedComponents = Object.values(checks.components).filter(status => status === 'failed');
      if (failedComponents.length > 0) {
        checks.status = failedComponents.length === Object.keys(checks.components).length ? 'unhealthy' : 'degraded';
      }

      return checks;

    } catch (error) {
      return {
        service: 'Court Integration Service',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new CourtIntegrationService();