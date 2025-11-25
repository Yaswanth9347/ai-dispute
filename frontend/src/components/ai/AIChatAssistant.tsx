'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { apiFetch, API_URL } from '@/lib/fetchClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AIChatAssistantProps {
  caseId?: string;
}

export default function AIChatAssistant({ caseId }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "👋 Hello! I’m your AI Legal Assistant — ready to help you understand your case, explain legal terms, and suggest fair strategies. How can I assist you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

      const piiRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\+91|91|0)?[6-9]\d{9}/g;
      const piiMatches = userMessage.content.match(piiRegex) || [];
      let allowPII = false;
      if (piiMatches.length) {
        const confirmed = window.confirm(
          `Your message appears to contain potential PII (e.g. ${piiMatches[0]}). Do you want to proceed sending it to the AI service?`
        );
        if (!confirmed) {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '⛔ Message not sent. Please remove sensitive PII (email/phone) before sending.',
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setLoading(false);
          return;
        }
        allowPII = true;
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const url = `${API_URL.replace(/\/api$/, '')}/api/ai/stream`;
      const body = JSON.stringify({ message: userMessage.content, caseId, conversationHistory, allowPII });

      const controller = new AbortController();
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to start stream' }));
        throw new Error(err.error || 'Failed to start stream');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('Streaming not supported');

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() }]);

      const decoder = new TextDecoder();
      let done = false;
      let partial = '';
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (value) {
          const chunkText = decoder.decode(value, { stream: true });
          partial += chunkText;

          const parts = partial.split('\n\n');
          partial = parts.pop() || '';
          for (const p of parts) {
            if (!p.trim()) continue;
            const lines = p.split('\n').map(l => l.trim());
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const data = line.replace(/^data:\s?/, '');
                const unescaped = data.replace(/\\n/g, '\n');
                setMessages((prev) => prev.map(m => m.id === assistantId ? { ...m, content: m.content + unescaped } : m));
              } else if (line.startsWith('event:') && line.includes('done')) {
                done = true;
              }
            }
          }
        }
        if (streamDone) break;
      }
      try { await reader.releaseLock?.(); } catch (e) {}

    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ I encountered an issue while processing your request. ${(err as any)?.message || ''}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    'What are the strengths of my case?',
    'Which precedents apply to my situation?',
    'What are my settlement options?',
    'How long might this case take?',
  ];

  return (
    <div className="flex flex-col h-[700px] max-h-[calc(100vh-5rem)] bg-gradient-to-b from-gray-50 via-white to-gray-100 rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white/70 backdrop-blur-md">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 blur-lg opacity-60"></div>
          <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">AI Legal Assistant</h3>
          <p className="text-sm text-gray-500">Smart, private, and law-aware</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scroll-smooth relative">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-5 py-3 rounded-3xl text-sm shadow transition-all duration-200 whitespace-pre-wrap break-words
                ${msg.role === 'user'
                  ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-none'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'}
              `}
            >
              {msg.content}
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-white border border-gray-100 px-4 py-2 rounded-2xl text-sm text-gray-600 shadow-md animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              AI is analyzing your input...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="px-5 py-4 border-t border-gray-200 bg-white/70 backdrop-blur-md">
          <p className="text-xs font-semibold text-gray-600 mb-2">Try asking one of these:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="px-4 py-2 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition duration-200 shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-5 border-t border-gray-200 bg-white/70 backdrop-blur-md">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your case, settlement, or legal interpretation..."
            rows={2}
            className="flex-1 px-5 py-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none shadow-sm placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold flex items-center gap-2 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            <span>Send</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Press Enter to send • Shift + Enter for new line</p>
      </div>
    </div>
  );
}
