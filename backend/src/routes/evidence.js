const express = require('express');
const router = express.Router();
const { processEvidence, enqueueEvidence } = require('../lib/mediaWorker');
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const supabase = require('../lib/supabaseClient');

// Configure multer
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.mimetype)) {
      const err = new Error('INVALID_FILE_TYPE');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Sanitize file names
function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Virus scan (uses system clamscan) - requires ClamAV installed
function scanFile(filePath) {
  return new Promise((resolve, reject) => {
    exec(`clamscan --no-summary "${filePath}"`, (err, stdout, stderr) => {
      // If clamscan is not installed, `exec` will error (often code 127).
      // In that case we should not fail the entire upload; log and continue.
      if (err) {
        const errMsg = (stderr || err.message || '').toString();
        if (err.code === 127 || /not found/i.test(errMsg) || /no such file or directory/i.test(errMsg)) {
          console.warn('clamscan not found on system, skipping virus scan');
          return resolve();
        }
        // clamscan exits with code 1 when a virus is found; treat that as a rejection
        if (err.code !== 1) return reject(err);
      }
      if (stdout && stdout.includes('FOUND')) return reject(new Error('VIRUS_DETECTED'));
      resolve();
    });
  });
}

// Upload evidence: POST /api/evidence/upload
// body: form-data with 'file' and optional 'case_id' and 'uploader_id'
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const originalName = req.file.originalname || 'uploaded_file';
    const sanitized = sanitizeFileName(originalName);
    const tmpPath = req.file.path; // multer temp path
    const destPath = path.join(path.dirname(tmpPath), sanitized);

    // move file to sanitized filename
    fs.renameSync(tmpPath, destPath);

    // scan for viruses
    try {
      await scanFile(destPath);
    } catch (scanErr) {
      // remove file
      try { fs.unlinkSync(destPath); } catch (e) {}
      return res.status(400).json({ success: false, error: scanErr.message || 'File failed virus scan' });
    }

    // upload to Supabase storage if configured
    const bucket = process.env.SUPABASE_BUCKET || 'evidence';
    const storagePath = `uploads/${Date.now()}_${sanitized}`;
    try {
      const fileBuffer = fs.readFileSync(destPath);
      const { data, error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });
      if (error) {
        console.warn('supabase.upload error', error);
        // continue without storage if upload fails
      }
      // build public url
      var publicUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeURIComponent(storagePath)}`;
    } catch (e) {
      console.warn('supabase upload exception', e && e.message ? e.message : e);
    }

    // create evidence DB row
    const caseId = req.body.case_id || null;
    const uploaderId = req.body.uploader_id || null;
    try {
      const insertPayload = { case_id: caseId, file_path: storagePath, metadata: { original_name: originalName, mime: req.file.mimetype }, uploader_id: uploaderId };
      const { data: evData, error: evErr } = await supabase.from('evidence').insert([insertPayload]).select().single();
      if (evErr) {
        console.warn('evidence insert error', JSON.stringify(evErr));
        console.warn('insert payload', JSON.stringify(insertPayload));
        return res.status(500).json({ success: false, error: 'failed to insert evidence', details: evErr });
      }
      const evidenceId = evData && evData.id ? evData.id : null;

      // enqueue processing
  if (evidenceId) enqueueEvidence(evidenceId);

  // remove local file now that it's uploaded
  try { fs.unlinkSync(destPath); } catch (e) {}

  return res.status(201).json({ success: true, evidenceId, storagePath, publicUrl });
    } catch (e) {
      console.error('failed to create evidence row', e);
      return res.status(500).json({ success: false, error: 'failed to save evidence record' });
    }
  } catch (err) {
    console.error('upload endpoint error', err);
    return res.status(err.status || 500).json({ success: false, error: err.message || 'internal error' });
  }
});

// Process existing evidence by id: POST /api/evidence/:id/process (keeps backward compat)
router.post('/:id/process', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await processEvidence(id);
    return res.json({ status: 'ok', result });
  } catch (err) {
    console.error('process endpoint error', err);
    return res.status(500).json({ error: err.message || err });
  }
});

module.exports = router;
