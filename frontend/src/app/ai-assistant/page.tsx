'use client';

import AIChatAssistant from '@/components/ai/AIChatAssistant';

export default function AIAssistantPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Legal Assistant</h1>
        <p className="text-gray-600 mt-2">Get instant legal advice and case insights powered by AI</p>
      </div>

      <AIChatAssistant />
    </div>
  );
}
