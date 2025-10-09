// Legal Document Generator Service - Phase 5.1 Core Implementation
const geminiService = require('./GeminiService');
const { supabase } = require('../lib/supabaseClient');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs').promises;
const path = require('path');

class DocumentGeneratorService {
  constructor() {
    this.geminiService = geminiService;
    this.templatesCache = new Map();
    this.documentStoragePath = process.env.DOCUMENT_STORAGE_PATH || './storage/documents';
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.documentStoragePath, { recursive: true });
      await fs.mkdir(path.join(this.documentStoragePath, 'templates'), { recursive: true });
      await fs.mkdir(path.join(this.documentStoragePath, 'generated'), { recursive: true });
      await fs.mkdir(path.join(this.documentStoragePath, 'temp'), { recursive: true });
    } catch (error) {
      console.error('Failed to initialize document storage:', error);
    }
  }

  // Generate document from template with AI enhancement
  async generateDocument(options) {
    try {
      const {
        caseId,
        templateId,
        variables = {},
        userId,
        generateAI = true,
        outputFormat = 'pdf'
      } = options;

      // Validate inputs
      if (!caseId || !templateId) {
        throw new Error('Case ID and Template ID are required');
      }

      // Get template and case data
      const [template, caseData] = await Promise.all([
        this.getTemplate(templateId),
        this.getCaseData(caseId)
      ]);

      // Enhance variables with AI-generated content
      let enhancedVariables = { ...variables };
      if (generateAI) {
        enhancedVariables = await this.enhanceWithAI(template, caseData, variables);
      }

      // Process template with enhanced variables
      const processedContent = await this.processTemplate(template, enhancedVariables);

      // Generate document in requested format
      const documentData = await this.createDocument(processedContent, outputFormat, template);

      // Save to database
      const savedDocument = await this.saveGeneratedDocument({
        caseId,
        templateId,
        documentType: template.type,
        title: this.generateDocumentTitle(template, enhancedVariables),
        content: processedContent,
        variables: enhancedVariables,
        filePath: documentData.filePath,
        fileFormat: outputFormat,
        fileSize: documentData.fileSize,
        generatedBy: userId
      });

      return {
        success: true,
        documentId: savedDocument.id,
        filePath: documentData.filePath,
        content: processedContent,
        metadata: {
          template: template.name,
          format: outputFormat,
          fileSize: documentData.fileSize,
          variablesUsed: Object.keys(enhancedVariables).length,
          aiEnhanced: generateAI
        }
      };
    } catch (error) {
      console.error('Document generation failed:', error);
      throw new Error(`Document generation failed: ${error.message}`);
    }
  }

  // Get template from database with caching
  async getTemplate(templateId) {
    try {
      // Check cache first
      if (this.templatesCache.has(templateId)) {
        const cached = this.templatesCache.get(templateId);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
          return cached.template;
        }
      }

      const { data: template, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!template) throw new Error('Template not found');

      // Cache template
      this.templatesCache.set(templateId, {
        template,
        timestamp: Date.now()
      });

      return template;
    } catch (error) {
      throw new Error(`Failed to retrieve template: ${error.message}`);
    }
  }

  // Get comprehensive case data for document generation
  async getCaseData(caseId) {
    try {
      const { data: caseData, error } = await supabase
        .from('cases')
        .select(`
          *,
          case_parties!inner(*),
          case_evidence(*),
          case_communications(*),
          ai_analyses(*),
          case_settlements(*)
        `)
        .eq('id', caseId)
        .single();

      if (error) throw error;
      if (!caseData) throw new Error('Case not found');

      return caseData;
    } catch (error) {
      throw new Error(`Failed to retrieve case data: ${error.message}`);
    }
  }

  // Enhance variables with AI-generated content
  async enhanceWithAI(template, caseData, baseVariables) {
    try {
      const enhancedVariables = { ...baseVariables };
      
      if (!template.ai_prompts) {
        return enhancedVariables;
      }

      // Process each AI prompt in the template
      for (const [key, prompt] of Object.entries(template.ai_prompts)) {
        try {
          const aiContent = await this.generateAIContent(prompt, caseData, enhancedVariables);
          enhancedVariables[key] = aiContent;
        } catch (error) {
          console.error(`AI content generation failed for ${key}:`, error);
          enhancedVariables[key] = `[AI generation failed: ${error.message}]`;
        }
      }

      return enhancedVariables;
    } catch (error) {
      console.error('AI enhancement failed:', error);
      return baseVariables;
    }
  }

  // Generate AI content for specific prompts
  async generateAIContent(prompt, caseData, variables) {
    try {
      const contextualPrompt = this.buildContextualPrompt(prompt, caseData, variables);
      
      const aiResponse = await this.geminiService.generateResponse(contextualPrompt, {
        temperature: 0.3, // Lower temperature for legal content
        maxOutputTokens: 1500
      });

      if (!aiResponse.success) {
        throw new Error(aiResponse.error);
      }

      return this.sanitizeAIContent(aiResponse.content);
    } catch (error) {
      throw new Error(`AI content generation failed: ${error.message}`);
    }
  }

  // Build contextual prompt with case data
  buildContextualPrompt(basePrompt, caseData, variables) {
    const context = {
      case: {
        id: caseData.id,
        title: caseData.title,
        type: caseData.case_type,
        jurisdiction: caseData.jurisdiction,
        description: caseData.description,
        amount: caseData.dispute_amount,
        currency: caseData.currency,
        status: caseData.status
      },
      parties: caseData.case_parties?.map(party => ({
        name: party.name,
        role: party.role,
        email: party.contact_email
      })) || [],
      variables: variables
    };

    return `
Context: You are generating legal document content for a ${caseData.case_type} case in ${caseData.jurisdiction}.

Case Details:
- Title: ${caseData.title}
- Description: ${caseData.description}
- Dispute Amount: ${caseData.dispute_amount} ${caseData.currency}
- Status: ${caseData.status}

Parties Involved:
${context.parties.map(p => `- ${p.role}: ${p.name} (${p.email})`).join('\n')}

Variables Available:
${Object.entries(variables).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Task: ${basePrompt}

Requirements:
1. Use professional legal language appropriate for the jurisdiction
2. Ensure content is legally sound and comprehensive
3. Reference specific case details where relevant
4. Format content appropriately for the document type
5. Avoid placeholder text or incomplete sentences

Generate content:`;
  }

  // Sanitize AI-generated content
  sanitizeAIContent(content) {
    if (!content) return '';
    
    return content
      .trim()
      .replace(/^\*\*|\*\*$/g, '') // Remove markdown bold
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/['']/g, "'"); // Normalize apostrophes
  }

  // Process template with Handlebars
  async processTemplate(template, variables) {
    try {
      const templateContent = template.template_content;
      
      if (!templateContent || !templateContent.sections) {
        throw new Error('Invalid template structure');
      }

      const processedSections = [];

      for (const section of templateContent.sections) {
        const compiledTitle = Handlebars.compile(section.title)(variables);
        const compiledContent = Handlebars.compile(section.content)(variables);
        
        processedSections.push({
          title: compiledTitle,
          content: compiledContent,
          order: section.order || processedSections.length
        });
      }

      return {
        sections: processedSections,
        metadata: {
          templateName: template.name,
          templateType: template.type,
          processedAt: new Date().toISOString(),
          totalSections: processedSections.length
        }
      };
    } catch (error) {
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  // Create document in specified format
  async createDocument(processedContent, format, template) {
    try {
      const timestamp = Date.now();
      const filename = `${template.type}_${timestamp}`;
      
      switch (format.toLowerCase()) {
        case 'pdf':
          return await this.generatePDF(processedContent, filename);
        case 'docx':
          return await this.generateDOCX(processedContent, filename);
        case 'html':
          return await this.generateHTML(processedContent, filename);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Document creation failed: ${error.message}`);
    }
  }

  // Generate PDF using Puppeteer
  async generatePDF(content, filename) {
    let browser;
    try {
      const htmlContent = this.contentToHTML(content);
      const filePath = path.join(this.documentStoragePath, 'generated', `${filename}.pdf`);
      
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in'
        }
      });

      const stats = await fs.stat(filePath);
      
      return {
        filePath,
        fileSize: stats.size,
        mimeType: 'application/pdf'
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Generate DOCX using docx library
  async generateDOCX(content, filename) {
    try {
      const filePath = path.join(this.documentStoragePath, 'generated', `${filename}.docx`);
      
      const paragraphs = [];
      
      for (const section of content.sections) {
        // Add section title
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title,
                bold: true,
                size: 28
              })
            ],
            spacing: { before: 400, after: 200 }
          })
        );
        
        // Add section content
        const contentLines = section.content.split('\n');
        for (const line of contentLines) {
          if (line.trim()) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.trim(),
                    size: 24
                  })
                ],
                spacing: { after: 120 }
              })
            );
          }
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(filePath, buffer);
      
      const stats = await fs.stat(filePath);
      
      return {
        filePath,
        fileSize: stats.size,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
    } catch (error) {
      throw new Error(`DOCX generation failed: ${error.message}`);
    }
  }

  // Generate HTML format
  async generateHTML(content, filename) {
    try {
      const filePath = path.join(this.documentStoragePath, 'generated', `${filename}.html`);
      const htmlContent = this.contentToHTML(content);
      
      await fs.writeFile(filePath, htmlContent, 'utf8');
      
      const stats = await fs.stat(filePath);
      
      return {
        filePath,
        fileSize: stats.size,
        mimeType: 'text/html'
      };
    } catch (error) {
      throw new Error(`HTML generation failed: ${error.message}`);
    }
  }

  // Convert content to HTML
  contentToHTML(content) {
    const sections = content.sections.map(section => `
      <section class="document-section">
        <h2 class="section-title">${this.escapeHTML(section.title)}</h2>
        <div class="section-content">
          ${this.formatContentHTML(section.content)}
        </div>
      </section>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legal Document</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
            color: #000;
        }
        .document-section {
            margin-bottom: 2em;
        }
        .section-title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 1em;
            text-align: center;
            text-transform: uppercase;
        }
        .section-content {
            text-align: justify;
            text-indent: 2em;
        }
        .section-content p {
            margin-bottom: 1em;
        }
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="document">
        ${sections}
    </div>
    <div class="document-footer">
        <p><em>Generated on ${new Date().toLocaleDateString()}</em></p>
    </div>
</body>
</html>`;
  }

  // Format content for HTML
  formatContentHTML(content) {
    if (!content) return '';
    
    return content
      .split('\n\n')
      .map(paragraph => `<p>${this.escapeHTML(paragraph.trim())}</p>`)
      .join('');
  }

  // Escape HTML characters
  escapeHTML(text) {
    const div = { innerHTML: '' };
    div.textContent = text;
    return div.innerHTML;
  }

  // Generate document title
  generateDocumentTitle(template, variables) {
    const timestamp = new Date().toLocaleDateString();
    const baseTitle = template.name;
    
    if (variables.party_1_name && variables.party_2_name) {
      return `${baseTitle} - ${variables.party_1_name} v ${variables.party_2_name} - ${timestamp}`;
    }
    
    return `${baseTitle} - ${timestamp}`;
  }

  // Save generated document to database
  async saveGeneratedDocument(documentData) {
    try {
      const { data: savedDoc, error } = await supabase
        .from('generated_documents')
        .insert({
          case_id: documentData.caseId,
          template_id: documentData.templateId,
          document_type: documentData.documentType,
          title: documentData.title,
          content: documentData.content,
          variables_used: documentData.variables,
          file_path: documentData.filePath,
          file_format: documentData.fileFormat,
          file_size: documentData.fileSize,
          status: 'generated',
          generated_by: documentData.generatedBy,
          generated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      return savedDoc;
    } catch (error) {
      throw new Error(`Failed to save document: ${error.message}`);
    }
  }

  // List available templates
  async listTemplates(filters = {}) {
    try {
      let query = supabase
        .from('document_templates')
        .select('*')
        .eq('is_active', true);

      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.jurisdiction) {
        query = query.eq('jurisdiction', filters.jurisdiction);
      }

      const { data: templates, error } = await query
        .order('name', { ascending: true });

      if (error) throw error;
      
      return templates || [];
    } catch (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  }

  // Get document history for a case
  async getDocumentHistory(caseId, limit = 50) {
    try {
      const { data: documents, error } = await supabase
        .from('generated_documents')
        .select(`
          *,
          document_templates(name, type, category)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return documents || [];
    } catch (error) {
      throw new Error(`Failed to get document history: ${error.message}`);
    }
  }

  // Health check for document generation service
  async healthCheck() {
    try {
      const checks = {
        service: 'Document Generator Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {}
      };

      // Check Gemini AI service
      try {
        const aiHealth = await this.geminiService.healthCheck();
        checks.components.ai_service = aiHealth.status === 'healthy' ? 'operational' : 'degraded';
      } catch (error) {
        checks.components.ai_service = 'failed';
      }

      // Check database connectivity
      try {
        const { data, error } = await supabase
          .from('document_templates')
          .select('count')
          .limit(1);
        checks.components.database = error ? 'failed' : 'operational';
      } catch (error) {
        checks.components.database = 'failed';
      }

      // Check storage accessibility
      try {
        await fs.access(this.documentStoragePath);
        checks.components.storage = 'operational';
      } catch (error) {
        checks.components.storage = 'failed';
      }

      // Check Puppeteer
      try {
        const browser = await puppeteer.launch({ headless: 'new' });
        await browser.close();
        checks.components.pdf_generator = 'operational';
      } catch (error) {
        checks.components.pdf_generator = 'failed';
      }

      // Determine overall status
      const failedComponents = Object.values(checks.components).filter(status => status === 'failed');
      if (failedComponents.length > 0) {
        checks.status = failedComponents.length === Object.keys(checks.components).length ? 'unhealthy' : 'degraded';
      }

      return checks;
    } catch (error) {
      return {
        service: 'Document Generator Service',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new DocumentGeneratorService();