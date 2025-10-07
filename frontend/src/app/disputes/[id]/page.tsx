'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import DisputeWorkflow from '@/components/disputes/DisputeWorkflow';
import StatementForm from '@/components/disputes/StatementForm';
import SettlementOptions from '@/components/disputes/SettlementOptions';
import { Scale, FileText, Users, Send } from 'lucide-react';

export default function DisputePage() {
  const params = useParams();
  const caseId = params?.id as string;
  const [activeTab, setActiveTab] = useState<'workflow' | 'statement' | 'options'>('workflow');
  const [caseData, setCaseData] = useState<any>(null);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (caseId) {
      loadCaseData();
      loadWorkflow();
    }
  }, [caseId]);

  const loadCaseData = async () => {
    try {
      const data = await apiRequest.get<any>(`/cases/${caseId}`);
      if (data.success) {
        setCaseData(data.data || data);
      }
    } catch (error) {
      console.error('Failed to load case:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflow = async () => {
    try {
      const data = await apiRequest.get<any>(`/disputes/${caseId}/workflow`);
      if (data.success) {
        setWorkflow(data.data);
        // Auto-switch to appropriate tab based on stage
        if (data.data.current_stage === 'statement_collection') {
          setActiveTab('statement');
        } else if (['options_presented', 'awaiting_selection'].includes(data.data.current_stage)) {
          setActiveTab('options');
        }
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };

  const handleRefresh = () => {
    loadWorkflow();
    loadCaseData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dispute...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'workflow' as const, label: 'Workflow', icon: Scale },
    { id: 'statement' as const, label: 'My Statement', icon: FileText },
    { id: 'options' as const, label: 'Settlement Options', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {caseData?.title || 'Dispute Case'}
              </h1>
              <p className="text-gray-600">
                Case #{caseData?.case_number || caseId?.substring(0, 8)}
              </p>
              {workflow && (
                <div className="mt-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {workflow.current_stage?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b">
            <div className="flex space-x-4 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-4 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'workflow' && <DisputeWorkflow caseId={caseId} />}
            {activeTab === 'statement' && (
              <StatementForm caseId={caseId} onSuccess={handleRefresh} />
            )}
            {activeTab === 'options' && (
              <SettlementOptions caseId={caseId} onSuccess={handleRefresh} />
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">How This Works</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>1. Submit Statement:</strong> Both parties provide their version of the dispute
            </p>
            <p>
              <strong>2. AI Analysis:</strong> Our AI analyzes both statements and generates fair settlement options
            </p>
            <p>
              <strong>3. Select Option:</strong> Both parties choose their preferred settlement option
            </p>
            <p>
              <strong>4. Resolution:</strong> If both choose the same option, a settlement agreement is generated
            </p>
            <p>
              <strong>5. Sign & Close:</strong> Both parties sign the agreement and the dispute is resolved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
