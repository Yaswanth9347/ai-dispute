'use client';

import AIChatAssistant from '@/components/ai/AIChatAssistant';
import { Sparkles, Info, BookOpen } from 'lucide-react';

export default function AIAssistantPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-8">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                AI Legal Assistant
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300 max-w-2xl">
                Instant, confidential legal insights — tailored for India. Get quick summaries, precedents,
                and settlement ideas.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="p-2 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-800 dark:to-purple-900 shadow-lg">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Chat column */}
          <section className="lg:col-span-8">
            <div className="rounded-3xl bg-white/90 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden">
              <div className="p-6 sm:p-8">
                {/* small page hint */}
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-5 flex items-center gap-3">
                  <Info className="w-4 h-4 text-slate-400" />
                  <span>
                    Ask about legal strategy, evidence, precedents, or draft settlement language. Keep
                    personal identifiers out of the chat.
                  </span>
                </div>

                {/* Chat wrapper with subtle frame */}
                <div className="h-[720px] rounded-2xl border border-slate-50 dark:border-slate-700 overflow-hidden shadow-inner">
                  <AIChatAssistant />
                </div>

                {/* quick action row */}
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:scale-[1.02] transition shadow">
                      <Sparkles className="w-4 h-4" />
                      Quick analyze
                    </button>

                    <button className="px-3 py-2 rounded-lg bg-white border border-slate-100 dark:bg-transparent dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:shadow transition">
                      Export transcript
                    </button>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">Private • Encrypted session</div>
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
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Tap to copy or drag into the message box</p>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  {[
                    'What are the strengths of my case?',
                    'What settlement options should I consider?',
                    'Which precedents apply to a contract dispute?',
                    'What documents do I need to file a complaint?',
                  ].map((q) => (
                    <button
                      key={q}
                      className="text-sm text-slate-700 dark:text-slate-200 text-left w-full px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700 hover:shadow-sm focus:outline-none hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center justify-between"
                      onClick={() => navigator.clipboard?.writeText(q).catch(() => {})}
                      title="Copies this prompt to clipboard"
                    >
                      <span className="truncate">{q}</span>
                      <span className="text-xs text-slate-400 ml-2">copy</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips card */}
              <div className="rounded-xl bg-white/95 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow p-4">
                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100">Tips for better answers</h4>
                <ul className="mt-3 text-sm text-slate-600 dark:text-slate-300 space-y-2 list-inside">
                  <li>• Provide facts (dates, key documents, desired outcome).</li>
                  <li>• Ask one focused question at a time.</li>
                  <li>• Avoid sharing phone numbers or emails.</li>
                </ul>
              </div>

              {/* Case selector / resources */}
              <div className="rounded-xl bg-white/95 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-700 shadow p-4">
                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100">Case context</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Attach a case to let the assistant give tailored advice.</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow">Select Case</button>
                  <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 dark:bg-transparent dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:shadow transition">Attach File</button>
                </div>

                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">You can also attach PDFs, evidence lists, and witness statements.</div>
              </div>

              {/* Resources card */}
              <div className="rounded-xl bg-gradient-to-br from-indigo-50/60 to-purple-50/60 dark:from-indigo-900/40 dark:to-purple-900/40 p-4 border border-transparent shadow-inner">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Common resources</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Templates, sample pleadings and useful links for quick reference.</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="text-sm px-3 py-2 rounded-lg bg-white border border-slate-100 dark:bg-transparent dark:border-slate-700">Templates</button>
                  <button className="text-sm px-3 py-2 rounded-lg bg-white border border-slate-100 dark:bg-transparent dark:border-slate-700">Precedents</button>
                </div>
              </div>

              {/* Footer small note */}
              <div className="text-xs text-slate-500 dark:text-slate-400">Note: This assistant offers informational guidance and is not a substitute for professional legal advice.</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
