'use client';

import DocumentGenerator from '@/components/documents/DocumentGenerator';

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Document Generator</h1>
          <p className="text-gray-600 mt-2">Generate legal documents from templates</p>
        </div>
        <DocumentGenerator caseId="case-123" />
      </div>
    </div>
  );
}
