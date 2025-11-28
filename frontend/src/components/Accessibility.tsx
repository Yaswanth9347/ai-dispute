// Accessibility Component - Enhanced accessibility features
'use client';

import { useEffect } from 'react';

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Add keyboard navigation support
    const handleKeyboardNavigation = (e: KeyboardEvent) => {
      // Skip to main content with Alt+M
      if (e.altKey && e.key === 'm') {
        const main = document.querySelector('main');
        if (main) {
          main.focus();
          main.scrollIntoView();
        }
      }

      // Skip to navigation with Alt+N
      if (e.altKey && e.key === 'n') {
        const nav = document.querySelector('nav');
        if (nav) {
          const firstLink = nav.querySelector('a, button');
          if (firstLink instanceof HTMLElement) {
            firstLink.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyboardNavigation);
    
    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation);
    };
  }, []);

  return <>{children}</>;
}

// Skip to content link for screen readers
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
    >
      Skip to main content
    </a>
  );
}

// Accessible form label with required indicator
export function AccessibleLabel({ 
  htmlFor, 
  required, 
  children 
}: { 
  htmlFor: string; 
  required?: boolean; 
  children: React.ReactNode;
}) {
  return (
    <label 
      htmlFor={htmlFor} 
      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      {children}
      {required && (
        <span className="text-red-500 ml-1" aria-label="required">
          *
        </span>
      )}
    </label>
  );
}

// Accessible error message
export function AccessibleError({ 
  id, 
  message 
}: { 
  id: string; 
  message?: string;
}) {
  if (!message) return null;

  return (
    <p 
      id={id} 
      role="alert" 
      className="mt-1 text-sm text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  );
}

// Focus trap for modals
export function useFocusTrap(isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    const focusableElements = document.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);
}

// Live region for dynamic content announcements
export function LiveRegion({ 
  message, 
  politeness = 'polite' 
}: { 
  message: string; 
  politeness?: 'polite' | 'assertive';
}) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

// Accessible loading indicator
export function AccessibleLoader({ 
  message = 'Loading...' 
}: { 
  message?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="sr-only">{message}</span>
    </div>
  );
}