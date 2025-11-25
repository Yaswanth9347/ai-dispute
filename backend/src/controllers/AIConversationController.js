const { supabase } = require('../lib/supabaseClient');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/ai-documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt|jpg|jpeg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, TXT, JPG, PNG, WEBP files are allowed'));
    }
  }
});

/**
 * Get conversation history for a specific case
 */
const getConversationHistory = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user?.id || req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User ID not found',
      });
    }

    // Get conversation history
    const { data, error } = await supabase
      .from('ai_conversation_history')
      .select('*')
      .eq('case_id', caseId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch conversation history',
      });
    }

    // Format messages for frontend
    const messages = data.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.message,
      timestamp: row.created_at,
      attachments: row.attachments || [],
    }));

    return res.status(200).json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

/**
 * Save a conversation message
 */
const saveConversationMessage = async (req, res) => {
  try {
    const { caseId, message, role, attachments = [] } = req.body;
    const userId = req.user?.id || req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User ID not found',
      });
    }

    if (!caseId || !message || !role) {
      return res.status(400).json({
        success: false,
        error: 'caseId, message, and role are required',
      });
    }

    if (!['user', 'assistant'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'role must be either "user" or "assistant"',
      });
    }

    const { data, error } = await supabase
      .from('ai_conversation_history')
      .insert({
        case_id: caseId,
        user_id: userId,
        message,
        role,
        attachments,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save message',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        id: data.id,
        message: 'Message saved successfully',
      },
    });
  } catch (error) {
    console.error('Error in saveConversationMessage:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

/**
 * Analyze document content (PDF, image, text)
 */
const analyzeDocument = async (filePath, fileType) => {
  try {
    // Handle PDF files
    if (fileType === 'application/pdf' || filePath.endsWith('.pdf')) {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return {
        text: pdfData.text,
        pages: pdfData.numpages,
        summary: `Extracted ${pdfData.text.length} characters from ${pdfData.numpages} pages`,
      };
    }

    // Handle text files
    if (fileType === 'text/plain' || filePath.endsWith('.txt')) {
      const text = await fs.readFile(filePath, 'utf-8');
      return {
        text,
        summary: `Extracted ${text.length} characters from text file`,
      };
    }

    // Handle images with OCR
    if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(filePath)) {
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
      return {
        text,
        summary: `OCR extracted ${text.length} characters from image`,
      };
    }

    // Handle DOCX (if needed in future)
    // For now, return basic info
    return {
      text: '',
      summary: 'Document uploaded successfully (full text extraction not yet supported for this format)',
    };
  } catch (error) {
    console.error('Error analyzing document:', error);
    return {
      text: '',
      summary: `Error analyzing document: ${error.message}`,
    };
  }
};

/**
 * Upload and analyze files
 */
const uploadFiles = async (req, res) => {
  try {
    console.log('[AI Upload] Request received:', {
      hasFiles: !!req.files,
      filesCount: req.files?.length || 0,
      hasUser: !!req.user,
      userId: req.user?.id || req.user?.sub
    });

    const userId = req.user?.id || req.user?.sub;
    if (!userId) {
      console.error('[AI Upload] No user ID found');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User ID not found',
      });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      console.error('[AI Upload] No files in request');
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    console.log('[AI Upload] Processing', files.length, 'files');
    const processedFiles = [];

    for (const file of files) {
      console.log('[AI Upload] Analyzing file:', file.originalname);
      // Analyze the document
      const analysisResult = await analyzeDocument(file.path, file.mimetype);

      processedFiles.push({
        id: path.basename(file.path),
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        url: `/uploads/ai-documents/${path.basename(file.path)}`,
        analysisResult: analysisResult.text
          ? `📄 ${analysisResult.summary}\n\nExtracted Content:\n${analysisResult.text.substring(0, 1000)}${analysisResult.text.length > 1000 ? '...' : ''}`
          : analysisResult.summary,
      });
    }

    console.log('[AI Upload] Successfully processed', processedFiles.length, 'files');
    return res.status(200).json({
      success: true,
      data: {
        files: processedFiles,
      },
    });
  } catch (error) {
    console.error('[AI Upload] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload files',
    });
  }
};

module.exports = {
  getConversationHistory,
  saveConversationMessage,
  uploadFiles,
  upload, // Export multer middleware
};
