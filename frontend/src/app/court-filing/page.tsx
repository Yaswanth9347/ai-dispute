'use client';

import CourtFilingForm from '@/components/court/CourtFilingForm';

export default function CourtFilingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Court Filing</h1>
          <p className="text-gray-600 mt-2">Submit documents to court electronically</p>
        </div>
        <CourtFilingForm caseId="case-123" />
      </div>
    </div>
  );
}
