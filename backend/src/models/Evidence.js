// Evidence Model - Handle evidence operations
const BaseModel = require('./BaseModel');

class Evidence extends BaseModel {
  constructor() {
    super('evidence');
  }

  // Create evidence with file processing
  async createEvidence(evidenceData) {
    try {
      const evidence = await this.create({
        case_id: evidenceData.case_id,
        uploader_id: evidenceData.uploader_id,
        file_path: evidenceData.file_path,
        file_name: evidenceData.file_name,
        file_size: evidenceData.file_size,
        mime_type: evidenceData.mime_type,
        sha256: evidenceData.sha256,
        metadata: evidenceData.metadata || {},
        status: 'pending',
        is_confidential: evidenceData.is_confidential || false,
        access_permissions: evidenceData.access_permissions || {},
        tags: evidenceData.tags || []
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
      return await this.updateById(evidenceId, {
        status,
        processing_results: results,
        ocr_text: results.ocr_text,
        transcription: results.transcription
      });
    } catch (error) {
      throw new Error(`Failed to update evidence status: ${error.message}`);
    }
  }
}

module.exports = new Evidence();