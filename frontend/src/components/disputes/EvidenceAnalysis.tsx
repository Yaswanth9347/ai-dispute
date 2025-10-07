'use client';

import { useState, useEffect } from 'react';
import { FileText, Image, File, CheckCircle, AlertCircle, Loader2, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface EvidenceDocument {
  document_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  ai_analysis: string | null;
  analyzed_at: string | null;
  relevance_score: number | null;
}

interface EvidenceAnalysisProps {
  caseId: string;
}

export default function EvidenceAnalysis({ caseId }: EvidenceAnalysisProps) {
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<EvidenceDocument | null>(null);

  useEffect(() => {
    loadEvidenceDocuments();
  }, [caseId]);

  const loadEvidenceDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiRequest.get<any>(`/documents?caseId=${caseId}&type=evidence`);
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Error loading evidence:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDocument = async (documentId: string) => {
    try {
      setAnalyzing(documentId);
      const response = await apiRequest.post<any>(
        `/disputes/${caseId}/evidence/${documentId}/analyze`,
        {}
      );

      // Update document with analysis
      setDocuments(prev =>
        prev.map(doc =>
          doc.document_id === documentId
            ? { ...doc, ai_analysis: response.data.analysis, analyzed_at: new Date().toISOString() }
            : doc
        )
      );
    } catch (error) {
      console.error('Error analyzing document:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-6 h-6" />;
    if (fileType === 'application/pdf') return <FileText className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600">Loading evidence documents...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <File className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Evidence Documents</h3>
        <p className="text-gray-600">Upload evidence documents to support your case.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Evidence Analysis</h2>
        <span className="text-sm text-gray-600">{documents.length} document(s)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.document_id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 text-gray-400">
                {getFileIcon(doc.file_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {doc.file_name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {formatFileSize(doc.file_size)} • Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                </p>

                {doc.analyzed_at && (
                  <div className="mt-2 flex items-center text-xs text-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Analyzed by AI
                  </div>
                )}

                {doc.relevance_score !== null && (
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Relevance Score</span>
                      <span className="font-medium text-indigo-600">
                        {(doc.relevance_score * 10).toFixed(1)}/10
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full"
                        style={{ width: `${doc.relevance_score * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex space-x-2">
                  {!doc.ai_analysis && (
                    <button
                      onClick={() => analyzeDocument(doc.document_id)}
                      disabled={analyzing === doc.document_id}
                      className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                    >
                      {analyzing === doc.document_id ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        'Analyze with AI'
                      )}
                    </button>
                  )}
                  
                  <button
                    onClick={() => setSelectedDocument(doc)}
                    className="text-xs border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 flex items-center"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {doc.ai_analysis ? 'View Analysis' : 'View'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Analysis Detail Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedDocument.file_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatFileSize(selectedDocument.file_size)} • {selectedDocument.file_type}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {selectedDocument.ai_analysis ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center text-green-800 mb-2">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span className="font-medium">AI Analysis Complete</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Analyzed on {new Date(selectedDocument.analyzed_at!).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Analysis Results:</h4>
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                      {selectedDocument.ai_analysis}
                    </div>
                  </div>

                  {selectedDocument.relevance_score !== null && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <h4 className="font-medium text-indigo-900 mb-2">Relevance Assessment:</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-indigo-700">Case Relevance Score</span>
                        <span className="text-lg font-bold text-indigo-600">
                          {(selectedDocument.relevance_score * 10).toFixed(1)}/10
                        </span>
                      </div>
                      <div className="w-full bg-indigo-100 rounded-full h-2 mt-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${selectedDocument.relevance_score * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 mb-4">This document has not been analyzed yet.</p>
                  <button
                    onClick={() => {
                      analyzeDocument(selectedDocument.document_id);
                      setSelectedDocument(null);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Analyze with AI
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
