const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
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

module.exports = router;
