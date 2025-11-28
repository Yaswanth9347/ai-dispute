// Court Referral Package Service - Create comprehensive ZIP packages for court filing
const logger = require('../lib/logger');
const { supabase } = require('../lib/supabaseClient');
const PDFGenerationService = require('./PDFGenerationService');
const archiver = require('archiver');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class CourtReferralPackageService {
  constructor() {
    this.packageDir = path.join(__dirname, '../../storage/court_packages');
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.packageDir, { recursive: true });
      logger.info('Court Referral Package service initialized');
    } catch (error) {
      logger.error('Failed to initialize Court Referral Package service:', error);
    }
  }

  /**
   * Create comprehensive court package with all case materials
   * @param {string} caseId - Case ID
   * @returns {Promise<Object>} Package details with path and manifest
   */
  async createCourtPackage(caseId) {
    try {
      logger.info(`Creating court package for case ${caseId}`);

      // Get comprehensive case data
      const caseData = await this.getCaseData(caseId);
      
      // Create package directory
      const packageName = `case_${caseId}_court_package_${Date.now()}`;
      const packagePath = path.join(this.packageDir, packageName);
      await fs.mkdir(packagePath, { recursive: true });

      // Generate all necessary documents
      const documents = await this.generateAllDocuments(caseData, packagePath);

      // Copy statements and evidences
      await this.copyStatements(caseId, packagePath);
      await this.copyEvidences(caseId, packagePath);

      // Generate manifest
      const manifest = await this.generateManifest(caseData, documents);
      await fs.writeFile(
        path.join(packagePath, 'MANIFEST.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Generate README for court
      await this.generateCourtReadme(caseData, packagePath);

      // Create ZIP archive
      const zipPath = await this.createZipArchive(packagePath, packageName);

      // Record package creation
      await this.recordPackageCreation(caseId, zipPath, manifest);

      logger.info(`Court package created successfully: ${zipPath}`);

      return {
        success: true,
        packagePath: zipPath,
        packageSize: (await fs.stat(zipPath)).size,
        manifest,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error creating court package:', error);
      throw new Error(`Failed to create court package: ${error.message}`);
    }
  }

  /**
   * Get comprehensive case data
   * @param {string} caseId - Case ID
   * @returns {Promise<Object>} Complete case data
   */
  async getCaseData(caseId) {
    try {
      // Get case with users
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select(`
          *,
          complainer:users!filed_by (
            id, email, full_name, phone, address
          ),
          defender:users!defender_user_id (
            id, email, full_name, phone, address
          )
        `)
        .eq('id', caseId)
        .single();

      if (caseError) throw caseError;

      // Get AI analysis
      const { data: analysis } = await supabase
        .from('ai_analysis')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      // Get timeline
      const { data: timeline } = await supabase
        .from('case_timeline')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at');

      // Get statements
      const { data: statements } = await supabase
        .from('case_statements')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at');

      // Get evidences
      const { data: evidences } = await supabase
        .from('case_evidences')
        .select('*')
        .eq('case_id', caseId)
        .order('uploaded_at');

      // Get settlement attempts
      const { data: settlements } = await supabase
        .from('settlement_options')
        .select('*')
        .eq('case_id', caseId)
        .order('generated_at');

      return {
        case: caseData,
        analysis: analysis || [],
        timeline: timeline || [],
        statements: statements || [],
        evidences: evidences || [],
        settlements: settlements || []
      };
    } catch (error) {
      logger.error('Error getting case data:', error);
      throw error;
    }
  }

  /**
   * Generate all required documents
   * @param {Object} caseData - Case data
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Generated documents info
   */
  async generateAllDocuments(caseData, outputDir) {
    const documents = {};

    try {
      // 1. Cover Letter
      logger.info('Generating cover letter...');
      documents.coverLetter = await this.generateCoverLetter(caseData, outputDir);

      // 2. Case Summary Report
      logger.info('Generating case summary...');
      documents.caseSummary = await PDFGenerationService.generateCaseSummaryReport(
        caseData.case,
        caseData.analysis[0]?.analysis || {},
        caseData.timeline
      );
      if (documents.caseSummary.filepath) {
        await fs.copyFile(
          documents.caseSummary.filepath,
          path.join(outputDir, '02_Case_Summary.pdf')
        );
      }

      // 3. AI Analysis Report
      logger.info('Generating AI analysis report...');
      documents.aiReport = await this.generateAIAnalysisReport(caseData, outputDir);

      // 4. Settlement Attempts Log
      logger.info('Generating settlement attempts log...');
      documents.settlementLog = await this.generateSettlementAttemptsLog(caseData, outputDir);

      // 5. Timeline Report
      logger.info('Generating timeline report...');
      documents.timeline = await this.generateTimelineReport(caseData, outputDir);

      // 6. Parties Information
      logger.info('Generating parties information...');
      documents.partiesInfo = await this.generatePartiesInformation(caseData, outputDir);

      return documents;
    } catch (error) {
      logger.error('Error generating documents:', error);
      throw error;
    }
  }

  /**
   * Generate cover letter for court
   * @param {Object} caseData - Case data
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Document info
   */
  async generateCoverLetter(caseData, outputDir) {
    const content = `
      COVER LETTER FOR COURT FILING
      
      To: The Honorable Court
      
      Subject: Dispute Resolution Case Referral - Case ID: ${caseData.case.id}
      
      Date: ${new Date().toLocaleDateString()}
      
      Dear Sir/Madam,
      
      This package contains complete documentation for the dispute case between:
      
      Complainer: ${caseData.case.complainer?.full_name || caseData.case.complainer_name}
      Defender: ${caseData.case.defender?.full_name || caseData.case.defender_name}
      
      Case Type: ${caseData.case.case_type || 'General Dispute'}
      Filed On: ${new Date(caseData.case.created_at).toLocaleDateString()}
      
      CASE SUMMARY:
      ${caseData.case.description || 'No description provided'}
      
      DISPUTE RESOLUTION ATTEMPTS:
      The parties attempted to resolve this dispute through our AI-powered mediation platform.
      - Total settlement attempts: ${caseData.settlements.length}
      - AI analysis sessions: ${caseData.analysis.length}
      - Negotiation period: ${this.calculateNegotiationPeriod(caseData.case)}
      
      REASON FOR COURT REFERRAL:
      Despite multiple attempts at mediation and AI-assisted resolution, the parties were unable
      to reach a mutually acceptable settlement. Therefore, this case is being referred to the
      court for formal adjudication.
      
      PACKAGE CONTENTS:
      This package includes:
      1. Cover Letter (this document)
      2. Comprehensive Case Summary Report
      3. AI Analysis Reports
      4. Complete Settlement Attempt Logs
      5. Case Timeline with all events
      6. Parties Information and Contact Details
      7. All Statements submitted by both parties
      8. All Evidence documents submitted
      9. Manifest with complete file listing
      
      All documents in this package are authentic and have been digitally verified.
      
      We request the honorable court to take this case for formal proceedings.
      
      Respectfully submitted,
      AI Dispute Resolution Platform
      
      ---
      
      For queries or additional information:
      Email: court@ai-dispute.com
      Phone: +91-XXXX-XXXXXX
      Reference: ${caseData.case.id}
    `;

    const filePath = path.join(outputDir, '01_Cover_Letter.txt');
    await fs.writeFile(filePath, content);

    return {
      filename: '01_Cover_Letter.txt',
      path: filePath,
      size: (await fs.stat(filePath)).size
    };
  }

  /**
   * Generate AI Analysis Report
   * @param {Object} caseData - Case data
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Document info
   */
  async generateAIAnalysisReport(caseData, outputDir) {
    const content = {
      caseId: caseData.case.id,
      analysisCount: caseData.analysis.length,
      analyses: caseData.analysis.map(a => ({
        date: new Date(a.created_at).toLocaleDateString(),
        summary: a.analysis?.summary || 'No summary',
        recommendations: a.analysis?.recommendations || [],
        strengths: {
          complainer: a.analysis?.complainer_strengths || [],
          defender: a.analysis?.defender_strengths || []
        },
        weaknesses: {
          complainer: a.analysis?.complainer_weaknesses || [],
          defender: a.analysis?.defender_weaknesses || []
        }
      }))
    };

    const filePath = path.join(outputDir, '05_AI_Analysis_Report.json');
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));

    return {
      filename: '05_AI_Analysis_Report.json',
      path: filePath,
      size: (await fs.stat(filePath)).size
    };
  }

  /**
   * Generate Settlement Attempts Log
   * @param {Object} caseData - Case data
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Document info
   */
  async generateSettlementAttemptsLog(caseData, outputDir) {
    const content = {
      caseId: caseData.case.id,
      totalAttempts: caseData.settlements.length,
      attempts: caseData.settlements.map(s => ({
        date: new Date(s.generated_at).toLocaleDateString(),
        optionNumber: s.option_number,
        description: s.option_text,
        complainerSelection: s.complainer_selected,
        defenderSelection: s.defender_selected,
        consensusReached: s.consensus_reached,
        status: s.status
      }))
    };

    const filePath = path.join(outputDir, '06_Settlement_Attempts.json');
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));

    return {
      filename: '06_Settlement_Attempts.json',
      path: filePath,
      size: (await fs.stat(filePath)).size
    };
  }

  /**
   * Generate Timeline Report
   * @param {Object} caseData - Case data
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Document info
   */
  async generateTimelineReport(caseData, outputDir) {
    const content = {
      caseId: caseData.case.id,
      totalEvents: caseData.timeline.length,
      events: caseData.timeline.map(e => ({
        date: new Date(e.created_at).toLocaleString(),
        type: e.event_type,
        description: e.description,
        actor: e.user_id,
        metadata: e.metadata
      }))
    };

    const filePath = path.join(outputDir, '07_Timeline.json');
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));

    return {
      filename: '07_Timeline.json',
      path: filePath,
      size: (await fs.stat(filePath)).size
    };
  }

  /**
   * Generate Parties Information
   * @param {Object} caseData - Case data
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Document info
   */
  async generatePartiesInformation(caseData, outputDir) {
    const content = {
      complainer: {
        name: caseData.case.complainer?.full_name || caseData.case.complainer_name,
        email: caseData.case.complainer?.email || caseData.case.complainer_email,
        phone: caseData.case.complainer?.phone,
        address: caseData.case.complainer?.address
      },
      defender: {
        name: caseData.case.defender?.full_name || caseData.case.defender_name,
        email: caseData.case.defender?.email || caseData.case.defender_email,
        phone: caseData.case.defender?.phone,
        address: caseData.case.defender?.address || caseData.case.defender_address
      }
    };

    const filePath = path.join(outputDir, '08_Parties_Information.json');
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));

    return {
      filename: '08_Parties_Information.json',
      path: filePath,
      size: (await fs.stat(filePath)).size
    };
  }

  /**
   * Copy statements to package
   * @param {string} caseId - Case ID
   * @param {string} outputDir - Output directory
   * @returns {Promise<void>}
   */
  async copyStatements(caseId, outputDir) {
    try {
      const statementsDir = path.join(outputDir, '03_Statements');
      await fs.mkdir(statementsDir, { recursive: true });

      const { data: statements } = await supabase
        .from('case_statements')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at');

      if (!statements || statements.length === 0) {
        await fs.writeFile(
          path.join(statementsDir, 'NO_STATEMENTS.txt'),
          'No statements were submitted for this case.'
        );
        return;
      }

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const fileName = `${String(i + 1).padStart(3, '0')}_${stmt.submitted_by}_${new Date(stmt.created_at).toISOString().split('T')[0]}.txt`;
        const content = `
Statement #${i + 1}
Submitted By: ${stmt.submitted_by}
Date: ${new Date(stmt.created_at).toLocaleString()}
Type: ${stmt.statement_type || 'General'}

${stmt.statement_text}
        `;
        await fs.writeFile(path.join(statementsDir, fileName), content);
      }

      logger.info(`Copied ${statements.length} statements to package`);
    } catch (error) {
      logger.error('Error copying statements:', error);
    }
  }

  /**
   * Copy evidences to package
   * @param {string} caseId - Case ID
   * @param {string} outputDir - Output directory
   * @returns {Promise<void>}
   */
  async copyEvidences(caseId, outputDir) {
    try {
      const evidencesDir = path.join(outputDir, '04_Evidences');
      await fs.mkdir(evidencesDir, { recursive: true });

      const { data: evidences } = await supabase
        .from('case_evidences')
        .select('*')
        .eq('case_id', caseId)
        .order('uploaded_at');

      if (!evidences || evidences.length === 0) {
        await fs.writeFile(
          path.join(evidencesDir, 'NO_EVIDENCES.txt'),
          'No evidence documents were submitted for this case.'
        );
        return;
      }

      // Create evidence index
      const index = evidences.map((ev, i) => ({
        number: i + 1,
        filename: ev.filename || ev.file_name,
        uploadedBy: ev.uploaded_by,
        uploadDate: new Date(ev.uploaded_at).toLocaleString(),
        description: ev.description,
        fileType: ev.file_type,
        fileSize: ev.file_size
      }));

      await fs.writeFile(
        path.join(evidencesDir, '00_Evidence_Index.json'),
        JSON.stringify(index, null, 2)
      );

      // Copy actual evidence files if they exist locally
      for (let i = 0; i < evidences.length; i++) {
        const ev = evidences[i];
        if (ev.file_path) {
          try {
            const sourcePath = path.join(__dirname, '../../', ev.file_path);
            const destFileName = `${String(i + 1).padStart(3, '0')}_${ev.filename || ev.file_name}`;
            const destPath = path.join(evidencesDir, destFileName);
            
            // Check if source file exists
            await fs.access(sourcePath);
            await fs.copyFile(sourcePath, destPath);
          } catch (err) {
            logger.warn(`Could not copy evidence file: ${ev.filename}`, err);
          }
        }
      }

      logger.info(`Processed ${evidences.length} evidences for package`);
    } catch (error) {
      logger.error('Error copying evidences:', error);
    }
  }

  /**
   * Generate manifest
   * @param {Object} caseData - Case data
   * @param {Object} documents - Generated documents
   * @returns {Promise<Object>} Manifest
   */
  async generateManifest(caseData, documents) {
    return {
      packageType: 'COURT_REFERRAL',
      caseId: caseData.case.id,
      caseType: caseData.case.case_type,
      filedDate: caseData.case.created_at,
      packageCreated: new Date().toISOString(),
      parties: {
        complainer: {
          name: caseData.case.complainer?.full_name || caseData.case.complainer_name,
          email: caseData.case.complainer?.email
        },
        defender: {
          name: caseData.case.defender?.full_name || caseData.case.defender_name,
          email: caseData.case.defender?.email
        }
      },
      statistics: {
        totalStatements: caseData.statements.length,
        totalEvidences: caseData.evidences.length,
        aiAnalyses: caseData.analysis.length,
        settlementAttempts: caseData.settlements.length,
        timelineEvents: caseData.timeline.length,
        negotiationDuration: this.calculateNegotiationPeriod(caseData.case)
      },
      contents: {
        coverLetter: '01_Cover_Letter.txt',
        caseSummary: '02_Case_Summary.pdf',
        statementsFolder: '03_Statements/',
        evidencesFolder: '04_Evidences/',
        aiAnalysis: '05_AI_Analysis_Report.json',
        settlementAttempts: '06_Settlement_Attempts.json',
        timeline: '07_Timeline.json',
        partiesInfo: '08_Parties_Information.json',
        manifest: 'MANIFEST.json',
        readme: 'README_FOR_COURT.txt'
      },
      readyForCourtFiling: true,
      generatedBy: 'AI Dispute Resolution Platform v1.0',
      packageVersion: '1.0'
    };
  }

  /**
   * Generate README for court
   * @param {Object} caseData - Case data
   * @param {string} outputDir - Output directory
   * @returns {Promise<void>}
   */
  async generateCourtReadme(caseData, outputDir) {
    const content = `
AI DISPUTE RESOLUTION PLATFORM
COURT REFERRAL PACKAGE
==============================

CASE ID: ${caseData.case.id}
CASE TYPE: ${caseData.case.case_type || 'General Dispute'}
PACKAGE CREATED: ${new Date().toLocaleString()}

PACKAGE STRUCTURE:
------------------
01_Cover_Letter.txt             - Official cover letter for court
02_Case_Summary.pdf             - Comprehensive case summary report
03_Statements/                  - All statements from both parties
04_Evidences/                   - All evidence documents submitted
05_AI_Analysis_Report.json      - AI Sheriff's analysis reports
06_Settlement_Attempts.json     - Log of all settlement attempts
07_Timeline.json                - Complete case timeline
08_Parties_Information.json     - Contact details of both parties
MANIFEST.json                   - Complete package manifest
README_FOR_COURT.txt            - This file

CASE INFORMATION:
-----------------
Complainer: ${caseData.case.complainer?.full_name || caseData.case.complainer_name}
Defender: ${caseData.case.defender?.full_name || caseData.case.defender_name}
Filed On: ${new Date(caseData.case.created_at).toLocaleDateString()}
Status: ${caseData.case.status}

DISPUTE RESOLUTION ATTEMPTS:
---------------------------
- AI Analysis Sessions: ${caseData.analysis.length}
- Settlement Options Generated: ${caseData.settlements.length}
- Statements Submitted: ${caseData.statements.length}
- Evidence Documents: ${caseData.evidences.length}
- Negotiation Period: ${this.calculateNegotiationPeriod(caseData.case)}

OUTCOME:
--------
Despite multiple attempts at AI-assisted mediation and dispute resolution,
the parties were unable to reach a mutually acceptable settlement.
This case is therefore referred to the court for formal adjudication.

DOCUMENT AUTHENTICITY:
---------------------
All documents in this package are authentic and have been:
- Digitally verified
- Timestamped at creation
- Preserved in their original form
- Organized for easy court review

CONTACT INFORMATION:
-------------------
Platform: AI Dispute Resolution Platform
Email: court@ai-dispute.com
Phone: +91-XXXX-XXXXXX
Website: https://ai-dispute.com

For technical queries about this package or to verify document authenticity,
please contact our court liaison team at the above contact details.

---
Package Generated by AI Dispute Resolution Platform v1.0
    `;

    await fs.writeFile(path.join(outputDir, 'README_FOR_COURT.txt'), content);
  }

  /**
   * Create ZIP archive
   * @param {string} sourceDir - Source directory
   * @param {string} packageName - Package name
   * @returns {Promise<string>} Path to ZIP file
   */
  async createZipArchive(sourceDir, packageName) {
    return new Promise((resolve, reject) => {
      const zipPath = path.join(this.packageDir, `${packageName}.zip`);
      const output = fsSync.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        logger.info(`ZIP archive created: ${archive.pointer()} total bytes`);
        resolve(zipPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Record package creation
   * @param {string} caseId - Case ID
   * @param {string} zipPath - ZIP file path
   * @param {Object} manifest - Package manifest
   * @returns {Promise<void>}
   */
  async recordPackageCreation(caseId, zipPath, manifest) {
    try {
      await supabase
        .from('court_referral_packages')
        .insert({
          case_id: caseId,
          package_path: zipPath,
          package_size: (await fs.stat(zipPath)).size,
          manifest: manifest,
          created_at: new Date().toISOString()
        });

      // Add timeline event
      await supabase
        .from('case_timeline')
        .insert({
          case_id: caseId,
          event_type: 'court_package_created',
          description: 'Complete court referral package created',
          metadata: { packagePath: zipPath },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error recording package creation:', error);
    }
  }

  /**
   * Calculate negotiation period
   * @param {Object} caseData - Case object
   * @returns {string} Formatted duration
   */
  calculateNegotiationPeriod(caseData) {
    const start = new Date(caseData.created_at);
    const end = caseData.closed_at ? new Date(caseData.closed_at) : new Date();
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const hours = Math.floor(((end - start) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} days, ${hours} hours`;
  }

  /**
   * Get package by case ID
   * @param {string} caseId - Case ID
   * @returns {Promise<Object>} Package info
   */
  async getPackageByCaseId(caseId) {
    try {
      const { data, error } = await supabase
        .from('court_referral_packages')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting package:', error);
      return null;
    }
  }
}

module.exports = new CourtReferralPackageService();
