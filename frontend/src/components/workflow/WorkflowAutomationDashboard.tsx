'use client';

import { useState } from 'react';
import { Zap, Plus, Play, Pause, Trash2, Edit, Calendar, CheckCircle } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'case_filed' | 'evidence_uploaded' | 'settlement_reached' | 'time_based' | 'manual';
    condition?: string;
  };
  actions: {
    id: string;
    type: 'send_notification' | 'generate_document' | 'update_status' | 'send_email' | 'ai_analysis';
    config: any;
  }[];
  status: 'active' | 'paused' | 'draft';
  executionCount: number;
  lastRun?: string;
  createdAt: string;
}

export default function WorkflowAutomationDashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: '1',
      name: 'Auto-analyze New Evidence',
      description: 'Automatically run AI analysis when new evidence is uploaded',
      trigger: {
        type: 'evidence_uploaded',
      },
      actions: [
        {
          id: 'a1',
          type: 'ai_analysis',
          config: { analysisType: 'relevance' },
        },
        {
          id: 'a2',
          type: 'send_notification',
          config: { message: 'AI analysis complete' },
        },
      ],
      status: 'active',
      executionCount: 45,
      lastRun: '2025-10-07T10:30:00Z',
      createdAt: '2025-09-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Settlement Agreement Generator',
      description: 'Generate settlement documents when both parties accept',
      trigger: {
        type: 'settlement_reached',
      },
      actions: [
        {
          id: 'a3',
          type: 'generate_document',
          config: { template: 'settlement_agreement' },
        },
        {
          id: 'a4',
          type: 'send_email',
          config: { recipients: 'all_parties' },
        },
      ],
      status: 'active',
      executionCount: 12,
      lastRun: '2025-10-06T14:20:00Z',
      createdAt: '2025-09-15T00:00:00Z',
    },
  ]);

  const [showBuilder, setShowBuilder] = useState(false);

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, status: w.status === 'active' ? 'paused' : 'active' } : w
      )
    );
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'case_filed':
        return '📄';
      case 'evidence_uploaded':
        return '📁';
      case 'settlement_reached':
        return '✅';
      case 'time_based':
        return '⏰';
      default:
        return '▶️';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'send_notification':
        return '🔔';
      case 'generate_document':
        return '📝';
      case 'update_status':
        return '🔄';
      case 'send_email':
        return '📧';
      case 'ai_analysis':
        return '🤖';
      default:
        return '⚙️';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workflow Automation</h1>
              <p className="text-gray-600">Automate repetitive tasks and streamline your workflow</p>
            </div>
          </div>
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-5 h-5" />
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Workflows</p>
              <p className="text-2xl font-bold text-gray-900">{workflows.length}</p>
            </div>
            <Zap className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">
                {workflows.filter((w) => w.status === 'active').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Executions</p>
              <p className="text-2xl font-bold text-blue-600">
                {workflows.reduce((sum, w) => sum + w.executionCount, 0)}
              </p>
            </div>
            <Play className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Time Saved</p>
              <p className="text-2xl font-bold text-orange-600">24h</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      workflow.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : workflow.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {workflow.status}
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{workflow.description}</p>

                {/* Workflow Visualization */}
                <div className="flex items-center space-x-2 overflow-x-auto py-2">
                  {/* Trigger */}
                  <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex-shrink-0">
                    <span className="text-2xl">{getTriggerIcon(workflow.trigger.type)}</span>
                    <div>
                      <p className="text-xs font-medium text-blue-900">TRIGGER</p>
                      <p className="text-sm text-blue-700 capitalize">
                        {workflow.trigger.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-gray-400 flex-shrink-0">→</div>

                  {/* Actions */}
                  {workflow.actions.map((action, idx) => (
                    <div key={action.id} className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 flex-shrink-0">
                        <span className="text-2xl">{getActionIcon(action.type)}</span>
                        <div>
                          <p className="text-xs font-medium text-purple-900">ACTION {idx + 1}</p>
                          <p className="text-sm text-purple-700 capitalize">
                            {action.type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      {idx < workflow.actions.length - 1 && (
                        <div className="text-gray-400 flex-shrink-0">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => toggleWorkflow(workflow.id)}
                  className={`p-2 rounded-lg ${
                    workflow.status === 'active'
                      ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                  title={workflow.status === 'active' ? 'Pause' : 'Activate'}
                >
                  {workflow.status === 'active' ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteWorkflow(workflow.id)}
                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm text-gray-600 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Play className="w-4 h-4" />
                <span>Executed {workflow.executionCount} times</span>
              </div>
              {workflow.lastRun && (
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Last run: {new Date(workflow.lastRun).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {workflows.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No workflows yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first workflow to automate repetitive tasks
          </p>
          <button
            onClick={() => setShowBuilder(true)}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Create Your First Workflow
          </button>
        </div>
      )}

      {/* Workflow Builder Modal (simplified for now) */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Workflow</h2>
            <p className="text-gray-600 mb-6">
              Workflow builder coming soon! For now, workflows are pre-configured.
            </p>
            <button
              onClick={() => setShowBuilder(false)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
