const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabaseClient');
const multer = require('multer');
const upload = multer({ dest: '/tmp/uploads' });
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { enqueueEvidence } = require('../lib/mediaWorker');

// 1) create case
router.post('/', async (req, res) => {
  const { title, filed_by, case_type, jurisdiction } = req.body;
  if (!title || !filed_by) return res.status(400).json({ error: 'missing' });

  try {
    const { data, error } = await supabase
      .from('cases')
      .insert([{ title, filed_by, case_type, jurisdiction }])
      .select()
      .single();

    if (error) return res.status(500).json({ error });
    return res.json(data);
  } catch (err) {
    console.error('[cases] create error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

// 0) list cases (GET /)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error });
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

