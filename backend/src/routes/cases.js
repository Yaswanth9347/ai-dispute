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
    
    // Mock timeline data (in production, fetch from database)
    const timelineEvents = [
      {
        id: '1',
        caseId: id,
        type: 'case_filed',
        title: 'Case Filed',
        description: 'Case was filed in the system',
        timestamp: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
        metadata: { filed_by: 'John Doe' }
      },
      {
        id: '2',
        caseId: id,
        type: 'evidence_uploaded',
        title: 'Evidence Uploaded',
        description: 'New evidence document was uploaded',
        timestamp: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
        metadata: { fileName: 'contract.pdf', uploadedBy: 'John Doe' }
      },
      {
        id: '3',
        caseId: id,
        type: 'ai_analysis',
        title: 'AI Analysis Complete',
        description: 'AI analysis of evidence completed',
        timestamp: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
        metadata: { relevanceScore: 85 }
      },
      {
        id: '4',
        caseId: id,
        type: 'party_joined',
        title: 'Party Joined',
        description: 'Defendant accepted invitation',
        timestamp: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
        metadata: { partyName: 'Jane Smith', role: 'defendant' }
      },
      {
        id: '5',
        caseId: id,
        type: 'negotiation_started',
        title: 'Negotiation Started',
        description: 'Settlement negotiation initiated',
        timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
        metadata: {}
      },
      {
        id: '6',
        caseId: id,
        type: 'proposal_made',
        title: 'Proposal Made',
        description: 'Settlement proposal submitted',
        timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
        metadata: { amount: 5000, proposedBy: 'John Doe' }
      },
      {
        id: '7',
        caseId: id,
        type: 'court_filing',
        title: 'Court Filing Submitted',
        description: 'Documents filed with court',
        timestamp: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
        metadata: { courtSystem: 'PACER', filingType: 'Motion' }
      }
    ];
    
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
    
    // In production, send actual emails and store invitations
    const invitations = parties.map(party => ({
      id: uuidv4(),
      caseId: id,
      name: party.name,
      email: party.email,
      role: party.role,
      status: 'pending',
      invitedAt: new Date().toISOString(),
      token: crypto.randomBytes(32).toString('hex')
    }));
    
    // Mock email sending
    console.log(`Invitations sent for case ${id}:`, invitations.map(i => i.email));
    
    res.json({
      success: true,
      data: invitations,
      message: `Invitations sent to ${parties.length} ${parties.length === 1 ? 'party' : 'parties'}`
    });
  } catch (err) {
    console.error('[cases] invite error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

module.exports = router;

