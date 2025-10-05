// backend/src/routes/evidenceDownload.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const path = require('path');
const jwt = require('jsonwebtoken');

const SECRET = process.env.DOWNLOAD_TOKEN_SECRET || 'dev-secret';
// allowDirect: if true, skip token requirement (not recommended for production)
const allowDirect = process.env.ALLOW_DIRECT_DOWNLOAD === 'true';

// GET /api/evidence/:id/download?token=...
router.get('/:id/download', async (req, res) => {
  const evidenceId = req.params.id;
  const token = req.query.token;

  if (!token && !allowDirect) {
    return res.status(401).json({ error: 'token required' });
  }

  if (token) {
    try {
      const payload = jwt.verify(String(token), SECRET);
      // accept either claim name 'eid' or 'evidence_id'
      const tokenEid = payload && (payload.eid || payload.evidence_id || payload.eid?.toString());
      if (!tokenEid || String(tokenEid) !== String(evidenceId)) {
        return res.status(403).json({ error: 'invalid token for this evidence' });
      }
      // token ok -> continue
    } catch (e) {
      return res.status(401).json({ error: 'token invalid or expired', reason: e.message });
    }
  }

  try {
    // fetch evidence row
    const { data: ev, error: evErr } = await supabase
      .from('evidence')
      .select('id, file_path, metadata')
      .eq('id', evidenceId)
      .single();

    if (evErr || !ev) {
      return res.status(404).json({ error: 'evidence not found' });
    }

    const bucket = process.env.SUPABASE_BUCKET || 'evidence';
    const filePath = ev.file_path;
    if (!filePath) return res.status(404).json({ error: 'no file_path for evidence' });

    // download from storage
    const { data, error: dlErr } = await supabase.storage.from(bucket).download(filePath);
    if (dlErr || !data) {
      console.error('storage download error', dlErr);
      return res.status(404).json({ error: 'file not found in storage' });
    }

    const contentType = (ev.metadata && ev.metadata.mime) || 'application/octet-stream';
    const originalName = (ev.metadata && ev.metadata.original_name) || path.basename(filePath);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');

    // data may support arrayBuffer() (fetch-like) or be a Node stream with pipe()
    if (typeof data.arrayBuffer === 'function') {
      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } else if (typeof data.pipe === 'function') {
      // Node stream: pipe directly to response
      return data.pipe(res);
    } else {
      // fallback: try arrayBuffer again (most cases should be handled above)
      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    }
  } catch (e) {
    console.error('evidence download failed', e);
    return res.status(500).json({ error: e.message || 'internal error' });
  }
});

module.exports = router;
