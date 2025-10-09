'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

// A polished Dashboard page with improved visuals using Tailwind
// Paste this file into your frontend (e.g. src/app/dashboard/page.tsx)

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    if (token && userData) setUser(JSON.parse(userData));
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/auth/login';
  };

  // Demo data (replace with real API data)
  const stats = {
    totalCases: 3,
    activeCases: 2,
    closedCases: 1,
    pendingActions: 1,
  };

  const cases = [
    {
      id: 'case-1',
      title: 'Property Boundary Dispute',
      caseNumber: 'ADR-2024-001',
      status: 'ai_analysis',
      createdAt: '2024-10-01',
      description: 'Dispute regarding property boundary with neighbor',
    },
    {
      id: 'case-2',
      title: 'Contract Payment Dispute',
      caseNumber: 'ADR-2024-002',
      status: 'awaiting_response',
      createdAt: '2024-10-05',
      description: 'Non-payment of freelance contract amount',
    },
    {
      id: 'case-3',
      title: 'Consumer Product Complaint',
      caseNumber: 'ADR-2024-003',
      status: 'closed',
      createdAt: '2024-09-15',
      description: 'Defective product compensation claim',
    },
  ];

  if (isLoading) return <LoadingScreen />;
  if (!user)
    return (
      <GuestBanner onLogin={() => (window.location.href = '/auth/login')} />
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Stats & Quick Actions */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="rounded-xl bg-white p-5 shadow-sm border">
            <h2 className="text-sm font-semibold text-gray-500">Overview</h2>
            <p className="mt-1 text-xs text-gray-400">Quick snapshot of your work</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatCard label="Total Cases" value={stats.totalCases} icon={'📁'} />
              <StatCard label="Active" value={stats.activeCases} icon={'⚡'} colorClass="text-blue-600 bg-blue-50" />
              <StatCard label="Closed" value={stats.closedCases} icon={'✅'} colorClass="text-green-600 bg-green-50" />
              <StatCard label="Pending" value={stats.pendingActions} icon={'⏳'} colorClass="text-orange-600 bg-orange-50" />
            </div>

            <div className="mt-6 space-y-2">
              <ActionButton href="/case/create" label="File New Dispute" emoji={'📝'} />
              <ActionButton href="/cases" label="Manage Cases" emoji={'📋'} variant="ghost" />
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border">
            <h3 className="text-sm font-semibold text-gray-600">Tips</h3>
            <ul className="mt-3 text-sm text-gray-500 space-y-2">
              <li>Use AI Analysis for quick summaries.</li>
              <li>Upload clear PDF evidence for faster processing.</li>
              <li>Send settlement for e-signature after review.</li>
            </ul>
          </div>
        </aside>

        {/* Middle column - Recent Cases (main) */}
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Recent Cases</h2>
            <div className="flex items-center gap-3">
              <input
                className="px-3 py-2 border rounded-md bg-white text-sm placeholder-gray-400"
                placeholder="Search cases, numbers or parties"
              />
              <Link href="/case/create" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">New Case</Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cases.map((c) => (
              <CaseCard key={c.id} caseData={c} />
            ))}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-800">Activity</h3>
            <p className="mt-2 text-sm text-gray-500">Recent actions and notifications will appear here.</p>
            <div className="mt-4 text-sm text-gray-600">No recent activity in demo mode.</div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- small components below ---------- */

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-t-blue-600 border-gray-200 rounded-full mx-auto mb-4"></div>
        <div className="text-gray-700">Loading dashboard…</div>
      </div>
    </div>
  );
}

function GuestBanner({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-md bg-white p-8 rounded-xl shadow">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="mt-2 text-sm text-gray-500">Please log in to access the dashboard.</p>
        <div className="mt-6 flex justify-end">
          <button onClick={onLogin} className="px-4 py-2 bg-blue-600 text-white rounded-md">Go to Login</button>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold">AI</div>
      <div className="hidden sm:block">
        <div className="text-sm font-semibold text-gray-800">AI Dispute Resolver</div>
        <div className="text-xs text-gray-400">Resolve disputes faster</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, colorClass = 'text-gray-700 bg-gray-50' }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md border" role="status">
      <div className={`flex items-center justify-center rounded-md w-10 h-10 ${colorClass}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-lg font-semibold text-gray-800">{value}</div>
      </div>
    </div>
  );
}

function ActionButton({ href, label, emoji, variant = 'solid' }: any) {
  const base = 'w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm';
  if (variant === 'ghost')
    return (
      <Link href={href} className={`${base} border border-gray-200 bg-white hover:bg-gray-50`}>
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">{emoji}</div>
        <div className="text-left">
          <div className="font-medium text-gray-800">{label}</div>
        </div>
      </Link>
    );

  return (
    <Link href={href} className={`${base} bg-blue-600 text-white hover:bg-blue-700`}>
      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20">{emoji}</div>
      <div className="text-left">
        <div className="font-medium">{label}</div>
      </div>
    </Link>
  );
}

function CaseCard({ caseData }: any) {
  const statusColor = getStatusColor(caseData.status);
  return (
    <article className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{caseData.title}</h3>
          <p className="text-xs text-gray-500 mt-1">{caseData.caseNumber} • {caseData.createdAt}</p>
          <p className="mt-3 text-sm text-gray-600">{caseData.description}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>{formatStatus(caseData.status)}</div>
          <div className="mt-3">
            <Link href={`/case/${caseData.id}`} className="inline-flex items-center px-3 py-2 rounded-md border text-sm hover:bg-gray-50">View</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'filed':
      return 'bg-blue-100 text-blue-700';
    case 'awaiting_response':
      return 'bg-yellow-100 text-yellow-800';
    case 'under_review':
      return 'bg-purple-100 text-purple-800';
    case 'ai_analysis':
      return 'bg-indigo-100 text-indigo-800';
    case 'settlement_options':
      return 'bg-orange-100 text-orange-800';
    case 'closed':
      return 'bg-green-100 text-green-800';
    case 'forwarded_to_court':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
