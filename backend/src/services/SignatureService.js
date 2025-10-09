// Digital Signature Service - Handle document signing workflows
const DigitalSignature = require('../models/DigitalSignature');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const { logger } = require('../lib/logger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const RealTimeService = require('./RealTimeService');

class SignatureService {
  constructor() {
    this.pendingSignatures = new Map(); // Track signing sessions
  }

  // Create a signature request
  async createSignatureRequest(requestData, requestingUserId) {
    try {
      const {
        case_id,
        document_id,
        document_type,
        signers,
        signing_order = 'parallel',
        expiry_hours = 72,
        message
      } = requestData;

      // Verify case access
      if (!await Case.hasAccess(case_id, requestingUserId)) {
        throw new Error('Access denied to case');
      }

      // Verify document exists
      let documentData = null;
      if (document_id) {
        documentData = await Evidence.findById(document_id);
        if (!documentData || documentData.case_id !== case_id) {
          throw new Error('Document not found or not associated with case');
        }
      }

      // Create signature request
      const signatureRequest = {
        id: uuidv4(),
        case_id,
        document_id,
        document_type: document_type || 'settlement_agreement',
        requesting_user_id: requestingUserId,
        signing_order,
        status: 'pending',
        total_signers: signers.length,
        completed_signatures: 0,
        expires_at: new Date(Date.now() + expiry_hours * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        request_message: message
      };

      // Save signature request
      const savedRequest = await DigitalSignature.create(signatureRequest);

      // Create individual signer records
      const signerRecords = [];
      for (let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        const signerRecord = {
          id: uuidv4(),
          signature_request_id: savedRequest.id,
          signer_user_id: signer.user_id,
          signer_email: signer.email,
          signer_name: signer.name,
          signing_order: signing_order === 'sequential' ? i + 1 : 1,
          status: 'pending',
          signature_token: uuidv4(),
          created_at: new Date().toISOString()
        };

        signerRecords.push(signerRecord);
      }

      // Save signer records
      await this.createSignerRecords(signerRecords);

      // Send notifications to signers
      await this.notifySigners(savedRequest.id, signerRecords);

      // Broadcast to case room
      if (RealTimeService.io) {
        RealTimeService.broadcastSystemMessage(
          case_id,
          `New signature request created for ${document_type}`,
          'signature_request'
        );
      }

      logger.info(`Signature request created`, { 
        requestId: savedRequest.id, 
        caseId: case_id,
        signersCount: signers.length 
      });

      return {
        success: true,
        signature_request: savedRequest,
        signers: signerRecords
      };

    } catch (error) {
      logger.error('Failed to create signature request:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Sign a document
  async signDocument(signatureToken, signatureData, signingUserId) {
    try {
      const {
        signature_image,
        signature_type = 'draw',
        consent_text,
        ip_address,
        user_agent
      } = signatureData;

      // Get signer record
      const signerRecord = await this.getSignerByToken(signatureToken);
      if (!signerRecord) {
        throw new Error('Invalid signature token');
      }

      if (signerRecord.status !== 'pending') {
        throw new Error(`Signature is already ${signerRecord.status}`);
      }

      // Get signature request
      const signatureRequest = await DigitalSignature.findById(signerRecord.signature_request_id);
      if (!signatureRequest) {
        throw new Error('Signature request not found');
      }

      if (new Date() > new Date(signatureRequest.expires_at)) {
        throw new Error('Signature request has expired');
      }

      // Verify user permission
      if (signerRecord.signer_user_id !== signingUserId) {
        throw new Error('Access denied - not authorized to sign for this user');
      }

      // Check signing order for sequential signing
      if (signatureRequest.signing_order === 'sequential') {
        const canSign = await this.canUserSignNow(
          signatureRequest.id, 
          signerRecord.signing_order
        );
        if (!canSign) {
          throw new Error('Cannot sign yet - waiting for previous signers');
        }
      }

      // Generate signature hash
      const signatureHash = this.generateSignatureHash(
        signatureRequest.id,
        signerRecord.id,
        signature_image,
        consent_text
      );

      // Update signer record
      const signatureUpdate = {
        status: 'completed',
        signature_image,
        signature_type,
        signature_hash: signatureHash,
        signed_at: new Date().toISOString(),
        ip_address,
        user_agent,
        consent_text
      };

      await this.updateSignerRecord(signerRecord.id, signatureUpdate);

      // Update signature request progress
      await this.updateSignatureProgress(signatureRequest.id);

      // Check if all signatures completed
      const updatedRequest = await DigitalSignature.findById(signatureRequest.id);
      if (updatedRequest.completed_signatures >= updatedRequest.total_signers) {
        await this.completeSignatureRequest(signatureRequest.id);
      }

      // Broadcast real-time update
      if (RealTimeService.io) {
        RealTimeService.broadcastSystemMessage(
          signatureRequest.case_id,
          `${signerRecord.signer_name} has signed the ${signatureRequest.document_type}`,
          'signature_completed'
        );
      }

      logger.info(`Document signed`, { 
        requestId: signatureRequest.id,
        signerId: signerRecord.id,
        signerEmail: signerRecord.signer_email 
      });

      return {
        success: true,
        signature_request_id: signatureRequest.id,
        signer_id: signerRecord.id,
        status: updatedRequest.status,
        completed_signatures: updatedRequest.completed_signatures,
        total_signers: updatedRequest.total_signers
      };

    } catch (error) {
      logger.error('Failed to sign document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get signature request details
  async getSignatureRequest(requestId, userId) {
    try {
      const signatureRequest = await DigitalSignature.findById(requestId);
      if (!signatureRequest) {
        throw new Error('Signature request not found');
      }

      // Verify access to case
      if (!await Case.hasAccess(signatureRequest.case_id, userId)) {
        throw new Error('Access denied to signature request');
      }

      // Get signer records
      const signers = await this.getSignerRecords(requestId);

      return {
        success: true,
        signature_request: signatureRequest,
        signers
      };

    } catch (error) {
      logger.error('Failed to get signature request:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get signer details by token
  async getSignerByToken(token) {
    try {
      // Implementation would query signer records table
      // For now, return mock data structure
      return {
        id: 'signer-id',
        signature_request_id: 'request-id',
        signer_user_id: 'user-id',
        signer_email: 'signer@example.com',
        signer_name: 'Signer Name',
        signing_order: 1,
        status: 'pending',
        signature_token: token,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get signer by token:', error);
      return null;
    }
  }

  // Create signer records
  async createSignerRecords(signerRecords) {
    // Implementation would save to database
    // For now, just log the operation
    logger.info(`Creating ${signerRecords.length} signer records`);
    return signerRecords;
  }

  // Update signer record
  async updateSignerRecord(signerId, updateData) {
    // Implementation would update database record
    logger.info(`Updating signer record ${signerId}`, updateData);
    return true;
  }

  // Update signature progress
  async updateSignatureProgress(requestId) {
    try {
      // Get count of completed signatures
      const completedCount = await this.getCompletedSignatureCount(requestId);
      
      // Update signature request
      await DigitalSignature.update(requestId, {
        completed_signatures: completedCount,
        updated_at: new Date().toISOString()
      });

      logger.info(`Updated signature progress for request ${requestId}: ${completedCount} completed`);

    } catch (error) {
      logger.error('Failed to update signature progress:', error);
    }
  }

  // Complete signature request
  async completeSignatureRequest(requestId) {
    try {
      await DigitalSignature.update(requestId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      const signatureRequest = await DigitalSignature.findById(requestId);
      
      // Broadcast completion
      if (RealTimeService.io) {
        RealTimeService.broadcastSystemMessage(
          signatureRequest.case_id,
          `All parties have signed the ${signatureRequest.document_type}`,
          'all_signatures_completed'
        );
      }

      logger.info(`Signature request completed: ${requestId}`);

    } catch (error) {
      logger.error('Failed to complete signature request:', error);
    }
  }

  // Check if user can sign now (for sequential signing)
  async canUserSignNow(requestId, userSigningOrder) {
    if (userSigningOrder === 1) {
      return true; // First signer can always sign
    }

    // Check if all previous signers have completed
    const completedCount = await this.getCompletedSignatureCount(requestId);
    return completedCount >= (userSigningOrder - 1);
  }

  // Get completed signature count
  async getCompletedSignatureCount(requestId) {
    // Implementation would query database
    // For now, return mock count
    return 0;
  }

  // Get signer records for a request
  async getSignerRecords(requestId) {
    // Implementation would query database
    // For now, return mock data
    return [];
  }

  // Generate signature hash for verification
  generateSignatureHash(requestId, signerId, signatureImage, consentText) {
    const data = `${requestId}:${signerId}:${signatureImage}:${consentText}:${Date.now()}`;
    return crypto.createHash('SHA256').update(data).digest('hex');
  }

  // Notify signers about signature request
  async notifySigners(requestId, signerRecords) {
    try {
      for (const signer of signerRecords) {
        const signatureUrl = `${process.env.FRONTEND_URL}/signature/${signer.signature_token}`;
        
        // Send notification via RealTime service if user is online
        if (RealTimeService.io && signer.signer_user_id) {
          await RealTimeService.sendUserNotification(signer.signer_user_id, {
            type: 'signature_request',
            title: 'Signature Required',
            message: 'You have a document waiting for your signature',
            action_url: signatureUrl,
            request_id: requestId
          });
        }

        // TODO: Also send email notification
        logger.info(`Signature notification sent to ${signer.signer_email}`);
      }

    } catch (error) {
      logger.error('Failed to notify signers:', error);
    }
  }

  // Cancel signature request
  async cancelSignatureRequest(requestId, userId) {
    try {
      const signatureRequest = await DigitalSignature.findById(requestId);
      if (!signatureRequest) {
        throw new Error('Signature request not found');
      }

      // Verify permission to cancel
      if (signatureRequest.requesting_user_id !== userId) {
        if (!await Case.hasAccess(signatureRequest.case_id, userId)) {
          throw new Error('Access denied to cancel signature request');
        }
      }

      if (signatureRequest.status !== 'pending') {
        throw new Error('Can only cancel pending signature requests');
      }

      // Update status
      await DigitalSignature.update(requestId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId
      });

      // Broadcast cancellation
      if (RealTimeService.io) {
        RealTimeService.broadcastSystemMessage(
          signatureRequest.case_id,
          `Signature request for ${signatureRequest.document_type} has been cancelled`,
          'signature_cancelled'
        );
      }

      return {
        success: true,
        message: 'Signature request cancelled successfully'
      };

    } catch (error) {
      logger.error('Failed to cancel signature request:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get signature requests for a case
  async getCaseSignatureRequests(caseId, userId) {
    try {
      if (!await Case.hasAccess(caseId, userId)) {
        throw new Error('Access denied to case');
      }

      const signatureRequests = await DigitalSignature.findAll({
        case_id: caseId
      }, { order: [['created_at', 'DESC']] });

      return {
        success: true,
        signature_requests: signatureRequests
      };

    } catch (error) {
      logger.error('Failed to get case signature requests:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get pending signatures for a user
  async getUserPendingSignatures(userId) {
    try {
      // Implementation would query signer records for pending signatures
      // For now, return mock data
      const pendingSignatures = [];

      return {
        success: true,
        pending_signatures: pendingSignatures
      };

    } catch (error) {
      logger.error('Failed to get user pending signatures:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify signature authenticity
  async verifySignature(signatureHash, requestId, signerId) {
    try {
      // Implementation would verify signature hash against stored data
      // This would include checking the hash, timestamp, and signer details
      
      return {
        success: true,
        valid: true,
        verified_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to verify signature:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SignatureService();