'use client';
import { useState } from 'react';
import UserProfileEditor from '@/components/profile/UserProfileEditor';
import SecuritySettings from '@/components/profile/SecuritySettings';
import { User, Shield } from 'lucide-react';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-950 dark:to-slate-900 py-12">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
            Account Settings ⚙️
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400 text-lg">
            Manage your profile, security, and privacy preferences with ease.
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-slate-800 shadow-lg rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
          <nav className="flex justify-center sm:justify-start border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 sm:px-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all duration-200 border-b-2 focus:outline-none ${
                activeTab === 'profile'
                  ? 'text-indigo-600 border-indigo-500 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-5 h-5" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all duration-200 border-b-2 focus:outline-none ${
                activeTab === 'security'
                  ? 'text-indigo-600 border-indigo-500 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Security & Privacy</span>
            </button>
          </nav>

          {/* Content */}
          <div className="p-8 sm:p-10">
            <div className="animate-fade-in">
              {activeTab === 'profile' ? <UserProfileEditor /> : <SecuritySettings />}
            </div>
          </div>
        </div>
      </div>

      {/* Inline Styles for subtle animation */}
      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.4s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}