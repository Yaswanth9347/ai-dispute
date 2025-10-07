'use client';

import { useState } from 'react';
import { Upload, FileText, Building2, Send, CheckCircle, AlertTriangle } from 'lucide-react';

interface CourtFilingFormProps {
  caseId: string;
  onSuccess?: () => void;
}

export default function CourtFilingForm({ caseId, onSuccess }: CourtFilingFormProps) {
  const [formData, setFormData] = useState({
    courtSystem: '',
    filingType: '',
    isExpedited: false,
    description: '',
  });
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const courtSystems = [
    { value: 'pacer', label: 'PACER (Federal Courts)' },
    { value: 'tyler', label: 'Tyler Technologies' },
    { value: 'odyssey', label: 'Odyssey File & Serve' },
    { value: 'efiling', label: 'State E-Filing System' },
  ];

  const filingTypes = [
    { value: 'complaint', label: 'Complaint' },
    { value: 'motion', label: 'Motion' },
    { value: 'answer', label: 'Answer' },
    { value: 'brief', label: 'Brief' },
    { value: 'evidence', label: 'Evidence Submission' },
    { value: 'settlement', label: 'Settlement Agreement' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('caseId', caseId);
      formDataToSend.append('courtSystem', formData.courtSystem);
      formDataToSend.append('filingType', formData.filingType);
      formDataToSend.append('isExpedited', String(formData.isExpedited));
      formDataToSend.append('description', formData.description);

      documents.forEach((doc) => {
        formDataToSend.append('documents', doc);
      });

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/court/file`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formDataToSend,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Filing failed');
      }

      setSuccess(true);
      setFormData({
        courtSystem: '',
        filingType: '',
        isExpedited: false,
        description: '',
      });
      setDocuments([]);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'An error occurred while filing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Building2 className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">File with Court</h2>
          <p className="text-sm text-gray-500">Submit documents to court electronically</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">Filing submitted successfully!</p>
            <p className="text-sm text-green-700">You will receive updates on the filing status.</p>
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
        {/* Court System */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Court System <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.courtSystem}
            onChange={(e) => setFormData({ ...formData, courtSystem: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select court system...</option>
            {courtSystems.map((court) => (
              <option key={court.value} value={court.value}>
                {court.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filing Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filing Type <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.filingType}
            onChange={(e) => setFormData({ ...formData, filingType: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select filing type...</option>
            {filingTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Expedited */}
        <div className="flex items-center space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <input
            type="checkbox"
            id="expedited"
            checked={formData.isExpedited}
            onChange={(e) => setFormData({ ...formData, isExpedited: e.target.checked })}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="expedited" className="flex-1">
            <span className="font-medium text-gray-900">Request Expedited Processing</span>
            <p className="text-sm text-gray-600">Additional fees may apply</p>
          </label>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            placeholder="Provide a brief description of this filing..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Document Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Documents <span className="text-red-500">*</span>
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Click to upload
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-sm text-gray-500 mt-1">PDF, DOC, DOCX (Max 25MB each)</p>
          </div>

          {documents.length > 0 && (
            <div className="mt-3 space-y-2">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="flex-1 text-sm text-gray-700">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !formData.courtSystem || !formData.filingType || documents.length === 0}
          className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Send className="w-5 h-5" />
          <span>{loading ? 'Filing...' : 'Submit to Court'}</span>
        </button>
      </form>
    </div>
  );
}
