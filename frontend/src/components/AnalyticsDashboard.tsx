
'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { apiFetch } from '@/lib/fetchClient';
import { 
  TrendingUp, TrendingDown, Users, FileText, 
  CheckCircle, Clock, AlertCircle, Activity 
} from 'lucide-react';
import type { DashboardData } from '@/types/analytics';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function AnalyticsDashboard() {
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
  const token = localStorage.getItem('auth_token');
      const response = await apiFetch(`/analytics/dashboard?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch analytics data');
      const result = await response.json();
      setDashboardData(result.data);
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading analytics: {error}</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { platform, negotiations, aiPerformance, courtFilings, caseResolution } = dashboardData;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights and metrics</p>
        </div>

        {/* Timeframe Selector */}
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Cases"
          value={platform.totalCases}
          change={platform.newCases}
          changeLabel="new this period"
          icon={<FileText className="w-6 h-6 text-blue-600" />}
          trend="up"
        />
        <MetricCard
          title="Active Negotiations"
          value={platform.activeNegotiations}
          change={`${platform.settlementRate}%`}
          changeLabel="settlement rate"
          icon={<Users className="w-6 h-6 text-green-600" />}
          trend="up"
        />
        <MetricCard
          title="Completed Settlements"
          value={platform.totalSettlements}
          change={`${negotiations.successRate}%`}
          changeLabel="success rate"
          icon={<CheckCircle className="w-6 h-6 text-purple-600" />}
          trend="up"
        />
        <MetricCard
          title="Court Filings"
          value={courtFilings.total}
          change={`${courtFilings.successRate}%`}
          changeLabel="success rate"
          icon={<Activity className="w-6 h-6 text-orange-600" />}
          trend="neutral"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Negotiation Timeline */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Negotiation Activity
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={negotiations.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="started" stroke="#3b82f6" name="Started" />
              <Line type="monotone" dataKey="completed" stroke="#10b981" name="Completed" />
              <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Negotiation Status Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Negotiation Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={negotiations.statusDistribution.map((s) => ({
                  name: s.status.replace(/_/g, ' ').toUpperCase(),
                  value: s.count
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {negotiations.statusDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            AI Performance Metrics
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Analyses</span>
              <span className="text-2xl font-bold text-blue-600">
                {aiPerformance.totalAnalyses}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Confidence</span>
              <span className="text-2xl font-bold text-green-600">
                {(aiPerformance.averageConfidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg Processing Time</span>
              <span className="text-2xl font-bold text-purple-600">
                {aiPerformance.averageProcessingTime}ms
              </span>
            </div>

            {/* Confidence Distribution */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Confidence Distribution</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-20 text-sm text-gray-600">High</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-green-500 h-4 rounded-full"
                      style={{ 
                        width: `${(aiPerformance.confidenceDistribution.high / aiPerformance.totalAnalyses * 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="w-16 text-right text-sm font-medium">
                    {aiPerformance.confidenceDistribution.high}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-20 text-sm text-gray-600">Medium</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-yellow-500 h-4 rounded-full"
                      style={{ 
                        width: `${(aiPerformance.confidenceDistribution.medium / aiPerformance.totalAnalyses * 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="w-16 text-right text-sm font-medium">
                    {aiPerformance.confidenceDistribution.medium}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-20 text-sm text-gray-600">Low</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-red-500 h-4 rounded-full"
                      style={{ 
                        width: `${(aiPerformance.confidenceDistribution.low / aiPerformance.totalAnalyses * 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="w-16 text-right text-sm font-medium">
                    {aiPerformance.confidenceDistribution.low}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Case Resolution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Case Resolution Metrics
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={caseResolution.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="created" fill="#3b82f6" name="Created" />
              <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Resolution Rate</p>
              <p className="text-2xl font-bold text-green-600">{caseResolution.resolutionRate}%</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">Avg Resolution Time</p>
              <p className="text-2xl font-bold text-blue-600">{caseResolution.averageResolutionTime} days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Court Filing Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Court Filing Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-gray-600 text-sm">Total Filings</p>
            <p className="text-3xl font-bold text-blue-600">{courtFilings.total}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">Success Rate</p>
            <p className="text-3xl font-bold text-green-600">{courtFilings.successRate}%</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">Expedited</p>
            <p className="text-3xl font-bold text-orange-600">{courtFilings.expeditedCount}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">Avg Processing</p>
            <p className="text-3xl font-bold text-purple-600">{courtFilings.averageProcessingTime}h</p>
          </div>
        </div>

        {/* Filing Status Breakdown */}
            <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Filing Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {courtFilings.byStatus.map((s) => (
              <div key={s.status} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">{s.status.toUpperCase()}</p>
                <p className="text-xl font-bold text-gray-900">{s.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Metric Card Component
interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number | string;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, changeLabel, icon, trend }: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Clock className="w-4 h-4 text-gray-600" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
          {icon}
        </div>
        {getTrendIcon()}
      </div>
      <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      <p className={`text-sm mt-2 ${getTrendColor()}`}>
        <span className="font-medium">{change}</span> {changeLabel}
      </p>
    </div>
  );
}
