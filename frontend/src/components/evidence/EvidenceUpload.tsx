'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, Eye, Download } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  status: 'uploading' | 'analyzing' | 'completed' | 'error';
  analysis?: {
    summary: string;
    relevance: number;
    keyPoints: string[];
    extractedText?: string;
  };
}

interface EvidenceUploadProps {
  caseId: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
}

export default function EvidenceUpload({ caseId, onUploadComplete }: EvidenceUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);

    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading' as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Upload files sequentially
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const uploadedFile = newFiles[i];

      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caseId', caseId);
        formData.append('type', 'evidence');

        const token = localStorage.getItem('token');
        const uploadResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cases/${caseId}/evidence`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) throw new Error('Upload failed');

        const uploadData = await uploadResponse.json();

        // Update status to analyzing
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id ? { ...f, status: 'analyzing', url: uploadData.url } : f
          )
        );

        // Request AI analysis
        const analysisResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/ai/analyze-evidence`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              caseId,
              evidenceId: uploadData.data?.id,
              fileUrl: uploadData.url,
            }),
          }
        );

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();

          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? {
                    ...f,
                    status: 'completed',
                    analysis: analysisData.data,
                  }
                : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.id === uploadedFile.id ? { ...f, status: 'completed' } : f))
          );
        }
      } catch (error) {
        console.error('Upload error:', error);
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadedFile.id ? { ...f, status: 'error' } : f))
        );
      }
    }

    setUploading(false);
    onUploadComplete?.(newFiles);
  }, [caseId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        {isDragActive ? (
          <p className="text-blue-600 font-medium">Drop the files here...</p>
        ) : (
          <>
            <p className="text-gray-700 font-medium mb-2">
              Drag & drop evidence files here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Supports PDF, Images, Word documents (Max 10MB per file)
            </p>
          </>
        )}
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Uploaded Evidence</h3>
          {files.map((file) => (
            <div key={file.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3 flex-1">
                  <File className="w-10 h-10 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      {file.status === 'uploading' && (
                        <span className="flex items-center text-sm text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                          Uploading...
                        </span>
                      )}
                      {file.status === 'analyzing' && (
                        <span className="flex items-center text-sm text-purple-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2" />
                          AI Analyzing...
                        </span>
                      )}
                      {file.status === 'completed' && (
                        <span className="flex items-center text-sm text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Ready
                        </span>
                      )}
                      {file.status === 'error' && (
                        <span className="flex items-center text-sm text-red-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Upload failed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-gray-400 hover:text-red-600 ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* AI Analysis Results */}
              {file.analysis && (
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 flex items-center">
                      <span className="text-purple-600 mr-2">🤖</span>
                      AI Analysis Results
                    </h4>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Relevance:</span>
                      <div className="flex items-center">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              file.analysis.relevance >= 70
                                ? 'bg-green-500'
                                : file.analysis.relevance >= 40
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${file.analysis.relevance}%` }}
                          />
                        </div>
                        <span className="ml-2 text-sm font-semibold text-gray-900">
                          {file.analysis.relevance}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-3">{file.analysis.summary}</p>

                  {file.analysis.keyPoints && file.analysis.keyPoints.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Key Points:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {file.analysis.keyPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-gray-600">
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {file.analysis.extractedText && (
                    <details className="mt-3">
                      <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                        View Extracted Text
                      </summary>
                      <div className="mt-2 p-3 bg-white rounded border text-sm text-gray-600 max-h-40 overflow-y-auto">
                        {file.analysis.extractedText}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Actions */}
              {file.url && file.status === 'completed' && (
                <div className="mt-3 flex space-x-2">
                  <button className="flex items-center space-x-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                    <Eye className="w-4 h-4" />
                    <span>Preview</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100">
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
