'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, Upload, MessageSquare, Calendar, FileBarChart, X } from 'lucide-react';

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
  color: string;
}

export default function QuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const actions: QuickAction[] = [
    {
      icon: FileText,
      label: 'File New Dispute',
      description: 'Start a new dispute resolution process',
      href: '/disputes/new',
      color: 'bg-blue-500',
    },
    {
      icon: Upload,
      label: 'Upload Document',
      description: 'Add evidence or supporting documents',
      href: '/documents/upload',
      color: 'bg-green-500',
    },
    {
      icon: MessageSquare,
      label: 'Start Chat',
      description: 'Begin conversation with AI assistant',
      href: '/chat/new',
      color: 'bg-purple-500',
    },
    {
      icon: Calendar,
      label: 'Schedule Meeting',
      description: 'Arrange mediation session',
      href: '/meetings/schedule',
      color: 'bg-orange-500',
    },
    {
      icon: FileBarChart,
      label: 'Generate Report',
      description: 'Create custom analytics report',
      href: '/reports/generate',
      color: 'bg-indigo-500',
    },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group z-40"
        aria-label="Quick Actions"
      >
        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
      </button>

      {/* Quick Actions Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
                  <p className="text-sm text-gray-600">Perform common tasks quickly</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Actions Grid */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {actions.map((action) => {
                  const Icon = action.icon;
                  const content = (
                    <div className="flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 cursor-pointer group">
                      <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{action.label}</h3>
                        <p className="text-sm text-gray-600">{action.description}</p>
                      </div>
                    </div>
                  );

                  if (action.href) {
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        onClick={() => setIsOpen(false)}
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={action.label}
                      onClick={() => {
                        action.onClick?.();
                        setIsOpen(false);
                      }}
                      className="text-left w-full"
                    >
                      {content}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600">
                  Press <kbd className="px-2 py-1 bg-white border rounded text-xs font-mono">ESC</kbd> to close
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
