 'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Mic, RefreshCw, X } from 'lucide-react';
import { API_URL } from '@/lib/fetchClient';

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
  const messagesRef = useRef<Message[]>(messages);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const [inputSpacerHeight, setInputSpacerHeight] = useState<number>(72);
  const [isRecording, setIsRecording] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const origInputRef = useRef<string>('');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  // keep a ref copy of messages to avoid stale closures when sending
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // abort active streaming request when unmounting
  useEffect(() => {
    return () => {
      try {
        abortControllerRef.current?.abort();
      } catch {}
      abortControllerRef.current = null;
    };
  }, []);

  // On mount, try to load persisted conversation from backend so refresh
  // preserves chat history. If fetching fails (401 or network), keep default.
  useEffect(() => {
    let mounted = true;
    const loadConversation = async () => {
      try {
        const apiBase = (API_URL || '').replace(/\/api\/?$/, '');
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const resp = await fetch(`${apiBase}/api/ai/conversation`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!mounted) return;
        if (!resp.ok) {
          // ignore auth errors / network issues here and keep default greeting
          return;
        }
        const json = await resp.json();
        if (json && json.success && json.data && Array.isArray(json.data.history) && json.data.history.length) {
          const mapped: Message[] = json.data.history.map((m: any, idx: number) => ({
            id: `${m.timestamp || Date.now()}-${idx}`,
            role: m.role || 'assistant',
            content: m.content || '',
            timestamp: m.timestamp || new Date().toISOString(),
          }));
          setMessages(mapped);
        }
      } catch (e) {
        // ignore - keep default greeting
      }
    };
    loadConversation();
    return () => {
      mounted = false;
    };
  }, []);

  // Measure input container height so we can insert a spacer inside the
  // messages area. This prevents the last message from being hidden under
  // the input and also removes weird visual gaps at the bottom.
  useEffect(() => {
    const measure = () => {
      const h = inputContainerRef.current?.offsetHeight || 72;
      setInputSpacerHeight(h + 8); // add small buffer
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Auto-resize textarea up to a maximum lines (4). When content height
  // exceeds that, enable internal scrolling.
  const adjustTextareaHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;

    const style = window.getComputedStyle(ta);
    let lineHeight = parseFloat(style.lineHeight || '0');
    if (!lineHeight || isNaN(lineHeight)) lineHeight = 20; // sensible fallback

    const maxLines = 4;
    const maxHeight = Math.floor(lineHeight * maxLines);

    ta.style.height = 'auto'; // reset to measure
    const newHeight = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = `${newHeight}px`;

    if (ta.scrollHeight > maxHeight) {
      ta.style.overflowY = 'auto';
    } else {
      ta.style.overflowY = 'hidden';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleSend = async () => {
    // If the user is recording, stop recognition and wait for final transcript
    // to be merged into `input` before sending.
    try {
      await stopRecognition();
    } catch {}

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

    // normalize api base before network call so error handling can reference it
    const apiBase = API_URL.replace(/\/api\/?$/, '');

    // ensure previous controller is aborted
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // use messagesRef to avoid stale closure issues
      const baseHistory = Array.isArray(messagesRef.current) ? messagesRef.current : [];
      const conversationHistory = [...baseHistory, userMessage].map((m) => ({ role: m.role, content: m.content }));

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      // Normalize API base: strip trailing /api or /api/ to avoid double slashes
      const url = `${apiBase}/api/ai/stream`;
      const body = JSON.stringify({ message: userMessage.content, caseId, conversationHistory });

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
        // Try to parse JSON error body, else read text
        let errMsg = `Server returned ${resp.status}`;
        try {
          const json = await resp.json();
          errMsg = json?.error || json?.message || JSON.stringify(json);
        } catch (e) {
          try {
            const txt = await resp.text();
            if (txt) errMsg = txt;
          } catch {}
        }
        console.error('AI stream start failed:', resp.status, errMsg);
        throw new Error(errMsg || 'Failed to start stream');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('Streaming not supported');

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() },
      ]);

      const decoder = new TextDecoder();
      let done = false;
      let partial = '';

      // Robust SSE parsing: handle chunk boundaries and multi-line data
      // frames (commonly JSON). We accumulate incoming chunks into
      // `partial` and extract complete SSE events terminated by "\n\n".
      // Each event may contain multiple `data:` lines which should be
      // joined with newlines. If the data looks like JSON we parse it and
      // extract useful fields, otherwise treat as raw text.
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (value) {
          const chunkText = decoder.decode(value, { stream: true });
          partial += chunkText;

          // Extract complete events
          let idx;
          while ((idx = partial.indexOf('\n\n')) !== -1) {
            const eventBlock = partial.slice(0, idx);
            partial = partial.slice(idx + 2);

            if (!eventBlock.trim()) continue;

            const lines = eventBlock.split('\n');
            const dataLines: string[] = [];
            let eventType = '';

            for (let rawLine of lines) {
              const line = rawLine.trim();
              if (line.startsWith('data:')) {
                dataLines.push(line.replace(/^data:\s?/, ''));
              } else if (line.startsWith('event:')) {
                eventType = line.replace(/^event:\s?/, '').trim();
              }
            }

            const dataStr = dataLines.join('\n');

            // If event declares done, mark completion
            if (eventType && eventType.includes('done')) {
              done = true;
              continue;
            }

            if (!dataStr) continue;

            // Try to parse JSON frames; many backends send JSON in `data:`
            let appended = '';
            try {
              const parsed = JSON.parse(dataStr);
              // Common patterns: { text: '...', content: '...' } or plain string
              if (typeof parsed === 'string') {
                appended = parsed;
              } else if (parsed?.text) {
                appended = parsed.text;
              } else if (parsed?.content) {
                appended = parsed.content;
              } else {
                // Fallback: stringify everything
                appended = JSON.stringify(parsed);
              }
            } catch (e) {
              // Not JSON, unescape explicit \n sequences and append raw
              appended = dataStr.replace(/\\n/g, '\n');
            }

            if (appended) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + appended } : m))
              );
            }
          }
        }

        if (streamDone) break;
      }

      try {
        await reader.releaseLock?.();
      } catch {}
      try {
        abortControllerRef.current = null;
      } catch {}
    } catch (err) {
      // Distinguish network-level failures (TypeError) from HTTP errors
      const msg = (err as any)?.message || String(err);
      let friendly = `⚠️ I encountered an issue while processing your request. ${msg}`;
      // common browser network error message is 'Failed to fetch' (TypeError)
      if (/abort/i.test(msg)) {
        friendly = '⚠️ Stream cancelled.';
      } else if (/failed to fetch/i.test(msg) || /network/i.test(msg)) {
        friendly = `⚠️ Network error: could not reach the backend at ${apiBase || API_URL}. Is the backend running? Check the browser console for CORS or network errors.`;
      }
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: friendly,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Cancel currently active stream
  const handleCancelStream = () => {
    try {
      abortControllerRef.current?.abort();
    } catch {}
    abortControllerRef.current = null;
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Microphone / Speech recognition handling (Web Speech API)
  const startRecognition = () => {
    if (typeof window === 'undefined') return;
    const Win: any = window as any;
    const SpeechRecognition = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      // Inspect recent conversation + current input to pick a reasonable
      // recognition language. Prefer Telugu (te-IN) when Telugu script
      // present, Devanagari (hi-IN) when Devanagari present, else English.
      const combined = (messagesRef.current || []).map((m) => m.content).join('\n') + '\n' + (input || '');
      let langCode = 'en-IN';
      try {
        if (/[\u0C00-\u0C7F]/.test(combined) || /[\u0C00-\u0C7F]/.test(input)) {
          langCode = 'te-IN';
        } else if (/[\u0900-\u097F]/.test(combined) || /[\u0900-\u097F]/.test(input)) {
          langCode = 'hi-IN';
        } else {
          langCode = 'en-IN';
        }
      } catch (e) {
        langCode = 'en-IN';
      }

      recognition.lang = langCode;
      recognition.interimResults = true;
      recognition.continuous = true;

      finalTranscriptRef.current = '';
      origInputRef.current = input || '';

      recognition.onresult = (ev: any) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; ++i) {
          const res = ev.results[i];
          if (res.isFinal) {
            finalTranscriptRef.current += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        // Combine original input + finalized transcript + interim
        const base = origInputRef.current || '';
        const space = base && finalTranscriptRef.current ? ' ' : '';
        setInput(base + space + finalTranscriptRef.current + interim);
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error', err);
        // stop on error
        try {
          recognition.stop();
        } catch {}
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        // ensure final transcript placed in input
        const base = origInputRef.current || '';
        const space = base && finalTranscriptRef.current ? ' ' : '';
        setInput(base + space + finalTranscriptRef.current);
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start speech recognition', e);
      alert('Could not start speech recognition.');
    }
  };

  // Stop recognition and return a promise that resolves when the
  // recognition's `onend` handler fires so final transcript is applied.
  const stopRecognition = (): Promise<void> => {
    const rec = recognitionRef.current;
    if (!rec) {
      setIsRecording(false);
      recognitionRef.current = null;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Preserve any existing onend handler and call it before resolving.
      const prevOnEnd = rec.onend;
      rec.onend = (ev: any) => {
        try {
          if (typeof prevOnEnd === 'function') prevOnEnd(ev);
        } catch (e) {
          console.error('Error in previous onend handler', e);
        }
        try {
          setIsRecording(false);
        } catch {}
        recognitionRef.current = null;
        resolve();
      };

      try {
        rec.stop();
      } catch (e) {
        // If stop throws synchronously, resolve to avoid blocking.
        console.warn('recognition.stop() threw', e);
        try {
          setIsRecording(false);
        } catch {}
        recognitionRef.current = null;
        resolve();
      }
    });
  };

  const toggleRecording = () => {
    if (isRecording) stopRecognition();
    else startRecognition();
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-gray-50 via-white to-gray-100 rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Reset button (top-right) — kept visible but header/ avatar removed per design */}
      <div className="absolute top-3 right-3 z-20">
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="p-2 rounded-full bg-white border text-gray-700 hover:bg-gray-50 shadow"
          title="Reset Conversation"
          aria-label="Reset conversation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Confirmation modal for reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowResetConfirm(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-lg shadow-lg border">
            <div className="p-4">
              <h4 className="text-lg font-semibold text-gray-900">Reset conversation?</h4>
              <p className="text-sm text-gray-600 mt-2">This will clear the current chat history for this account. This action cannot be undone.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-2 rounded-md bg-white border text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const apiBase = API_URL.replace(/\/api\/?$/, '');
                      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                      await fetch(`${apiBase}/api/ai/conversation`, {
                        method: 'DELETE',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                      });
                    } catch (e) {
                      // ignore
                    }
                    setMessages([
                      {
                        id: '1',
                        role: 'assistant',
                        content:
                          "👋 Hello! I’m your AI Legal Assistant — ready to help you understand your case, explain legal terms, and suggest fair strategies. How can I assist you today?",
                        timestamp: new Date().toISOString(),
                      },
                    ]);
                    setShowResetConfirm(false);
                  }}
                  className="px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth relative">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-5 py-3 rounded-3xl text-sm shadow transition-all duration-200 whitespace-pre-wrap break-words
                ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-none'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                }`}
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
            <div className="flex items-center bg-white border border-gray-100 px-3 py-2 rounded-2xl shadow-md">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" aria-hidden />
            </div>
          </div>
        )}

        <div style={{ height: inputSpacerHeight }} aria-hidden />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div ref={inputContainerRef} className="p-5 border-t border-gray-200 bg-white/70 backdrop-blur-md">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask your legal question here..."
            rows={1}
            style={{ maxHeight: '7rem' }} // roughly 4 lines
            className="flex-1 px-5 py-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm shadow-sm placeholder-gray-400"
          />
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3 rounded-full ${isRecording ? 'bg-red-100' : 'bg-gray-100 hover:bg-gray-200'} text-gray-700 transition-all shadow-sm`}
            title="Voice Input"
            aria-pressed={isRecording}
            aria-label="Toggle voice input"
          >
            <div className="relative">
              <Mic className={`w-5 h-5 ${isRecording ? 'text-red-600' : 'text-gray-600'}`} />
              {isRecording && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full ring-1 ring-white" />}
            </div>
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send Message"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancelStream}
              className="ml-2 p-3 rounded-full bg-white border text-gray-700 hover:bg-gray-50"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

