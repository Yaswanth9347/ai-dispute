'use client';

import { useEffect, useState } from 'react';
import { Upload, FileText, Building2, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/fetchClient';

interface CourtFilingFormProps {
  caseId: string;
  onSuccess?: () => void;
}

export default function CourtFilingForm({ caseId, onSuccess }: CourtFilingFormProps) {
  const [formData, setFormData] = useState({
    courtSystemId: '',
    filingType: '',
    isExpedited: false,
    description: '',
  });
  const [filingId, setFilingId] = useState<string | null>(null);
  const [filingStatus, setFilingStatus] = useState<{
    status: string;
    confirmation?: string | null;
    lastUpdated?: string | null;
  } | null>(null);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [courtSystems, setCourtSystems] = useState<{ id: string; name: string }[]>([]);

  const filingTypes = [
    { value: 'initial_complaint', label: 'Complaint' },
    { value: 'motion', label: 'Motion' },
    { value: 'response', label: 'Answer/Response' },
    { value: 'brief', label: 'Brief' },
    { value: 'evidence', label: 'Evidence Submission' },
    { value: 'settlement', label: 'Settlement Agreement' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await apiFetch('/court/systems');
        if (!resp.ok) return;
        const body = await resp.json();
        if (mounted && body && body.data && Array.isArray(body.data.courtSystems)) {
          setCourtSystems(body.data.courtSystems.map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch (e) {
        // ignore - leave list empty
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Poll filing status when filingId is available
  useEffect(() => {
    if (!filingId) return;
    let cancelled = false;
    let attempts = 0;
    let timer: NodeJS.Timeout | null = null;

    const terminalStates = new Set(['processed', 'rejected', 'failed', 'cancelled', 'accepted']);

    const fetchStatus = async () => {
      attempts += 1;
      try {
        const res = await apiFetch(`/court/filings/${filingId}/status`);
        if (!res.ok) return;
        const body = await res.json();
        const data = body.data;
        if (cancelled) return;
        setFilingStatus({ status: data.status || data.filing_status || 'unknown', confirmation: data.courtConfirmationNumber || data.court_confirmation_number || data.confirmation || null, lastUpdated: new Date().toISOString() });

        if (terminalStates.has((data.status || data.filing_status || '').toLowerCase())) {
          // stop polling
          return;
        }
      } catch (err) {
        // ignore transient errors
      }

      // exponential backoff up to a maximum interval
      const delay = Math.min(1000 * Math.pow(2, attempts), 30_000);
      timer = setTimeout(fetchStatus, delay);
    };

    fetchStatus();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [filingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!formData.courtSystemId) throw new Error('Please select a court system');
      if (!formData.filingType) throw new Error('Please select a filing type');
      if (documents.length === 0) throw new Error('Please attach at least one document');

      // 1) Upload each selected document to /api/documents/upload to get documentIds
      const documentIds: string[] = [];
      for (const doc of documents) {
        const fd = new FormData();
        fd.append('file', doc);
        fd.append('caseId', caseId);

        const uploadResp = await apiFetch('/documents/upload', {
          method: 'POST',
          body: fd,
        });

        if (!uploadResp.ok) {
          let errText = 'Failed to upload document';
          try { const errJson = await uploadResp.json(); errText = errJson.error || errText; } catch (e) {}
          throw new Error(errText);
        }

        const uploadData = await uploadResp.json();
        if (uploadData && uploadData.documentId) documentIds.push(uploadData.documentId);
      }

      // 2) Submit filing to /api/court/file using JSON payload
      const payload = {
        caseId,
        courtSystemId: formData.courtSystemId,
        documentIds,
        filingType: formData.filingType,
        expedited: formData.isExpedited,
        metadata: { description: formData.description }
      };

      const response = await apiFetch('/court/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const respJson = await response.json();
      if (!response.ok || !respJson.success) {
        throw new Error(respJson.error || 'Filing failed');
      }

      setSuccess(true);
      // capture filing id for polling
      const createdFilingId = respJson?.data?.filingId || null;
      if (createdFilingId) {
        setFilingId(createdFilingId);
        // initialize filingStatus from response if available
        const initStatus = respJson?.data?.filingStatus || respJson?.data?.status || respJson?.data?.filing_status;
        const confirmation = respJson?.data?.confirmationNumber || respJson?.data?.courtConfirmationNumber || respJson?.data?.court_confirmation_number || null;
        setFilingStatus({ status: initStatus || 'submitted', confirmation, lastUpdated: new Date().toISOString() });
      } else {
        setFilingId(null);
      }
      setFormData({
        courtSystemId: '',
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

      {filingStatus && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800 font-medium">Filing Status: <span className="uppercase">{filingStatus.status}</span></p>
              {filingStatus.confirmation && (
                <p className="text-xs text-blue-700">Confirmation: {filingStatus.confirmation}</p>
              )}
              <p className="text-xs text-blue-600">Last updated: {filingStatus.lastUpdated}</p>
            </div>
            <div>
              {filingId && (
                <a
                  href={`/cases/${caseId}/filings/${filingId}`}
                  className="text-sm text-blue-600 underline"
                >
                  View filing
                </a>
              )}
            </div>
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
            value={formData.courtSystemId}
            onChange={(e) => setFormData({ ...formData, courtSystemId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select court system...</option>
            {courtSystems.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
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
          disabled={loading || !formData.courtSystemId || !formData.filingType || documents.length === 0}
          className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Send className="w-5 h-5" />
          <span>{loading ? 'Filing...' : 'Submit to Court'}</span>
        </button>
      </form>
    </div>
  );
}
