'use client';

import { useState, useEffect, ReactNode } from 'react';
import Toast from '@/components/notifications/Toast';

interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Listen for custom toast events
    const handleToast = (event: CustomEvent<ToastMessage>) => {
      const newToast = {
        ...event.detail,
        id: Date.now().toString() + Math.random(),
      };
      setToasts((prev) => [...prev, newToast]);
    };

    window.addEventListener('show-toast' as any, handleToast);
    return () => window.removeEventListener('show-toast' as any, handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-4 pointer-events-none">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}

// Helper function to show toasts
export function showToast(
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  message: string
) {
  const event = new CustomEvent('show-toast', {
    detail: { type, title, message },
  });
  window.dispatchEvent(event);
}
