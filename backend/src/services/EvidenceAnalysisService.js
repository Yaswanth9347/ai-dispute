// Evidence Analysis Service - AI-powered evidence document analysis
const logger = require('../lib/logger');
const { supabaseAdmin } = require('../lib/supabaseClient');
const GeminiService = require('./GeminiService');
const fs = require('fs').promises;
const path = require('path');

class EvidenceAnalysisService {
  constructor() {
    this.SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    this.SUPPORTED_DOCUMENT_TYPES = ['application/pdf', 'text/plain'];
    this.SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    this.SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
  }

  /**
   * Analyze evidence document using AI
   */
  async analyzeEvidence(documentId, userId, caseId) {
    try {
      logger.info('Analyzing evidence document', { documentId, userId, caseId });

      // Get document details
      const { data: document, error: docError } = await supabaseAdmin
        .from('documents')
        .select(`
          document_id,
          case_id,
          file_name,
          file_path,
          file_type,
          file_size,
          document_type,
          uploaded_by,
          metadata
        `)
        .eq('document_id', documentId)
        .single();

      if (docError || !document) {
        throw new Error('Document not found');
      }

      // Verify user has access to this case
      const { data: party } = await supabaseAdmin
        .from('case_parties')
        .select('party_id')
        .eq('case_id', document.case_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!party && document.uploaded_by !== userId) {
        throw new Error('Unauthorized to analyze this document');
      }

      // Check if already analyzed
      const { data: existingAnalysis } = await supabaseAdmin
        .from('documents')
        .select('ai_analysis, analyzed_at, relevance_score')
        .eq('document_id', documentId)
        .single();

      if (existingAnalysis?.ai_analysis && existingAnalysis?.analyzed_at) {
        logger.info('Document already analyzed, returning existing analysis', { documentId });
        return {
          documentId: documentId,
          fileName: document.file_name,
          fileType: document.file_type,
          analysis: existingAnalysis.ai_analysis,
          relevanceScore: existingAnalysis.relevance_score,
          analyzedAt: existingAnalysis.analyzed_at,
          isNewAnalysis: false
        };
      }

      // Get case context
      const { data: caseData, error: caseError } = await supabaseAdmin
        .from('cases')
        .select(`
          case_id,
          case_title,
          case_number,
          dispute_type,
          dispute_amount,
          case_description
        `)
        .eq('case_id', document.case_id)
        .single();

      if (caseError || !caseData) {
        throw new Error('Case not found');
      }

      // Get statements for context
      const { data: statements } = await supabaseAdmin
        .from('statements')
        .select(`
          statement_id,
          statement_text,
          party_type,
          is_finalized
        `)
        .eq('case_id', document.case_id)
        .eq('is_finalized', true);

      // Perform analysis based on file type
      let analysis;
      if (this.SUPPORTED_IMAGE_TYPES.includes(document.file_type)) {
        analysis = await this.analyzeImage(document, caseData, statements);
      } else if (document.file_type === 'application/pdf') {
        analysis = await this.analyzePDF(document, caseData, statements);
      } else if (this.SUPPORTED_AUDIO_TYPES.includes(document.file_type)) {
        analysis = await this.analyzeAudio(document, caseData, statements);
      } else if (this.SUPPORTED_DOCUMENT_TYPES.includes(document.file_type)) {
        analysis = await this.analyzeTextDocument(document, caseData, statements);
      } else {
        throw new Error(`Unsupported file type: ${document.file_type}`);
      }

      // Store analysis results
      const { error: updateError } = await supabaseAdmin
        .from('documents')
        .update({
          ai_analysis: analysis.analysis,
          analyzed_at: new Date().toISOString(),
          relevance_score: analysis.relevanceScore,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      if (updateError) {
        logger.error('Failed to store analysis results', { error: updateError });
      }

      logger.info('Evidence analysis completed', { 
        documentId,
        relevanceScore: analysis.relevanceScore 
      });

      return {
        documentId: documentId,
        fileName: document.file_name,
        fileType: document.file_type,
        analysis: analysis.analysis,
        relevanceScore: analysis.relevanceScore,
        analyzedAt: new Date().toISOString(),
        isNewAnalysis: true
      };

    } catch (error) {
      logger.error('Error analyzing evidence:', error);
      throw error;
    }
  }

  /**
   * Analyze image evidence using Gemini Vision
   */
  async analyzeImage(document, caseData, statements) {
    try {
      logger.info('Analyzing image evidence', { documentId: document.document_id });

      // Read image file
      const filePath = path.join(process.cwd(), document.file_path);
      const imageBuffer = await fs.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');

      // Build context from statements
      const complainantStatement = statements?.find(s => s.party_type === 'complainant')?.statement_text || 'Not provided';
      const respondentStatement = statements?.find(s => s.party_type === 'respondent')?.statement_text || 'Not provided';

      // Create analysis prompt
      const prompt = `You are a legal evidence analyst reviewing image evidence for a dispute case.

**Case Details:**
- Case Title: ${caseData.case_title}
- Case Number: ${caseData.case_number}
- Dispute Type: ${caseData.dispute_type}
- Dispute Amount: ₹${caseData.dispute_amount || 'Not specified'}
- Description: ${caseData.case_description || 'Not provided'}

**Complainant's Statement:**
${complainantStatement}

**Respondent's Statement:**
${respondentStatement}

**Document Name:** ${document.file_name}

**Analysis Required:**
1. **What is shown in the image?** - Provide a detailed description of the image content
2. **Relevance to the case** - How does this evidence relate to the dispute?
3. **Key observations** - What important details are visible?
4. **Authenticity indicators** - Are there any signs of manipulation or authenticity markers?
5. **Supporting party** - Does this evidence favor the complainant or respondent, or is it neutral?
6. **Legal significance** - What legal weight does this evidence carry?
7. **Relevance score** - Rate the relevance from 1-10 (1=irrelevant, 10=highly relevant)

Provide your analysis in JSON format:
{
  "description": "Detailed description of image content",
  "relevance": "How this relates to the case",
  "keyObservations": ["observation1", "observation2", ...],
  "authenticity": "Assessment of authenticity",
  "favorsParty": "complainant/respondent/neutral",
  "legalSignificance": "Legal weight and implications",
  "relevanceScore": 1-10,
  "recommendations": "Recommendations for using this evidence"
}`;

      // Call Gemini Vision API
      const aiResponse = await GeminiService.analyzeImageWithPrompt(base64Image, prompt);

      // Parse response
      const analysis = this._parseAnalysisResponse(aiResponse);

      return {
        analysis,
        relevanceScore: analysis.relevanceScore || 5
      };

    } catch (error) {
      logger.error('Error analyzing image:', error);
      
      // Return fallback analysis
      return {
        analysis: {
          description: 'Image evidence uploaded',
          relevance: 'Requires manual review',
          keyObservations: ['AI analysis unavailable'],
          authenticity: 'Unable to verify',
          favorsParty: 'neutral',
          legalSignificance: 'Requires expert review',
          relevanceScore: 5,
          recommendations: 'Manual review recommended due to AI analysis failure'
        },
        relevanceScore: 5
      };
    }
  }

  /**
   * Analyze PDF document
   */
  async analyzePDF(document, caseData, statements) {
    try {
      logger.info('Analyzing PDF document', { documentId: document.document_id });

      // For PDFs, we'll extract text first (if possible) or use Gemini to analyze pages
      // For now, returning a structured analysis
      const analysis = {
        description: `PDF document: ${document.file_name}`,
        relevance: 'Document evidence submitted for case review',
        keyObservations: [
          'PDF document requires detailed review',
          `File size: ${(document.file_size / 1024).toFixed(2)} KB`
        ],
        authenticity: 'Digital document - verify original source',
        favorsParty: 'neutral',
        legalSignificance: 'Documentary evidence - admissible under Indian Evidence Act Section 65B',
        relevanceScore: 7,
        recommendations: 'Review document content for contractual obligations, agreements, or supporting evidence'
      };

      return { analysis, relevanceScore: 7 };

    } catch (error) {
      logger.error('Error analyzing PDF:', error);
      throw error;
    }
  }

  /**
   * Analyze audio evidence
   */
  async analyzeAudio(document, caseData, statements) {
    try {
      logger.info('Analyzing audio evidence', { documentId: document.document_id });

      const analysis = {
        description: `Audio recording: ${document.file_name}`,
        relevance: 'Audio evidence submitted for case review',
        keyObservations: [
          'Audio evidence requires transcription',
          `Duration: ${document.metadata?.duration || 'Unknown'}`,
          'Voice identification may be possible'
        ],
        authenticity: 'Audio file - verify recording metadata and chain of custody',
        favorsParty: 'neutral',
        legalSignificance: 'Audio evidence - admissible under Section 65B with certificate',
        relevanceScore: 8,
        recommendations: 'Transcribe audio content, verify recording authenticity, ensure compliance with Section 65B'
      };

      return { analysis, relevanceScore: 8 };

    } catch (error) {
      logger.error('Error analyzing audio:', error);
      throw error;
    }
  }

  /**
   * Analyze text document
   */
  async analyzeTextDocument(document, caseData, statements) {
    try {
      logger.info('Analyzing text document', { documentId: document.document_id });

      // Read text file
      const filePath = path.join(process.cwd(), document.file_path);
      const textContent = await fs.readFile(filePath, 'utf-8');

      // Build analysis prompt
      const complainantStatement = statements?.find(s => s.party_type === 'complainant')?.statement_text || 'Not provided';
      const respondentStatement = statements?.find(s => s.party_type === 'respondent')?.statement_text || 'Not provided';

      const prompt = `You are analyzing a text document as evidence in a legal dispute.

**Case Context:**
- Case: ${caseData.case_title}
- Dispute Type: ${caseData.dispute_type}
- Amount: ₹${caseData.dispute_amount || 'N/A'}

**Complainant Claims:**
${complainantStatement}

**Respondent Claims:**
${respondentStatement}

**Document Content:**
${textContent.substring(0, 5000)} ${textContent.length > 5000 ? '...(truncated)' : ''}

Analyze this document and provide:
1. Summary of document content
2. Relevance to the case (how it supports/contradicts claims)
3. Key facts extracted
4. Which party does this favor?
5. Legal significance
6. Relevance score (1-10)

Respond in JSON format:
{
  "description": "Document summary",
  "relevance": "How this relates to case",
  "keyObservations": ["fact1", "fact2"],
  "authenticity": "Assessment",
  "favorsParty": "complainant/respondent/neutral",
  "legalSignificance": "Legal implications",
  "relevanceScore": 1-10,
  "recommendations": "Usage recommendations"
}`;

      const aiResponse = await GeminiService.generateContent(prompt);
      const analysis = this._parseAnalysisResponse(aiResponse);

      return {
        analysis,
        relevanceScore: analysis.relevanceScore || 6
      };

    } catch (error) {
      logger.error('Error analyzing text document:', error);
      
      return {
        analysis: {
          description: 'Text document evidence',
          relevance: 'Requires manual review',
          keyObservations: ['Document uploaded successfully'],
          authenticity: 'Digital text file',
          favorsParty: 'neutral',
          legalSignificance: 'Documentary evidence',
          relevanceScore: 5,
          recommendations: 'Manual review recommended'
        },
        relevanceScore: 5
      };
    }
  }

  /**
   * Get all analyzed evidence for a case
   */
  async getCaseEvidenceAnalysis(caseId, userId) {
    try {
      logger.info('Getting case evidence analysis', { caseId, userId });

      // Verify user access
      const { data: party } = await supabaseAdmin
        .from('case_parties')
        .select('party_id')
        .eq('case_id', caseId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!party) {
        throw new Error('Unauthorized access to case evidence');
      }

      // Get all documents with analysis
      const { data: documents, error } = await supabaseAdmin
        .from('documents')
        .select(`
          document_id,
          file_name,
          file_type,
          file_size,
          document_type,
          ai_analysis,
          analyzed_at,
          relevance_score,
          uploaded_by,
          created_at
        `)
        .eq('case_id', caseId)
        .order('relevance_score', { ascending: false, nullsLast: true });

      if (error) {
        throw new Error(`Failed to get evidence: ${error.message}`);
      }

      const analyzed = documents.filter(d => d.ai_analysis);
      const unanalyzed = documents.filter(d => !d.ai_analysis);

      return {
        total: documents.length,
        analyzed: analyzed.length,
        unanalyzed: unanalyzed.length,
        documents: documents.map(d => ({
          documentId: d.document_id,
          fileName: d.file_name,
          fileType: d.file_type,
          fileSize: d.file_size,
          documentType: d.document_type,
          analysis: d.ai_analysis,
          analyzedAt: d.analyzed_at,
          relevanceScore: d.relevance_score,
          uploadedBy: d.uploaded_by,
          createdAt: d.created_at,
          isAnalyzed: !!d.ai_analysis
        }))
      };

    } catch (error) {
      logger.error('Error getting case evidence analysis:', error);
      throw error;
    }
  }

  /**
   * Parse AI analysis response
   */
  _parseAnalysisResponse(aiResponse) {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }

      // If no JSON found, create structured response from text
      return {
        description: aiResponse.substring(0, 500),
        relevance: 'AI analysis completed',
        keyObservations: ['See full analysis in description'],
        authenticity: 'Requires verification',
        favorsParty: 'neutral',
        legalSignificance: 'Review required',
        relevanceScore: 5,
        recommendations: 'Manual review recommended'
      };

    } catch (error) {
      logger.error('Error parsing analysis response:', error);
      
      return {
        description: 'Analysis completed but parsing failed',
        relevance: 'Requires manual review',
        keyObservations: ['AI response parsing error'],
        authenticity: 'Unable to verify',
        favorsParty: 'neutral',
        legalSignificance: 'Manual review required',
        relevanceScore: 5,
        recommendations: 'Expert review recommended'
      };
    }
  }

  /**
   * Bulk analyze all evidence for a case
   */
  async analyzeAllCaseEvidence(caseId, userId) {
    try {
      logger.info('Bulk analyzing all case evidence', { caseId, userId });

      // Get all unanalyzed documents
      const { data: documents, error } = await supabaseAdmin
        .from('documents')
        .select('document_id, file_name')
        .eq('case_id', caseId)
        .is('ai_analysis', null);

      if (error) {
        throw new Error(`Failed to get documents: ${error.message}`);
      }

      const results = [];

      for (const doc of documents) {
        try {
          const analysis = await this.analyzeEvidence(doc.document_id, userId, caseId);
          results.push({
            success: true,
            documentId: doc.document_id,
            fileName: doc.file_name,
            relevanceScore: analysis.relevanceScore
          });
        } catch (error) {
          results.push({
            success: false,
            documentId: doc.document_id,
            fileName: doc.file_name,
            error: error.message
          });
        }
      }

      logger.info('Bulk analysis completed', { 
        total: documents.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return {
        total: documents.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };

    } catch (error) {
      logger.error('Error in bulk evidence analysis:', error);
      throw error;
    }
  }
}

module.exports = new EvidenceAnalysisService();
