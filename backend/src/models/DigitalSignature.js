// Digital Signature Model - Handle digital signature operations
const BaseModel = require('./BaseModel');

class DigitalSignature extends BaseModel {
  constructor() {
    super('digital_signatures');
  }

  // Create digital signature record
  async createSignature(signatureData) {
    try {
      const signature = await this.create({
        case_id: signatureData.case_id,
        document_type: signatureData.document_type,
        document_content: signatureData.document_content,
        document_hash: signatureData.document_hash,
        signer_id: signatureData.signer_id,
        signer_name: signatureData.signer_name,
        signer_email: signatureData.signer_email,
        signature_method: signatureData.signature_method || 'electronic',
        signature_data: signatureData.signature_data || {},
        signed_at: signatureData.signed_at || new Date().toISOString(),
        verification_code: signatureData.verification_code,
        is_valid: true,
        metadata: signatureData.metadata || {}
      });

      return signature;
    } catch (error) {
      throw new Error(`Failed to create digital signature: ${error.message}`);
    }
  }

  // Get signatures for a case
  async getCaseSignatures(caseId) {
    try {
      return await this.findMany(
        { case_id: caseId },
        { orderBy: 'signed_at', ascending: false }
      );
    } catch (error) {
      throw new Error(`Failed to get case signatures: ${error.message}`);
    }
  }

  // Verify signature
  async verifySignature(signatureId, verificationCode) {
    try {
      const signature = await this.findById(signatureId);
      if (!signature) {
        throw new Error('Signature not found');
      }

      if (signature.verification_code === verificationCode) {
        return await this.updateById(signatureId, {
          metadata: {
            ...signature.metadata,
            verified_at: new Date().toISOString()
          }
        });
      } else {
        throw new Error('Invalid verification code');
      }
    } catch (error) {
      throw new Error(`Failed to verify signature: ${error.message}`);
    }
  }
}

module.exports = new DigitalSignature();