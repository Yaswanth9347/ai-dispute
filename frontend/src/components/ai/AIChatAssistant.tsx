'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Paperclip, X, File, Image as ImageIcon, FileText } from 'lucide-react';
import { apiFetch, API_URL } from '@/lib/fetchClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  analysisResult?: string;
}

interface AIChatAssistantProps {
  caseId?: string;
}

export default function AIChatAssistant({ caseId }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversation history from backend on mount
  useEffect(() => {
    loadConversationHistory();
  }, [caseId]);

  const loadConversationHistory = async () => {
    if (!caseId) {
      // Show welcome message if no caseId
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content:
            "⚖️ Namaste! I'm your AI Legal Analysis Companion—specialized in Indian constitutional law, judiciary system, and dispute resolution.\n\n**I can assist you with:**\n• Legal questions related to Indian law, courts, and judiciary\n• Case analysis using Constitution of India and relevant statutes\n• Dispute resolution strategies and settlement options\n• Your legal rights and obligations under Indian law\n• Document analysis (PDFs, images, legal documents)\n• Court procedures, filing process, and legal remedies\n\n**I focus exclusively on legal and judiciary matters.** For general queries unrelated to law or disputes, I won't be able to help.\n\nPlease share your legal question or case details.",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/ai/conversation-history/${caseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.messages && data.data.messages.length > 0) {
          setMessages(data.data.messages);
        } else {
          // Welcome message
          setMessages([
            {
              id: '1',
              role: 'assistant',
              content:
                "⚖️ Namaste! I'm your AI Legal Analysis Companion—specialized in Indian constitutional law, judiciary system, and dispute resolution.\n\n**I can assist you with:**\n• Legal questions related to Indian law, courts, and judiciary\n• Case analysis using Constitution of India and relevant statutes\n• Dispute resolution strategies and settlement options\n• Your legal rights and obligations under Indian law\n• Document analysis (PDFs, images, legal documents)\n• Court procedures, filing process, and legal remedies\n\n**I focus exclusively on legal and judiciary matters.** For general queries unrelated to law or disputes, I won't be able to help.\n\nPlease share your legal question or case details.",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      // Show welcome message on error
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content:
            "⚖️ Namaste! I'm your AI Legal Analysis Companion—specialized in Indian constitutional law, judiciary system, and dispute resolution.\n\n**I can assist you with:**\n• Legal questions related to Indian law, courts, and judiciary\n• Case analysis using Constitution of India and relevant statutes\n• Dispute resolution strategies and settlement options\n• Your legal rights and obligations under Indian law\n• Document analysis (PDFs, images, legal documents)\n• Court procedures, filing process, and legal remedies\n\n**I focus exclusively on legal and judiciary matters.** For general queries unrelated to law or disputes, I won't be able to help.\n\nPlease share your legal question or case details.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;

    // Upload files first if any
    let fileAttachments: FileAttachment[] = [];
    if (selectedFiles.length > 0) {
      setUploadingFiles(true);
      try {
        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append('files', file));
        if (caseId) formData.append('caseId', caseId);

        const uploadResponse = await fetch(`${API_URL}/ai/upload-files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          console.error('Upload error details:', errorData);
          throw new Error(errorData.error || 'File upload failed');
        }

        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.data.files) {
          fileAttachments = uploadData.data.files.map((f: any) => ({
            id: f.id || Math.random().toString(),
            name: f.name,
            type: f.type,
            size: f.size,
            url: f.url,
            analysisResult: f.analysisResult,
          }));
        }
      } catch (error) {
        console.error('File upload error:', error);
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `⚠️ Failed to upload files: ${(error as Error).message}. Please try again.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setUploadingFiles(false);
        return;
      } finally {
        setUploadingFiles(false);
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim() || '📎 Uploaded documents for analysis',
      timestamp: new Date().toISOString(),
      attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedFiles([]);
    setLoading(true);

    try {
      // Save user message to database
      if (caseId) {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_URL}/ai/conversation-history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            caseId,
            message: userMessage.content,
            role: 'user',
            attachments: fileAttachments,
          }),
        });
      }

      const conversationHistory = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

      // Add file analysis context to conversation
      let analysisContext = '';
      if (fileAttachments.length > 0) {
        analysisContext = '\n\n[Document Analysis Results]:\n';
        fileAttachments.forEach((f) => {
          if (f.analysisResult) {
            analysisContext += `\n${f.name}: ${f.analysisResult}\n`;
          }
        });
      }

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
      const body = JSON.stringify({ 
        message: userMessage.content + analysisContext, 
        caseId, 
        conversationHistory, 
        allowPII 
      });

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
      let fullAssistantMessage = '';
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
                fullAssistantMessage += unescaped;
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

      // Save assistant message to database
      if (caseId && fullAssistantMessage) {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_URL}/ai/conversation-history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            caseId,
            message: fullAssistantMessage,
            role: 'assistant',
          }),
        });
      }

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const suggestedQuestions = [
    'What are my legal rights in this dispute?',
    'Explain the court filing process',
    'How can I settle this case out of court?',
    'What does Indian law say about my case?',
  ];

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 via-white to-gray-100 rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white/70 backdrop-blur-md">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 blur-lg opacity-60"></div>
          <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">AI Legal Analysis Companion</h3>
          <p className="text-sm text-gray-500">Constitution-based dispute resolution expert</p>
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
              
              {/* File attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        msg.role === 'user' ? 'bg-white/20' : 'bg-gray-100'
                      }`}
                    >
                      {getFileIcon(file.type)}
                      <span className={`text-xs flex-1 ${msg.role === 'user' ? 'text-white' : 'text-gray-700'}`}>
                        {file.name} ({formatFileSize(file.size)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
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

        {uploadingFiles && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 bg-white border border-gray-100 px-4 py-2 rounded-2xl text-sm text-gray-600 shadow-md animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Uploading and analyzing files...
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
        {/* File preview */}
        {selectedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200"
              >
                {getFileIcon(file.type)}
                <span className="text-xs text-gray-700 max-w-[150px] truncate">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({formatFileSize(file.size)})
                </span>
                <button
                  onClick={() => handleRemoveFile(idx)}
                  className="ml-1 text-gray-400 hover:text-red-500 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploadingFiles}
            className="px-3 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach files (PDF, images, documents)"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your dispute, case facts, or legal question for analysis..."
            rows={2}
            className="flex-1 px-5 py-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none shadow-sm placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={loading || uploadingFiles || (!input.trim() && selectedFiles.length === 0)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold flex items-center gap-2 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || uploadingFiles ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            <span>Send</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift + Enter for new line • Attach PDFs, images, and documents for AI analysis
        </p>
      </div>
    </div>
  );
}
