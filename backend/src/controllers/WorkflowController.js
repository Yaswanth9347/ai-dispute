const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authMiddleware');

// Mock workflows storage
let workflows = [
  {
    id: '1',
    name: 'Auto-analyze New Evidence',
    description: 'Automatically run AI analysis when new evidence is uploaded',
    trigger: { type: 'evidence_uploaded' },
    actions: [
      { id: 'a1', type: 'ai_analysis', config: { analysisType: 'relevance' } },
      { id: 'a2', type: 'send_notification', config: { message: 'AI analysis complete' } }
    ],
    status: 'active',
    executionCount: 45,
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
    userId: null // Will be set per user
  },
  {
    id: '2',
    name: 'Settlement Agreement Generator',
    description: 'Generate settlement documents when both parties accept',
    trigger: { type: 'settlement_reached' },
    actions: [
      { id: 'a3', type: 'generate_document', config: { template: 'settlement_agreement' } },
      { id: 'a4', type: 'send_email', config: { recipients: 'all_parties' } }
    ],
    status: 'active',
    executionCount: 12,
    lastRun: new Date(Date.now() - 24 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 15 * 24 * 3600000).toISOString(),
    userId: null
  }
];

// Get all workflows
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Return user-specific workflows (for demo, return all)
    res.json({
      success: true,
      data: workflows
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create workflow
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, trigger, actions } = req.body;
    
    const newWorkflow = {
      id: Date.now().toString(),
      name,
      description,
      trigger,
      actions,
      status: 'draft',
      executionCount: 0,
      createdAt: new Date().toISOString(),
      userId
    };
    
    workflows.push(newWorkflow);
    
    res.json({
      success: true,
      data: newWorkflow
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update workflow
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const workflowId = req.params.id;
    const updates = req.body;
    
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    Object.assign(workflow, updates);
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete workflow
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const workflowId = req.params.id;
    const index = workflows.findIndex(w => w.id === workflowId);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    workflows.splice(index, 1);
    
    res.json({
      success: true,
      message: 'Workflow deleted'
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute workflow manually
router.post('/:id/execute', requireAuth, async (req, res) => {
  try {
    const workflowId = req.params.id;
    const workflow = workflows.find(w => w.id === workflowId);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    // Execute workflow actions
    workflow.executionCount++;
    workflow.lastRun = new Date().toISOString();
    
    res.json({
      success: true,
      data: {
        workflowId,
        executionId: Date.now().toString(),
        status: 'completed',
        actionsExecuted: workflow.actions.length
      }
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle workflow status (activate/pause)
router.put('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const workflowId = req.params.id;
    const workflow = workflows.find(w => w.id === workflowId);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    workflow.status = workflow.status === 'active' ? 'paused' : 'active';
    
    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
