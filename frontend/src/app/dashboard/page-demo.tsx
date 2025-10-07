'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for demo user data
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/';
  };

  const handleFileCase = () => {
    window.location.href = '/cases/file';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Please log in to access the dashboard.</p>
          <a 
            href="/auth/login" 
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Demo data
  const demoStats = {
    totalCases: 3,
    activeCases: 2,
    closedCases: 1,
    pendingActions: 1
  };

  const demoCases = [
    {
      id: 'case-1',
      title: 'Property Boundary Dispute',
      caseNumber: 'ADR-2024-001',
      status: 'ai_analysis',
      createdAt: '2024-10-01',
      description: 'Dispute regarding property boundary with neighbor'
    },
    {
      id: 'case-2',
      title: 'Contract Payment Dispute',
      caseNumber: 'ADR-2024-002',
      status: 'awaiting_response',
      createdAt: '2024-10-05',
      description: 'Non-payment of freelance contract amount'
    },
    {
      id: 'case-3',
      title: 'Consumer Product Complaint',
      caseNumber: 'ADR-2024-003',
      status: 'closed',
      createdAt: '2024-09-15',
      description: 'Defective product compensation claim'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filed': return 'bg-blue-100 text-blue-800';
      case 'awaiting_response': return 'bg-yellow-100 text-yellow-800';
      case 'under_review': return 'bg-purple-100 text-purple-800';
      case 'ai_analysis': return 'bg-indigo-100 text-indigo-800';
      case 'settlement_options': return 'bg-orange-100 text-orange-800';
      case 'closed': return 'bg-green-100 text-green-800';
      case 'forwarded_to_court': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="/" className="text-2xl font-bold text-gray-900">
                AI Dispute Resolver
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user.name}
              </span>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Manage your disputes and track their progress
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Cases</p>
                <p className="text-2xl font-bold text-gray-900">
                  {demoStats.totalCases}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Active Cases</p>
                <p className="text-2xl font-bold text-blue-600">
                  {demoStats.activeCases}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Closed Cases</p>
                <p className="text-2xl font-bold text-green-600">
                  {demoStats.closedCases}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Pending Actions</p>
                <p className="text-2xl font-bold text-orange-600">
                  {demoStats.pendingActions}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Cases */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Recent Cases</h2>
                  <p className="text-sm text-gray-600">
                    Your latest dispute cases
                  </p>
                </div>
                <a 
                  href="/cases" 
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                >
                  View All
                </a>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {demoCases.map((disputeCase) => (
                  <div key={disputeCase.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {disputeCase.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Case #{disputeCase.caseNumber}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${getStatusColor(disputeCase.status)}`}>
                        {formatStatus(disputeCase.status)}
                      </span>
                    </div>
                    <a 
                      href={`/cases/${disputeCase.id}`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-sm text-gray-600">
                Common tasks you can perform
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <button
                  onClick={handleFileCase}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center">
                      📝
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">File New Dispute</div>
                      <div className="text-sm text-gray-600">Start a new case</div>
                    </div>
                  </div>
                </button>
                
                <a
                  href="/cases"
                  className="block w-full p-4 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-gray-500 text-white rounded-full w-10 h-10 flex items-center justify-center">
                      📋
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">View All Cases</div>
                      <div className="text-sm text-gray-600">Manage existing cases</div>
                    </div>
                  </div>
                </a>
                
                <a
                  href="/profile"
                  className="block w-full p-4 text-left border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center">
                      👤
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Update Profile</div>
                      <div className="text-sm text-gray-600">Edit your information</div>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Notice */}
        <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-yellow-600 text-xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-yellow-800 mb-2">Demo Mode Active</h3>
              <p className="text-yellow-700 text-sm">
                You're currently viewing demo data. In the full version, this would show your actual cases and real-time updates.
                The AI analysis, settlement options, and digital signature features are all implemented and ready for backend integration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}