'use client';

import AIChatAssistant from '@/components/ai/AIChatAssistant';
import { Sparkles } from 'lucide-react';

export default function AIAssistantPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              AI Legal Assistant
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300 max-w-2xl">
              Instant, confidential legal insights — tailored for India.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-800 dark:to-purple-900 shadow-lg">
              <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 dark:text-slate-400">Powered by</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                AI Dispute Resolver
              </p>
            </div>
          </div>
        </header>

        {/* Main Chat Section */}
        <section>
          <div className="rounded-3xl bg-white/90 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8">
              {/* Chat Container */}
              <div className="h-[720px] rounded-2xl border border-slate-50 dark:border-slate-700 overflow-hidden shadow-inner">
                <AIChatAssistant />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
