'use client';

import { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Calendar,
  CheckCircle,
  Search,
  ChevronRight,
  Settings
} from 'lucide-react';
import apiFetch from '../../lib/fetchClient';

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
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const resp = await apiFetch('/workflows');
        if (!mounted) return;
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(txt || 'Failed to fetch workflows');
        }
        const json = await resp.json();
        const data = json?.data ?? [];
        setWorkflows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Error loading workflows', err);
        setError('Unable to load workflows');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const toggleWorkflow = async (id: string) => {
    try {
      const resp = await apiFetch(`/workflows/${id}/toggle`, { method: 'PUT' });
      const json = await resp.json();
      if (json?.success && json.data) {
        setWorkflows((prev) => prev.map((w) => (w.id === id ? json.data : w)));
      }
    } catch (err: any) {
      console.error('Failed to toggle workflow', err);
      setError('Failed to toggle workflow');
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow? This action cannot be undone.')) return;
    try {
      const resp = await apiFetch(`/workflows/${id}`, { method: 'DELETE' });
      const json = await resp.json();
      if (resp.ok && json?.success) {
        setWorkflows((prev) => prev.filter((w) => w.id !== id));
      } else {
        throw new Error(json?.error || 'Delete failed');
      }
    } catch (err: any) {
      console.error('Failed to delete workflow', err);
      setError('Failed to delete workflow');
    }
  };

  const executeWorkflow = async (id: string) => {
    try {
      const resp = await apiFetch(`/workflows/${id}/execute`, { method: 'POST' });
      const json = await resp.json();
      if (resp.ok && json?.success && json.data) {
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  executionCount: (w.executionCount || 0) + (json.data.actionsExecuted || 1),
                  lastRun: new Date().toISOString(),
                }
              : w
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to execute workflow', err);
      setError('Failed to execute workflow');
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'case_filed': return '📄';
      case 'evidence_uploaded': return '📁';
      case 'settlement_reached': return '✅';
      case 'time_based': return '⏰';
      default: return '▶️';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'send_notification': return '🔔';
      case 'generate_document': return '📝';
      case 'update_status': return '🔄';
      case 'send_email': return '📧';
      case 'ai_analysis': return '🤖';
      default: return '⚙️';
    }
  };

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(query.toLowerCase()) ||
    w.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg flex items-center justify-center shadow">
            <Zap className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Workflow Automation</h1>
            <p className="text-sm text-slate-600 mt-1">Automate repetitive tasks for cases: notifications, document generation, AI analysis and more.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label htmlFor="dashboard-search" className="sr-only">Search workflows</label>
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="dashboard-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or description..."
              className="w-full md:w-72 pl-10 pr-3 py-2 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            onClick={() => setShowBuilder(true)}
            className="ml-auto md:ml-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:shadow-lg transition"
            title="Create new workflow"
          >
            <Plus className="w-4 h-4" />
            New
          </button>

          <button className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm hover:bg-slate-50">
            <Settings className="w-4 h-4" />
            Manage
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total workflows</p>
              <p className="text-xl font-semibold text-slate-900">{workflows.length}</p>
            </div>
            <Zap className="w-7 h-7 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-xl font-semibold text-green-600">{workflows.filter((w) => w.status === 'active').length}</p>
            </div>
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Executions</p>
              <p className="text-xl font-semibold text-blue-600">{workflows.reduce((s, w) => s + (w.executionCount || 0), 0)}</p>
            </div>
            <Play className="w-7 h-7 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Time saved</p>
              <p className="text-xl font-semibold text-orange-600">~24h</p>
            </div>
            <Calendar className="w-7 h-7 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Error / Loading */}
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
      {loading && (
        <div className="mb-4 text-sm text-slate-600">Loading workflows…</div>
      )}

      {/* Workflows list */}
      <div className="space-y-4">
        {filtered.map((workflow) => (
          <div key={workflow.id} className="bg-white rounded-2xl shadow border p-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900 truncate">{workflow.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    workflow.status === 'active' ? 'bg-green-100 text-green-800' :
                    workflow.status === 'paused' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {workflow.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3 truncate">{workflow.description}</p>

                <div className="flex items-center gap-3 overflow-x-auto py-2">
                  <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 flex-shrink-0">
                    <div className="text-2xl">{getTriggerIcon(workflow.trigger.type)}</div>
                    <div>
                      <div className="text-xs font-medium text-indigo-700">Trigger</div>
                      <div className="text-sm text-indigo-600 capitalize">{workflow.trigger.type.replace(/_/g, ' ')}</div>
                    </div>
                    <ChevronRight className="text-slate-300 ml-2" />
                  </div>

                  {workflow.actions.map((action, idx) => (
                    <div key={action.id} className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-lg px-4 py-2">
                        <div className="text-2xl">{getActionIcon(action.type)}</div>
                        <div>
                          <div className="text-xs font-medium text-purple-700">Action {idx + 1}</div>
                          <div className="text-sm text-purple-600 capitalize">{action.type.replace(/_/g, ' ')}</div>
                        </div>
                      </div>
                      {idx < workflow.actions.length - 1 && <ChevronRight className="text-slate-300" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWorkflow(workflow.id)}
                      className={`p-2 rounded-lg transition ${workflow.status === 'active' ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      aria-label={workflow.status === 'active' ? 'Pause' : 'Activate'}
                      title={workflow.status === 'active' ? 'Pause' : 'Activate'}
                    >
                      {workflow.status === 'active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>

                    <button onClick={() => executeWorkflow(workflow.id)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Execute now">
                      <Play className="w-5 h-5" />
                    </button>

                    <button className="p-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100" title="Edit">
                      <Edit className="w-5 h-5" />
                    </button>

                    <button onClick={() => deleteWorkflow(workflow.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-slate-500 text-right">
                    <div className="flex items-center gap-2">
                      <Play className="w-3 h-3" /> <span>Executed</span> <strong className="ml-1">{workflow.executionCount}</strong>
                    </div>
                    {workflow.lastRun && (
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3" /> <span>Last: {new Date(workflow.lastRun).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle className="w-3 h-3" /> <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center">
            <Zap className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No workflows yet</h3>
            <p className="text-sm text-slate-600 mb-6">Create your first workflow to automate tasks like reminders, emails or AI analysis.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowBuilder(true)} className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Create Workflow</button>
              <button onClick={() => setWorkflows([])} className="px-6 py-2 rounded-lg border">Import</button>
            </div>
          </div>
        )}
      </div>

      {/* Builder modal (simple) */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Create new workflow</h2>
                <p className="text-sm text-slate-600 mt-1">Builder UI is coming — for now you can create workflows via API or import JSON.</p>
              </div>
              <button onClick={() => setShowBuilder(false)} className="text-slate-500 hover:text-slate-700">Close</button>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-600">Name</label>
                <input className="w-full mt-2 px-3 py-2 border rounded-md" placeholder="e.g. Notify on evidence upload" />
              </div>
              <div>
                <label className="text-xs text-slate-600">Trigger</label>
                <select className="w-full mt-2 px-3 py-2 border rounded-md">
                  <option value="evidence_uploaded">Evidence uploaded</option>
                  <option value="case_filed">Case filed</option>
                  <option value="time_based">Time based</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowBuilder(false)} className="px-4 py-2 rounded-md border">Cancel</button>
              <button onClick={() => { alert('Save not implemented in demo'); }} className="px-4 py-2 rounded-md bg-indigo-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
