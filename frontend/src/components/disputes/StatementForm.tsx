'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { FileText, Send, CheckCircle, AlertTriangle, Upload } from 'lucide-react';

interface StatementFormProps {
  caseId: string;
  onSuccess?: () => void;
}

export default function StatementForm({ caseId, onSuccess }: StatementFormProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingStatement, setExistingStatement] = useState<any>(null);
  const [isFinalized, setIsFinalized] = useState(false);

  useEffect(() => {
    loadExistingStatement();
  }, [caseId]);

  const loadExistingStatement = async () => {
    try {
      const data = await apiRequest.get<any>(`/disputes/${caseId}/statements/status`);
      if (data.success && data.data.parties) {
        // Find current user's statement
        const myStatement = data.data.parties.find((p: any) => p.hasStatement);
        if (myStatement) {
          setIsFinalized(myStatement.isFinalized);
          if (!myStatement.isFinalized) {
            // Load draft to continue editing
            // Would need additional endpoint to get user's own statement
          }
        }
      }
    } catch (error) {
      console.error('Failed to load existing statement:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (content.trim().length < 50) {
        throw new Error('Statement must be at least 50 characters long');
      }

      const response = await apiRequest.post<any>(`/disputes/${caseId}/statements`, {
        content,
        attachments
      });

      if (response.success) {
        setSuccess(true);
        setExistingStatement(response.data);
        onSuccess?.();
      } else {
        throw new Error(response.error || 'Failed to submit statement');
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!confirm('Are you sure you want to finalize your statement? You cannot edit it after finalization.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiRequest.post<any>(`/disputes/${caseId}/statements/finalize`, {});

      if (response.success) {
        setIsFinalized(true);
        setSuccess(true);
        alert('Statement finalized successfully!');
        onSuccess?.();
      } else {
        throw new Error(response.error || 'Failed to finalize statement');
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length;

  if (isFinalized) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Statement Finalized</h3>
            <p className="text-sm text-green-700 mt-1">
              Your statement has been finalized and submitted. You cannot edit it anymore.
              Waiting for the other party to finalize their statement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Submit Your Statement</h2>
          <p className="text-sm text-gray-500">
            Describe your side of the dispute in detail
          </p>
        </div>
      </div>

      {success && !isFinalized && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">Statement saved!</p>
            <p className="text-sm text-green-700">
              You can continue editing or finalize when ready.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-900">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Statement Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Statement <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Provide a detailed description of the dispute from your perspective. Include dates, facts, and any relevant information..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className={`${wordCount < 50 ? 'text-red-600' : 'text-gray-600'}`}>
              {wordCount} words {wordCount < 50 && `(minimum 50 required)`}
            </span>
            <span className="text-gray-500">
              {content.length} characters
            </span>
          </div>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Evidence/Attachments (Optional)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              Upload evidence files (images, PDFs, documents)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              You can also upload evidence separately in the Evidence section
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between space-x-4">
          <button
            type="submit"
            disabled={loading || wordCount < 50}
            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Send className="w-5 h-5" />
            <span>{loading ? 'Saving...' : 'Save Statement'}</span>
          </button>

          {existingStatement && !isFinalized && (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Finalize Statement</span>
            </button>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Important:</strong> Your statement will be analyzed by AI along with the other party's statement.
            Once finalized, you cannot edit it. Make sure to include all relevant details.
          </p>
        </div>
      </form>
    </div>
  );
}
