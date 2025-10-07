'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, Clock, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface SignatureStatus {
  signatureId: string;
  userId: string;
  partyRole: string;
  status: string;
  signedAt: string | null;
  user: {
    fullName: string;
    email: string;
  };
}

interface ESignatureProps {
  caseId: string;
  documentId: string;
}

export default function ESignature({ caseId, documentId }: ESignatureProps) {
  const [signatures, setSignatures] = useState<SignatureStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [signatureId, setSignatureId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSignatureStatus();
  }, [caseId]);

  const loadSignatureStatus = async () => {
    try {
      setLoading(true);
      const response = await apiRequest.get<any>(`/disputes/${caseId}/signature-status`);
      setSignatures(response.signatures || []);
    } catch (error) {
      console.error('Error loading signature status:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestSignature = async () => {
    try {
      setRequestingOtp(true);
      setError(null);

      const response = await apiRequest.post<any>(
        `/disputes/${caseId}/request-signature`,
        {
          documentId,
          signatureType: 'otp'
        }
      );

      setSignatureId(response.signatureId);
      setOtpSent(true);
      setSuccess('OTP sent to your registered email/phone!');
    } catch (error: any) {
      setError(error.message || 'Failed to request signature');
    } finally {
      setRequestingOtp(false);
    }
  };

  const verifyAndSign = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      await apiRequest.post<any>(
        `/disputes/signatures/${signatureId}/verify`,
        {
          otp,
          metadata: {
            ipAddress: window.location.hostname,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        }
      );

      setSuccess('Document signed successfully! ✓');
      setOtp('');
      setOtpSent(false);
      setSignatureId(null);

      // Reload signature status
      setTimeout(() => {
        loadSignatureStatus();
      }, 1000);

    } catch (error: any) {
      setError(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (!signatureId) return;

    try {
      setRequestingOtp(true);
      setError(null);

      await apiRequest.post<any>(
        `/disputes/signatures/${signatureId}/resend-otp`,
        {}
      );

      setSuccess('New OTP sent!');
    } catch (error: any) {
      setError(error.message || 'Failed to resend OTP');
    } finally {
      setRequestingOtp(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'expired':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Shield className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-600">Loading signature status...</span>
      </div>
    );
  }

  const allSigned = signatures.every(sig => sig.status === 'signed');
  const mySignature = signatures.find(sig => sig.userId === 'current-user-id'); // Replace with actual user ID

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {allSigned ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center text-green-800">
            <CheckCircle className="w-6 h-6 mr-3" />
            <div>
              <h3 className="font-semibold">All Parties Have Signed!</h3>
              <p className="text-sm text-green-700 mt-1">
                The settlement agreement is now legally binding.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center text-blue-800">
            <Shield className="w-6 h-6 mr-3" />
            <div>
              <h3 className="font-semibold">E-Signature Required</h3>
              <p className="text-sm text-blue-700 mt-1">
                Waiting for all parties to sign the settlement document.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Signature Status List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Signature Status</h3>
        
        {signatures.map((sig) => (
          <div
            key={sig.signatureId}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(sig.status)}
                <div>
                  <h4 className="font-medium text-gray-900">{sig.user.fullName}</h4>
                  <p className="text-sm text-gray-600">{sig.partyRole}</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(sig.status)}`}>
                {sig.status.charAt(0).toUpperCase() + sig.status.slice(1)}
              </span>
            </div>

            {sig.signedAt && (
              <div className="mt-2 text-xs text-gray-500">
                Signed on {new Date(sig.signedAt).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* OTP Signing Section */}
      {!otpSent && mySignature?.status === 'pending' && (
        <div className="border-t pt-6">
          <button
            onClick={requestSignature}
            disabled={requestingOtp}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center"
          >
            {requestingOtp ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                Sign Document with OTP
              </>
            )}
          </button>
          <p className="text-xs text-gray-600 mt-2 text-center">
            An OTP will be sent to your registered email/phone for verification
          </p>
        </div>
      )}

      {otpSent && (
        <div className="border-t pt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter 6-Digit OTP
            </label>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-600 mt-2">
              OTP expires in 10 minutes
            </p>
          </div>

          <button
            onClick={verifyAndSign}
            disabled={verifying || otp.length !== 6}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center"
          >
            {verifying ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Verify & Sign Document
              </>
            )}
          </button>

          <button
            onClick={resendOtp}
            disabled={requestingOtp}
            className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Resend OTP
          </button>
        </div>
      )}

      {/* Legal Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
        <strong>Legal Notice:</strong> By signing this document, you agree to the terms of the settlement agreement.
        Your digital signature is legally binding under the Information Technology Act, 2000.
      </div>
    </div>
  );
}
