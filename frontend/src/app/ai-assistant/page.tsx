// app/ai-assistant/page.tsx
'use client';

import AIChatAssistant from '@/components/ai/AIChatAssistant';
import { Sparkles } from 'lucide-react';

export default function AIAssistantPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 py-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                AI Legal Assistant
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300 max-w-2xl">
                Get instant legal advice and case insights powered by AI — quick, confidential, and India-focused.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-800 dark:to-purple-900 shadow">
                <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 dark:text-slate-400">Powered by</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">AI Dispute Resolver</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main content: two-column responsive layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Chat column */}
          <section className="lg:col-span-8">
            <div className="rounded-2xl bg-white/90 dark:bg-slate-800/70 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow-lg overflow-hidden">
              <div className="p-4 sm:p-6">
                {/* small page hint */}
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Ask questions about legal strategy, precedents, settlement options, and more.
                </div>

                {/* Chat component */}
                <div className="h-[680px]">
                  <AIChatAssistant />
                </div>
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div className="space-y-6">
              {/* Quick prompts card */}
              <div className="rounded-xl bg-white/95 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow p-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Quick prompts</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Tap to fill the message box</p>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  {[
                    'What are the strengths of my case?',
                    'What settlement options should I consider?',
                    'Which precedents apply to a contract dispute?',
                    'What documents do I need to file a complaint?',
                  ].map((q) => (
                    <button
                      key={q}
                      className="text-sm text-slate-700 dark:text-slate-200 text-left w-full px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700 hover:shadow focus:outline-none hover:bg-slate-50 dark:hover:bg-slate-700/60 transition"
                      onClick={() => {
                        // set input on the chat component — if you want to wire, expose a prop or global event.
                        // For now we copy the previous behavior: put the text in clipboard so user can paste quickly.
                        navigator.clipboard?.writeText(q).catch(() => {});
                      }}
                      title="Copies this prompt to clipboard"
                    >
                      {q}
                      <span className="text-xs text-slate-400 ml-2">· copy</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips card */}
              <div className="rounded-xl bg-white/95 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow p-4">
                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100">Tips for better answers</h4>
                <ul className="mt-3 text-sm text-slate-600 dark:text-slate-300 space-y-2 list-inside">
                  <li>• Provide facts (dates, relevant documents, desired outcome).</li>
                  <li>• Ask one question at a time for focused replies.</li>
                  <li>• Avoid sharing sensitive personal identifiers.</li>
                </ul>
              </div>

              {/* Case selector / resources */}
              <div className="rounded-xl bg-white/95 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow p-4">
                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100">Case context</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Attach a case to let the assistant give tailored advice.</p>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                    Select Case
                  </button>
                  <button className="px-3 py-2 bg-white border border-slate-200 dark:bg-transparent dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:shadow transition">
                    Attach File
                  </button>
                </div>
              </div>

              {/* Footer small note */}
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Note: This assistant offers informational guidance and is not a substitute for professional legal advice.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}