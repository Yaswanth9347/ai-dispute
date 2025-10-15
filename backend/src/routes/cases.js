const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabaseClient');
const multer = require('multer');
const upload = multer({ dest: '/tmp/uploads' });
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { enqueueEvidence } = require('../lib/mediaWorker');
const CaseModel = require('../models/Case');
const CaseEmailService = require('../services/CaseEmailService');
const CaseNotification = require('../models/CaseNotification');

// 1) create case
router.post('/', async (req, res) => {
  const { 
    title, 
    filed_by, 
    case_type, 
    jurisdiction,
    description,
    dispute_amount,
    other_party_name,
    other_party_email,
    other_party_phone,
    other_party_address,
    currency,
    priority,
    mediation_required
  } = req.body;

  if (!title || !filed_by) {
    return res.status(400).json({ error: 'Title and filed_by are required' });
  }

  if (!other_party_email) {
    return res.status(400).json({ error: 'Other party email is required for notifications' });
  }

  try {
    // Use Case model to create case with reference number and deadlines
    const caseData = {
      title,
      case_type,
      jurisdiction: jurisdiction || 'Default',
      description,
      dispute_amount,
      other_party_name,
      other_party_email,
      other_party_phone,
      other_party_address,
      currency: currency || 'INR',
      priority: priority || 'normal',
      mediation_required: mediation_required || false
    };

    const newCase = await CaseModel.createCase(caseData, filed_by);

    // Get plaintiff information for the email
    const { data: plaintiffData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', filed_by)
      .single();

    // Send case filed notification to defendant (async, non-blocking)
    try {
      // Create notification record (CaseNotification is already an instance)
      const notification = await CaseNotification.createNotification({
        case_id: newCase.id,
        recipient_email: other_party_email,
        recipient_name: other_party_name,
        notification_type: 'case_filed',
        subject: `⚖️ Legal Notice: Case ${newCase.case_reference_number} Filed Against You`,
        status: 'pending'
      });

      // Send email (don't wait for it)
      CaseEmailService.sendCaseFiledNotification({
        caseId: newCase.id,
        caseReferenceNumber: newCase.case_reference_number,
        caseTitle: title,
        plaintiffName: plaintiffData?.name || 'Plaintiff',
        defendantName: other_party_name,
        defendantEmail: other_party_email,
        responseDeadline: newCase.response_deadline
      })
      .then(result => {
        // Update notification status
        CaseNotification.updateStatus(
          notification.id, 
          result.success ? 'sent' : 'failed',
          result.error || null
        );
        console.log('✅ Case filed notification sent:', newCase.case_reference_number);
      })
      .catch(err => {
        console.error('❌ Failed to send case filed notification:', err);
        CaseNotification.updateStatus(notification.id, 'failed', err.message);
      });
    } catch (emailErr) {
      console.error('⚠️  Email notification setup failed:', emailErr);
      // Don't fail the case creation if email fails
    }

    return res.json(newCase);
  } catch (err) {
    console.error('[cases] create error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// 0) list cases (GET /)
router.get('/', async (req, res) => {
  try {
    // Use direct query with service role to bypass RLS
    const { data, error } = await supabase
      .rpc('get_all_cases_admin');
    
    // If RPC doesn't exist, fall back to simple query
    // Supabase PostgREST returns 'PGRST202' for missing functions
    if (error && (error.code === '42883' || error.code === 'PGRST202')) {
      // Function doesn't exist, use simple select
      const result = await supabase
        .from('cases')
        .select('id, title, case_type, status, dispute_amount, created_at, case_reference_number, filed_by, other_party_name, other_party_email')
        .order('created_at', { ascending: false });
      
      if (result.error) {
        console.error('[cases] list error:', result.error);
        // If still RLS error, return empty array instead of failing
        if (result.error.code === '42P17') {
          console.warn('[cases] RLS policy has infinite recursion - returning empty array');
          return res.json([]);
        }
        return res.status(500).json({ error: result.error.message });
      }
      return res.json(result.data || []);
    }
    
    if (error) {
      console.error('[cases] list error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    return res.json(data || []);
  } catch (err) {
    console.error('[cases] list error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// 2) upload evidence: multipart (file + uploader_id)
// This uploads file to Supabase storage, inserts evidence row, enqueues for background processing (non-blocking) and returns record + publicUrl
router.post('/:id/evidence', upload.single('file'), async (req, res) => {
  let { id: caseId } = req.params;
  // Sanitize caseId for storage key: allow only alphanumeric, dash, underscore
  caseId = String(caseId).replace(/[^a-zA-Z0-9_-]/g, '');
  // defensive extraction to avoid earlier 'cannot destructure' crash
  const uploader_id = (req.body && req.body.uploader_id) ? req.body.uploader_id : null;

  if (!req.file) return res.status(400).json({ error: 'no file' });
  if (!uploader_id) return res.status(400).json({ error: 'uploader_id required' });

  try {
    const localPath = req.file.path;
    const fileBuffer = fs.readFileSync(localPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const ext = req.file.originalname.split('.').pop();
    const filename = `${caseId}/${uuidv4()}.${ext}`;

    // upload to supabase storage
    const bucket = process.env.SUPABASE_BUCKET || 'evidence';
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(filename, fileBuffer, { contentType: req.file.mimetype, upsert: false });

    if (uploadErr) throw uploadErr;

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(filename)}`;

    // insert record to evidence table
    const { data, error } = await supabase
      .from('evidence')
      .insert([{
        case_id: caseId,
        uploader_id,
        file_path: filename,
        file_url: publicUrl,
        sha256,
        metadata: { original_name: req.file.originalname, mime: req.file.mimetype },
      }])
      .select()
      .single();

    // cleanup local file
    try { fs.unlinkSync(localPath); } catch (e) { /* noop */ }

    if (error) return res.status(500).json({ error });

    // enqueue for background processing (non-blocking)
    try {
      enqueueEvidence(data.id);
      console.log('[cases] enqueued evidence', data.id);
    } catch (e) {
      console.warn('[cases] enqueue failed', e);
    }

    // return evidence record + public url
    res.json({ ...data, publicUrl });
  } catch (err) {
    console.error('[cases] upload error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// Get case timeline
router.get('/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // Optional filter by event type

    // Use TimelineService to fetch real timeline events from DB
    const TimelineService = require('../services/TimelineService');
    const raw = await TimelineService.getCaseTimeline(id, true);

    // Map DB rows to API shape expected by frontend
    const timelineEvents = (raw || []).map((row) => ({
      id: String(row.id || row.id),
      caseId: row.case_id || id,
      type: row.event_type,
      title: row.event_title,
      description: row.event_description,
      actor: row.actor_name || row.actor_id || 'System',
      timestamp: row.created_at || row.createdAt || new Date().toISOString(),
      metadata: row.metadata || {}
    }));

    // Filter by type if provided
    let filtered = timelineEvents;
    if (type && type !== 'all') {
      filtered = timelineEvents.filter(event => event.type === type);
    }

    res.json({
      success: true,
      data: filtered
    });
  } catch (err) {
    console.error('[cases] timeline error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// Get single case by ID with all details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use CaseModel directly (it's already an instance)
    const caseData = await CaseModel.getCaseWithDetails(id, null);

    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json(caseData);
  } catch (err) {
    console.error('[cases] get by id error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// Update case status with workflow validation
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const filed_by = req.body.filed_by || req.user?.id;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!filed_by) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const CaseStatusService = require('../services/CaseStatusService');

    // Update status with validation
    const result = await CaseStatusService.updateCaseStatus(
      id,
      status,
      filed_by,
      reason || `Status updated to ${status}`,
      {}
    );

    // Get updated case data
    const updatedCase = await CaseModel.getCaseWithDetails(id, null);

    res.json({
      success: true,
      message: `Case status updated to ${status}`,
      case: updatedCase,
      transition: result
    });
  } catch (err) {
    console.error('[cases] status update error', err);
    
    // Check if it's a validation error
    if (err.message.includes('Cannot transition') || err.message.includes('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    
    return res.status(500).json({ error: err.message || 'Failed to update status' });
  }
});

// Get case timeline
router.get('/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const TimelineService = require('../services/TimelineService');
    
    const timeline = await TimelineService.getCaseTimeline(id, true);
    
    res.json({
      success: true,
      timeline: timeline || []
    });
  } catch (err) {
    console.error('[cases] timeline error', err);
    return res.status(500).json({ error: err.message || 'Failed to get timeline' });
  }
});

// Get workflow information for a case
router.get('/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params;
    const CaseStatusService = require('../services/CaseStatusService');
    
    // Get case
    const caseData = await CaseModel.findById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const currentStatus = caseData.status || 'draft';
    const statusInfo = CaseStatusService.getStatusInfo(currentStatus);
    const allowedTransitions = CaseStatusService.getAllowedNextStatuses(currentStatus);
    
    res.json({
      success: true,
      current_status: currentStatus,
      status_info: statusInfo,
      allowed_transitions: allowedTransitions.map(status => ({
        status,
        info: CaseStatusService.getStatusInfo(status)
      })),
      all_statuses: Object.keys(CaseStatusService.TRANSITIONS).map(status => ({
        status,
        info: CaseStatusService.getStatusInfo(status)
      }))
    });
  } catch (err) {
    console.error('[cases] workflow error', err);
    return res.status(500).json({ error: err.message || 'Failed to get workflow info' });
  }
});

// Invite parties to case
router.post('/:id/invite', async (req, res) => {
  try {
    const { id } = req.params;
    const { parties } = req.body; // Array of { name, email, role }

    if (!parties || !Array.isArray(parties)) {
      return res.status(400).json({ error: 'parties array is required' });
    }

    // Determine inviter user id (may be provided in tests via body or from authenticated req.user)
    const inviterUserId = (req.user && req.user.id) ? req.user.id : (req.body.inviter_id || null);
    if (!inviterUserId) {
      return res.status(401).json({ error: 'Authentication required to invite parties' });
    }

    const InvitationService = require('../services/InvitationService');

    const results = [];
    for (const party of parties) {
      try {
        const r = await InvitationService.inviteParty(id, inviterUserId, {
          email: party.email,
          name: party.name,
          role: party.role || 'defendant',
          message: party.message || null
        });

        if (r.success) {
          results.push({
            name: party.name,
            email: party.email,
            status: 'pending',
            invitation_token: r.invitation_token,
            invitedAt: (r.invitation && r.invitation.invited_at) || (r.expires_at ? new Date().toISOString() : new Date().toISOString())
          });
        } else {
          results.push({
            name: party.name,
            email: party.email,
            status: 'error',
            error: r.error || 'Failed to create invitation'
          });
        }
      } catch (e) {
        results.push({
          name: party.name,
          email: party.email,
          status: 'error',
          error: e.message || String(e)
        });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Processed ${results.length} invitation${results.length !== 1 ? 's' : ''}`
    });

  } catch (err) {
    console.error('[cases] invite error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

module.exports = router;

