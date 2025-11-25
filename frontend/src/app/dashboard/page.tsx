'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, TrendingUp, Plus, Search, BarChart3, MessageSquare, HelpCircle, LogOut } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickActionButton } from '@/components/dashboard/QuickActionButton';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';

// A polished Dashboard page with improved visuals using Tailwind
export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    closedCases: 0,
    pendingActions: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    if (token && userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchDashboardData(parsedUser.id);
    }
    setIsLoading(false);
  }, []);

  const fetchDashboardData = async (userId: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
      const token = localStorage.getItem('auth_token');
      
      // Fetch dashboard stats
      const statsResponse = await fetch(`${API_URL}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data || statsData);
      }

      // Fetch recent activity
      const activityResponse = await fetch(`${API_URL}/dashboard/recent-activity`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setRecentActivity(activityData.data || activityData || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Use demo data
      setStats({
        totalCases: 3,
        activeCases: 2,
        closedCases: 1,
        pendingActions: 1,
      });
      setRecentActivity([
        {
          id: '1',
          type: 'dispute_created',
          title: 'New dispute filed',
          description: 'Property boundary dispute created',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'pending',
        },
        {
          id: '2',
          type: 'dispute_updated',
          title: 'Dispute updated',
          description: 'AI analysis completed for contract dispute',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          status: 'active',
        },
      ]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('remember_me');
    window.location.href = '/auth/login';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) return <LoadingScreen />;
  if (!user) return <GuestBanner onLogin={() => (window.location.href = '/auth/login')} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {getGreeting()}, {user.name}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            Here's what's happening with your disputes today
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Disputes"
            value={stats.totalCases}
            icon={FileText}
            trend="+12% from last month"
            trendUp={true}
          />
          <StatCard
            title="Active Disputes"
            value={stats.activeCases}
            icon={Clock}
            trend="-3% from last month"
            trendUp={false}
          />
          <StatCard
            title="Resolved"
            value={stats.closedCases}
            icon={CheckCircle}
            trend="+8% from last month"
            trendUp={true}
          />
          <StatCard
            title="Pending Actions"
            value={stats.pendingActions}
            icon={TrendingUp}
            description="Requires your attention"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity - Main Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search disputes, case numbers, or parties..."
                />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
                <Link href="/activity" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View all
                </Link>
              </div>
              <ActivityFeed activities={recentActivity} />
            </div>

            {/* Quick Stats Chart Placeholder */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Dispute Trends</h2>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Analytics Chart</p>
                  <p className="text-sm text-gray-500 mt-1">Dispute trends visualization coming soon</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <QuickActionButton
                  icon={Plus}
                  title="File New Dispute"
                  description="Start a new dispute resolution"
                  href="/disputes/new"
                />
                <QuickActionButton
                  icon={BarChart3}
                  title="View Analytics"
                  description="See detailed reports"
                  href="/analytics"
                />
                <QuickActionButton
                  icon={MessageSquare}
                  title="Live Chat Support"
                  description="Get instant help"
                  onClick={() => alert('Live chat integration coming soon!')}
                />
                <QuickActionButton
                  icon={HelpCircle}
                  title="Help Center"
                  description="Browse documentation"
                  href="/help"
                />
              </div>
            </div>

            {/* Tips Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">💡 Tips & Tricks</h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Use AI Analysis for quick summaries and insights</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Upload clear PDF evidence for faster processing</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Send settlement proposals for e-signature after review</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Track all communication in the timeline</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
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
        <div className="text-gray-700 font-medium">Loading dashboard…</div>
      </div>
    </div>
  );
}

function GuestBanner({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-md bg-white p-8 rounded-xl shadow-lg border">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <LogOut className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">Please log in to access the dashboard.</p>
        </div>
        <div className="flex justify-center">
          <button 
            onClick={onLogin} 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
}
