// Evidence Model - Handle evidence operations
const BaseModel = require('./BaseModel');

class Evidence extends BaseModel {
  constructor() {
    super('evidence');
  }

  // Create evidence with file processing
  async createEvidence(evidenceData) {
    try {
      // Validate required fields
      if (!evidenceData.case_id || !evidenceData.uploader_id || !evidenceData.file_path) {
        throw new Error('Case ID, uploader ID, and file path are required');
      }

      const evidence = await this.create({
        case_id: evidenceData.case_id,
        uploader_id: evidenceData.uploader_id,
        file_path: evidenceData.file_path,
        file_name: evidenceData.file_name,
        file_size: evidenceData.file_size,
        mime_type: evidenceData.mime_type,
        sha256: evidenceData.sha256,
        description: evidenceData.description,
        evidence_type: evidenceData.evidence_type || 'document',
        statement_id: evidenceData.statement_id || null, // Link to statement if attached
        metadata: evidenceData.metadata || {},
        status: 'pending',
        is_confidential: evidenceData.is_confidential || false,
        access_permissions: evidenceData.access_permissions || {},
        tags: evidenceData.tags || []
      });

      // Create timeline entry
      await this.supabase.from('case_timeline').insert({
        case_id: evidenceData.case_id,
        event_type: 'evidence_uploaded',
        event_title: 'Evidence Uploaded',
        event_description: `New evidence "${evidenceData.file_name}" has been uploaded`,
        actor_id: evidenceData.uploader_id,
        is_public: true,
        metadata: { evidence_id: evidence.id, file_type: evidenceData.mime_type }
      });

      // Emit real-time update
      const realTimeService = require('../services/RealTimeService');
      realTimeService.broadcastToCaseRoom(evidenceData.case_id, 'evidence_uploaded', {
        evidenceId: evidence.id,
        fileName: evidenceData.file_name,
        fileType: evidenceData.mime_type,
        uploaderId: evidenceData.uploader_id,
        statementId: evidenceData.statement_id,
        createdAt: evidence.created_at
      });

      return evidence;
    } catch (error) {
      throw new Error(`Failed to create evidence: ${error.message}`);
    }
  }

  // Get evidence for a case
  async getCaseEvidence(caseId) {
    try {
      return await this.findMany(
        { case_id: caseId },
        { orderBy: 'created_at', ascending: false }
      );
    } catch (error) {
      throw new Error(`Failed to get case evidence: ${error.message}`);
    }
  }

  // Update evidence processing status
  async updateProcessingStatus(evidenceId, status, results = {}) {
    try {
      const updated = await this.updateById(evidenceId, {
        status,
        processing_results: results,
        ocr_text: results.ocr_text,
        transcription: results.transcription,
        ai_summary: results.ai_summary,
        ai_relevance_score: results.ai_relevance_score,
        ai_key_points: results.ai_key_points
      });

      // Emit real-time update for processing completion
      if (status === 'processed') {
        const realTimeService = require('../services/RealTimeService');
        realTimeService.broadcastToCaseRoom(updated.case_id, 'evidence_processed', {
          evidenceId,
          status,
          aiSummary: results.ai_summary,
          relevanceScore: results.ai_relevance_score
        });
      }

      return updated;
    } catch (error) {
      throw new Error(`Failed to update evidence status: ${error.message}`);
    }
  }

  // Get evidence attached to a specific statement
  async getStatementEvidence(statementId) {
    try {
      const { data: attachments, error } = await this.supabase
        .from('statement_evidence')
        .select(`
          evidence_id,
          attached_at,
          evidence (*)
        `)
        .eq('statement_id', statementId)
        .order('attached_at', { ascending: true });

      if (error) throw error;

      return attachments?.map(att => ({
        ...att.evidence,
        attached_at: att.attached_at
      })) || [];
    } catch (error) {
      throw new Error(`Failed to get statement evidence: ${error.message}`);
    }
  }

  // Get evidence by party type (complainer/defender)
  async getEvidenceByParty(caseId, partyType) {
    try {
      // Get case to determine party user IDs
      const Case = require('./Case');
      const caseData = await Case.findById(caseId);
      if (!caseData) throw new Error('Case not found');

      let uploaderIds = [];
      if (partyType === 'complainer') {
        uploaderIds = [caseData.filed_by];
      } else if (partyType === 'defender') {
        // Get defender user ID if they have registered
        const { data: defenderUser } = await this.supabase
          .from('users')
          .select('id')
          .eq('email', caseData.defender_email)
          .single();
        
        if (defenderUser) {
          uploaderIds = [defenderUser.id];
        }
      }

      if (uploaderIds.length === 0) {
        return [];
      }

      const { data: evidence, error } = await this.supabase
        .from('evidence')
        .select('*')
        .eq('case_id', caseId)
        .in('uploader_id', uploaderIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return evidence || [];
    } catch (error) {
      throw new Error(`Failed to get party evidence: ${error.message}`);
    }
  }

  // Bulk upload evidence files
  async bulkCreateEvidence(evidenceArray) {
    try {
      const results = [];
      
      for (const evidenceData of evidenceArray) {
        try {
          const evidence = await this.createEvidence(evidenceData);
          results.push({ success: true, evidence });
        } catch (error) {
          results.push({ success: false, error: error.message, data: evidenceData });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to bulk create evidence: ${error.message}`);
    }
  }

  // Check user access to evidence
  async checkEvidenceAccess(evidenceId, userId) {
    try {
      const evidence = await this.findById(evidenceId);
      if (!evidence) return false;

      // Check if user has access to the case
      const Case = require('./Case');
      return await Case.checkUserAccess(evidence.case_id, userId);
    } catch (error) {
      return false;
    }
  }

  // Get evidence download URL with access control
  async getSecureDownloadUrl(evidenceId, userId) {
    try {
      const hasAccess = await this.checkEvidenceAccess(evidenceId, userId);
      if (!hasAccess) {
        throw new Error('Access denied to evidence');
      }

      const evidence = await this.findById(evidenceId);
      if (!evidence) {
        throw new Error('Evidence not found');
      }

      // Generate signed URL (implementation depends on your storage solution)
      const { createSignedUrl } = require('../lib/storageHelper');
      const signedUrl = await createSignedUrl(evidence.file_path, 3600); // 1 hour expiry

      return {
        url: signedUrl,
        fileName: evidence.file_name,
        mimeType: evidence.mime_type,
        fileSize: evidence.file_size,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      };
    } catch (error) {
      throw new Error(`Failed to get download URL: ${error.message}`);
    }
  }

  // Get evidence statistics for a case
  async getEvidenceStats(caseId) {
    try {
      const { data: evidence, error } = await this.supabase
        .from('evidence')
        .select('evidence_type, file_size, mime_type, uploader_id, created_at')
        .eq('case_id', caseId);

      if (error) throw error;

      const stats = {
        total: evidence.length,
        totalSize: evidence.reduce((sum, e) => sum + (e.file_size || 0), 0),
        byType: {},
        byUploader: {},
        recentUploads: evidence
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5)
      };

      // Count by evidence type
      evidence.forEach(e => {
        const type = e.evidence_type || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      // Count by uploader
      evidence.forEach(e => {
        const uploader = e.uploader_id;
        stats.byUploader[uploader] = (stats.byUploader[uploader] || 0) + 1;
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get evidence statistics: ${error.message}`);
    }
  }
}

module.exports = new Evidence();