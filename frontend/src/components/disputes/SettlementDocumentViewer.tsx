// Settlement Document Viewer with Signature Interface
'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  X,
  Eye
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface SettlementDocument {
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  createdAt: string;
  documentType: string;
}

interface Signature {
  signatureId: string;
  signerUserId: string;
  signerEmail: string;
  signerName: string;
  signerRole: string;
  status: 'pending' | 'signed' | 'expired' | 'failed';
  signedAt?: string;
  expiresAt: string;
  isCurrentUser: boolean;
  canSign: boolean;
}

interface SignatureStatus {
  summary: {
    total: number;
    signed: number;
    pending: number;
    expired: number;
    failed: number;
    allSigned: boolean;
    completionPercentage: number;
  };
  signatures: Signature[];
}

interface SettlementDocumentViewerProps {
  caseId: string;
  onClose?: () => void;
}

export default function SettlementDocumentViewer({ caseId, onClose }: SettlementDocumentViewerProps) {
  const [document, setDocument] = useState<SettlementDocument | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPDF, setShowPDF] = useState(false);

  useEffect(() => {
    loadDocumentAndSignatures();
  }, [caseId]);

  const loadDocumentAndSignatures = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get settlement document
      const docResponse = await apiRequest.get<{ documents: SettlementDocument[] }>(
        `/api/documents?caseId=${caseId}&documentType=settlement_agreement`
      );

      if (docResponse.data?.documents && docResponse.data.documents.length > 0) {
        setDocument(docResponse.data.documents[0]);
      }

      // Get signature status
      const sigResponse = await apiRequest.get<SignatureStatus>(
        `/api/disputes/${caseId}/signature-status`
      );

      if (sigResponse.data) {
        setSignatureStatus(sigResponse.data);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    try {
      // Download the PDF
      window.open(`/api/documents/${document.documentId}/download`, '_blank');
    } catch (err: any) {
      setError('Failed to download document');
    }
  };

  const handleViewPDF = () => {
    setShowPDF(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'expired':
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settlement document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-800 font-semibold">Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={loadDocumentAndSignatures}
              className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-gray-700 font-semibold mb-1">No Settlement Document</h3>
        <p className="text-gray-600 text-sm">
          The settlement document has not been generated yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Document Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{document.fileName}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Generated on {new Date(document.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(document.fileSize / 1024).toFixed(2)} KB · {document.fileType}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleViewPDF}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Document
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Signature Status */}
      {signatureStatus && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Signature Status</h3>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Completion Progress</span>
                <span className="text-sm font-semibold text-gray-900">
                  {signatureStatus.summary.completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${signatureStatus.summary.completionPercentage}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>{signatureStatus.summary.signed} signed</span>
                <span>{signatureStatus.summary.pending} pending</span>
              </div>
            </div>

            {/* All Signed Celebration */}
            {signatureStatus.summary.allSigned && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-green-900 font-semibold">All Signatures Complete!</h4>
                    <p className="text-green-700 text-sm mt-1">
                      The settlement agreement has been fully executed by all parties.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Signature List */}
            <div className="space-y-3">
              {signatureStatus.signatures.map((signature) => (
                <div
                  key={signature.signatureId}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(signature.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{signature.signerName}</p>
                        {signature.isCurrentUser && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{signature.signerEmail}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Role: {signature.signerRole}
                      </p>
                      {signature.signedAt && (
                        <p className="text-xs text-green-600 mt-1">
                          Signed on {new Date(signature.signedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(signature.status)}`}>
                      {signature.status.charAt(0).toUpperCase() + signature.status.slice(1)}
                    </span>
                    {signature.status === 'pending' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Expires {new Date(signature.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {showPDF && document && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{document.fileName}</h3>
              <button
                onClick={() => setShowPDF(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe
                src={`/api/documents/${document.documentId}/view`}
                className="w-full h-full min-h-[600px]"
                title="Settlement Document"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
