'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Users, 
  FileText, 
  Gavel,
  Brain,
  Send,
  Scale
} from 'lucide-react';

interface DisputeWorkflowProps {
  caseId: string;
}

const STAGE_INFO = {
  draft: { label: 'Draft', icon: FileText, color: 'gray' },
  awaiting_respondent: { label: 'Awaiting Respondent', icon: Clock, color: 'yellow' },
  statement_collection: { label: 'Collecting Statements', icon: Users, color: 'blue' },
  statement_finalized: { label: 'Statements Finalized', icon: CheckCircle, color: 'green' },
  ai_analysis: { label: 'AI Analyzing', icon: Brain, color: 'purple' },
  options_presented: { label: 'Options Ready', icon: Scale, color: 'indigo' },
  awaiting_selection: { label: 'Awaiting Selection', icon: Clock, color: 'yellow' },
  consensus_reached: { label: 'Consensus Reached', icon: CheckCircle, color: 'green' },
  reanalysis: { label: 'Re-analyzing', icon: Brain, color: 'purple' },
  settlement_ready: { label: 'Settlement Ready', icon: Scale, color: 'green' },
  signature_pending: { label: 'Awaiting Signatures', icon: Send, color: 'orange' },
  closed_settled: { label: 'Settled', icon: CheckCircle, color: 'green' },
  forwarded_to_court: { label: 'Forwarded to Court', icon: Gavel, color: 'red' },
  closed_rejected: { label: 'Closed', icon: AlertTriangle, color: 'red' }
};

export default function DisputeWorkflow({ caseId }: DisputeWorkflowProps) {
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadWorkflow();
    loadStatistics();
  }, [caseId]);

  const loadWorkflow = async () => {
    try {
      const data = await apiRequest.get<any>(`/disputes/${caseId}/workflow`);
      if (data.success) {
        setWorkflow(data.data);
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await apiRequest.get<any>(`/disputes/${caseId}/workflow/statistics`);
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No workflow found for this case</p>
      </div>
    );
  }

  const currentStage = workflow.current_stage;
  const stageInfo = STAGE_INFO[currentStage as keyof typeof STAGE_INFO] || STAGE_INFO.draft;
  const IconComponent = stageInfo.icon;

  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    red: 'bg-red-100 text-red-800 border-red-300'
  };

  return (
    <div className="space-y-6">
      {/* Current Stage */}
      <div className={`rounded-lg border-2 p-6 ${colorClasses[stageInfo.color as keyof typeof colorClasses]}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold">{stageInfo.label}</h3>
            <p className="text-sm opacity-80">
              Current stage of dispute resolution
            </p>
          </div>
          {stats && (
            <div className="text-right">
              <p className="text-sm font-medium">{stats.daysInCurrentStage} days</p>
              <p className="text-xs opacity-70">in this stage</p>
            </div>
          )}
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Total Duration</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalDuration} days</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Stage Transitions</p>
            <p className="text-2xl font-bold text-gray-900">{stats.stageTransitions}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-600">Est. Completion</p>
            <p className="text-2xl font-bold text-gray-900">{stats.estimatedCompletion} days</p>
          </div>
        </div>
      )}

      {/* Stage History */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h4 className="font-semibold text-gray-900">Workflow History</h4>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            {workflow.stage_history?.slice().reverse().map((entry: any, idx: number) => {
              const entryStageInfo = STAGE_INFO[entry.stage as keyof typeof STAGE_INFO] || STAGE_INFO.draft;
              const EntryIcon = entryStageInfo.icon;
              
              return (
                <div key={idx} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    colorClasses[entryStageInfo.color as keyof typeof colorClasses]
                  }`}>
                    <EntryIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{entryStageInfo.label}</p>
                    <p className="text-sm text-gray-600">{entry.notes}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
