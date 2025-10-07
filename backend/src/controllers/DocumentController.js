// Document Controller - Phase 5.1 API Layer
const documentGeneratorService = require('../services/DocumentGeneratorService');
const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');
const { supabase } = require('../lib/supabaseClient');
const fs = require('fs').promises;
const path = require('path');

class DocumentController {
  // Generate a new document
  generateDocument = asyncHandler(async (req, res) => {
    const {
      caseId,
      templateId,
      variables = {},
      outputFormat = 'pdf',
      generateAI = true
    } = req.body;

    // Validate required fields
    if (!caseId || !templateId) {
      throw new HttpError(400, 'Case ID and Template ID are required');
    }

    // Validate user has access to the case
    const { data: caseAccess } = await supabase
      .from('cases')
      .select('id, created_by')
      .eq('id', caseId)
      .single();

    if (!caseAccess) {
      throw new HttpError(404, 'Case not found');
    }

    // For now, allow access if user is authenticated
    // In production, implement proper authorization based on case parties/permissions

    const result = await documentGeneratorService.generateDocument({
      caseId,
      templateId,
      variables,
      userId: req.user.id,
      generateAI,
      outputFormat
    });

    res.status(201).json({
      success: true,
      message: 'Document generated successfully',
      data: result
    });
  });

  // List available templates
  listTemplates = asyncHandler(async (req, res) => {
    const { type, category, jurisdiction } = req.query;
    
    const filters = {};
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (jurisdiction) filters.jurisdiction = jurisdiction;

    const templates = await documentGeneratorService.listTemplates(filters);

    res.json({
      success: true,
      message: 'Templates retrieved successfully',
      data: {
        templates,
        count: templates.length,
        filters: filters
      }
    });
  });

  // Get template details
  getTemplate = asyncHandler(async (req, res) => {
    const { templateId } = req.params;

    if (!templateId) {
      throw new HttpError(400, 'Template ID is required');
    }

    const template = await documentGeneratorService.getTemplate(templateId);

    res.json({
      success: true,
      message: 'Template retrieved successfully',
      data: template
    });
  });

  // Get document history for a case
  getDocumentHistory = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const { limit = 50 } = req.query;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    // Validate user has access to the case
    const { data: caseAccess } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .single();

    if (!caseAccess) {
      throw new HttpError(404, 'Case not found');
    }

    const documents = await documentGeneratorService.getDocumentHistory(caseId, parseInt(limit));

    res.json({
      success: true,
      message: 'Document history retrieved successfully',
      data: {
        documents,
        caseId,
        count: documents.length
      }
    });
  });

  // Get specific generated document
  getDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!documentId) {
      throw new HttpError(400, 'Document ID is required');
    }

    const { data: document, error } = await supabase
      .from('generated_documents')
      .select(`
        *,
        cases!inner(id, title),
        document_templates!inner(name, type, category)
      `)
      .eq('id', documentId)
      .single();

    if (error || !document) {
      throw new HttpError(404, 'Document not found');
    }

    res.json({
      success: true,
      message: 'Document retrieved successfully',
      data: document
    });
  });

  // Download generated document file
  downloadDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!documentId) {
      throw new HttpError(400, 'Document ID is required');
    }

    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('id, file_path, file_format, title')
      .eq('id', documentId)
      .single();

    if (error || !document) {
      throw new HttpError(404, 'Document not found');
    }

    const filePath = document.file_path;
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Set appropriate headers
      const fileName = `${document.title.replace(/[^a-zA-Z0-9\-_]/g, '_')}.${document.file_format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', this.getMimeType(document.file_format));
      
      // Stream the file
      const fileBuffer = await fs.readFile(filePath);
      res.send(fileBuffer);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new HttpError(404, 'Document file not found');
      }
      throw new HttpError(500, 'Failed to download document');
    }
  });

  // Preview document content (HTML format)
  previewDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!documentId) {
      throw new HttpError(400, 'Document ID is required');
    }

    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('id, content, title, file_format')
      .eq('id', documentId)
      .single();

    if (error || !document) {
      throw new HttpError(404, 'Document not found');
    }

    // If it's already HTML, serve directly
    if (document.file_format === 'html') {
      const htmlContent = this.contentToHTML(document.content);
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
      return;
    }

    // Convert content to HTML for preview
    const htmlContent = this.contentToHTML(document.content);
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  });

  // Regenerate document with new parameters
  regenerateDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const {
      variables = {},
      outputFormat,
      generateAI = true
    } = req.body;

    if (!documentId) {
      throw new HttpError(400, 'Document ID is required');
    }

    // Get original document details
    const { data: originalDoc, error } = await supabase
      .from('generated_documents')
      .select('case_id, template_id, variables_used')
      .eq('id', documentId)
      .single();

    if (error || !originalDoc) {
      throw new HttpError(404, 'Original document not found');
    }

    // Merge variables with original ones
    const mergedVariables = {
      ...originalDoc.variables_used,
      ...variables
    };

    const result = await documentGeneratorService.generateDocument({
      caseId: originalDoc.case_id,
      templateId: originalDoc.template_id,
      variables: mergedVariables,
      userId: req.user.id,
      generateAI,
      outputFormat: outputFormat || 'pdf'
    });

    res.status(201).json({
      success: true,
      message: 'Document regenerated successfully',
      data: {
        ...result,
        originalDocumentId: documentId
      }
    });
  });

  // Delete generated document
  deleteDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!documentId) {
      throw new HttpError(400, 'Document ID is required');
    }

    // Get document details first
    const { data: document, error: fetchError } = await supabase
      .from('generated_documents')
      .select('id, file_path, generated_by')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new HttpError(404, 'Document not found');
    }

    // Check if user has permission to delete (document creator or admin)
    if (document.generated_by !== req.user.id && req.user.role !== 'admin') {
      throw new HttpError(403, 'Not authorized to delete this document');
    }

    try {
      // Delete file from storage
      if (document.file_path) {
        try {
          await fs.unlink(document.file_path);
        } catch (fileError) {
          console.warn('Failed to delete file:', fileError.message);
          // Continue with database deletion even if file deletion fails
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('generated_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        throw deleteError;
      }

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });

    } catch (error) {
      throw new HttpError(500, `Failed to delete document: ${error.message}`);
    }
  });

  // Get document generation statistics
  getStatistics = asyncHandler(async (req, res) => {
    const { caseId, timeframe = '30d' } = req.query;
    
    let dateFilter = new Date();
    switch (timeframe) {
      case '7d':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      case '90d':
        dateFilter.setDate(dateFilter.getDate() - 90);
        break;
      case '1y':
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
        break;
      default:
        dateFilter.setDate(dateFilter.getDate() - 30);
    }

    let query = supabase
      .from('generated_documents')
      .select('*')
      .gte('created_at', dateFilter.toISOString());

    if (caseId) {
      query = query.eq('case_id', caseId);
    }

    const { data: documents, error } = await query;

    if (error) {
      throw new HttpError(500, 'Failed to fetch statistics');
    }

    // Calculate statistics
    const stats = {
      total_documents: documents.length,
      by_format: {},
      by_type: {},
      by_status: {},
      total_file_size: 0,
      recent_activity: []
    };

    documents.forEach(doc => {
      // By format
      stats.by_format[doc.file_format] = (stats.by_format[doc.file_format] || 0) + 1;
      
      // By type
      stats.by_type[doc.document_type] = (stats.by_type[doc.document_type] || 0) + 1;
      
      // By status
      stats.by_status[doc.status] = (stats.by_status[doc.status] || 0) + 1;
      
      // Total file size
      stats.total_file_size += doc.file_size || 0;
    });

    // Recent activity (last 10 documents)
    stats.recent_activity = documents
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.document_type,
        format: doc.file_format,
        created_at: doc.created_at
      }));

    res.json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: {
        timeframe,
        caseId: caseId || 'all',
        statistics: stats
      }
    });
  });

  // Service health check
  healthCheck = asyncHandler(async (req, res) => {
    const health = await documentGeneratorService.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  });

  // Helper methods
  getMimeType(format) {
    const mimeTypes = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      html: 'text/html',
      txt: 'text/plain'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  contentToHTML(content) {
    if (!content || !content.sections) {
      return '<p>No content available</p>';
    }

    const sections = content.sections.map(section => `
      <section style="margin-bottom: 2em;">
        <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1em; text-align: center;">
          ${this.escapeHTML(section.title)}
        </h2>
        <div style="text-align: justify; line-height: 1.6;">
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
    <title>Document Preview</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
            color: #000;
            background: #fff;
        }
    </style>
</head>
<body>
    ${sections}
    <div style="margin-top: 3em; text-align: center; font-style: italic; color: #666;">
        Generated on ${new Date().toLocaleDateString()}
    </div>
</body>
</html>`;
  }

  formatContentHTML(content) {
    if (!content) return '';
    
    return content
      .split('\n\n')
      .map(paragraph => `<p style="margin-bottom: 1em;">${this.escapeHTML(paragraph.trim())}</p>`)
      .join('');
  }

  escapeHTML(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

module.exports = new DocumentController();