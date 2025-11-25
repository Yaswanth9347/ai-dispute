'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import AIChatAssistant from '@/components/ai/AIChatAssistant';

export default function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const modalContent = isOpen ? (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[9999]"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 pointer-events-none overflow-y-auto">
        <div className="w-full max-w-6xl my-auto pointer-events-auto">
          {/* Close Button */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-all"
              aria-label="Close AI Assistant"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* AI Chat Component */}
          <div className="h-[calc(100vh-6rem)]">
            <AIChatAssistant />
          </div>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      {/* AI Assistant Icon Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 transition-all text-indigo-600 relative group"
        aria-label="AI Assistant"
        title="AI Legal Assistant"
      >
        <Sparkles className="w-5 h-5" />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
      </button>

      {/* Render modal in document body using portal */}
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}
