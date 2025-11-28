// E-Signature Service - Complete digital signature system with validation
const crypto = require('crypto');
const jsrsasign = require('jsrsasign');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../lib/supabaseClient');
const logger = require('../lib/logger');

class ESignatureService {
  constructor() {
    this.algorithmType = 'RS256';
    this.keySize = 2048;
    this.certificateDir = path.join(__dirname, '../../storage/certificates');
    this.signatureDir = path.join(__dirname, '../../storage/signatures');
    this.init();
  }

  async init() {
    try {
      // Ensure directories exist
      await fs.mkdir(this.certificateDir, { recursive: true });
      await fs.mkdir(this.signatureDir, { recursive: true });
      logger.info('E-Signature service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize E-Signature service:', error);
    }
  }

  // Generate RSA key pair for digital signatures
  async generateKeyPair() {
    try {
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: this.keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      const keyId = uuidv4();
      
      // Store keys securely
      const publicKeyPath = path.join(this.certificateDir, `${keyId}_public.pem`);
      const privateKeyPath = path.join(this.certificateDir, `${keyId}_private.pem`);
      
      await fs.writeFile(publicKeyPath, keyPair.publicKey);
      await fs.writeFile(privateKeyPath, keyPair.privateKey);

      return {
        keyId,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        publicKeyPath,
        privateKeyPath
      };
    } catch (error) {
      logger.error('Error generating key pair:', error);
      throw new Error('Failed to generate cryptographic key pair');
    }
  }

  // Create digital certificate for user
  async createUserCertificate(userId, userInfo) {
    try {
      const { keyId, publicKey, privateKey } = await this.generateKeyPair();
      
      // Create certificate with user information
      const certificate = {
        keyId,
        userId,
        subject: {
          commonName: userInfo.fullName,
          emailAddress: userInfo.email,
          organizationName: userInfo.organization || 'Individual',
          countryName: userInfo.country || 'IN'
        },
        issuer: {
          commonName: 'AI Dispute Resolution Platform',
          organizationName: 'Legal Tech Solutions',
          countryName: 'IN'
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        serialNumber: Date.now().toString(),
        publicKey,
        algorithm: this.algorithmType
      };

      // Store certificate in database
      const { data, error } = await supabase
        .from('digital_certificates')
        .insert({
          id: keyId,
          user_id: userId,
          certificate_data: certificate,
          public_key: publicKey,
          status: 'active',
          created_at: new Date().toISOString(),
          expires_at: certificate.validTo.toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        certificateId: keyId,
        certificate,
        status: 'created'
      };
    } catch (error) {
      logger.error('Error creating user certificate:', error);
      throw new Error('Failed to create digital certificate');
    }
  }

  // Sign document with digital signature
  async signDocument(documentData, userId, certificateId, reason = 'Document approval') {
    try {
      // Get user's certificate and private key
      const { data: certificate, error } = await supabase
        .from('digital_certificates')
        .select('*')
        .eq('id', certificateId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error || !certificate) {
        throw new Error('Valid certificate not found');
      }

      // Load private key
      const privateKeyPath = path.join(this.certificateDir, `${certificateId}_private.pem`);
      const privateKey = await fs.readFile(privateKeyPath, 'utf8');

      // Create signature data
      const signatureData = {
        documentHash: this.hashDocument(documentData),
        timestamp: new Date().toISOString(),
        signerInfo: certificate.certificate_data.subject,
        reason,
        location: 'Digital Platform',
        certificateId
      };

      // Generate digital signature
      const dataToSign = JSON.stringify(signatureData);
      const signature = crypto.sign('sha256', Buffer.from(dataToSign), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING
      });

      const signatureRecord = {
        id: uuidv4(),
        document_id: documentData.id,
        user_id: userId,
        certificate_id: certificateId,
        signature_data: signatureData,
        signature_value: signature.toString('base64'),
        timestamp: signatureData.timestamp,
        reason,
        status: 'valid',
        created_at: new Date().toISOString()
      };

      // Store signature in database
      const { data: savedSignature, error: signatureError } = await supabase
        .from('digital_signatures')
        .insert(signatureRecord)
        .select()
        .single();

      if (signatureError) throw signatureError;

      // Save signature file
      const signatureFilePath = path.join(this.signatureDir, `${signatureRecord.id}.sig`);
      await fs.writeFile(signatureFilePath, JSON.stringify(signatureRecord, null, 2));

      return {
        signatureId: signatureRecord.id,
        signature: signatureRecord,
        verified: true,
        timestamp: signatureData.timestamp
      };
    } catch (error) {
      logger.error('Error signing document:', error);
      throw new Error('Failed to create digital signature');
    }
  }

  // Verify digital signature
  async verifySignature(signatureId) {
    try {
      // Get signature record
      const { data: signature, error } = await supabase
        .from('digital_signatures')
        .select(`
          *,
          digital_certificates (
            public_key,
            certificate_data,
            status
          )
        `)
        .eq('id', signatureId)
        .single();

      if (error || !signature) {
        throw new Error('Signature not found');
      }

      // Check certificate validity
      const certificate = signature.digital_certificates;
      if (certificate.status !== 'active') {
        return {
          valid: false,
          reason: 'Certificate is not active',
          signature
        };
      }

      // Verify signature
      const dataToVerify = JSON.stringify(signature.signature_data);
      const signatureBuffer = Buffer.from(signature.signature_value, 'base64');
      
      const isValid = crypto.verify(
        'sha256',
        Buffer.from(dataToVerify),
        {
          key: certificate.public_key,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING
        },
        signatureBuffer
      );

      return {
        valid: isValid,
        signature,
        certificate: certificate.certificate_data,
        timestamp: signature.timestamp,
        reason: signature.reason
      };
    } catch (error) {
      logger.error('Error verifying signature:', error);
      return {
        valid: false,
        reason: 'Verification failed',
        error: error.message
      };
    }
  }

  // Hash document for integrity verification
  hashDocument(documentData) {
    const content = typeof documentData === 'object' 
      ? JSON.stringify(documentData) 
      : documentData.toString();
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Get user's certificates
  async getUserCertificates(userId) {
    try {
      const { data, error } = await supabase
        .from('digital_certificates')
        .select('id, certificate_data, status, created_at, expires_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(cert => ({
        id: cert.id,
        commonName: cert.certificate_data.subject.commonName,
        email: cert.certificate_data.subject.emailAddress,
        status: cert.status,
        validFrom: cert.certificate_data.validFrom,
        validTo: cert.certificate_data.validTo,
        createdAt: cert.created_at
      }));
    } catch (error) {
      logger.error('Error getting user certificates:', error);
      throw new Error('Failed to retrieve certificates');
    }
  }

  // Revoke certificate
  async revokeCertificate(certificateId, userId, reason = 'User requested') {
    try {
      const { data, error } = await supabase
        .from('digital_certificates')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revocation_reason: reason
        })
        .eq('id', certificateId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        certificateId,
        status: 'revoked',
        reason,
        revokedAt: data.revoked_at
      };
    } catch (error) {
      logger.error('Error revoking certificate:', error);
      throw new Error('Failed to revoke certificate');
    }
  }

  // Get signature statistics
  async getSignatureStats(userId = null) {
    try {
      let query = supabase
        .from('digital_signatures')
        .select('status, created_at, reason');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        valid: data.filter(s => s.status === 'valid').length,
        revoked: data.filter(s => s.status === 'revoked').length,
        today: data.filter(s => 
          new Date(s.created_at).toDateString() === new Date().toDateString()
        ).length,
        byReason: {}
      };

      data.forEach(sig => {
        stats.byReason[sig.reason] = (stats.byReason[sig.reason] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting signature statistics:', error);
      throw new Error('Failed to get signature statistics');
    }
  }
}

module.exports = new ESignatureService();