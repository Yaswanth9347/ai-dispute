// backend/src/routes/evidenceStatus.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');

// GET /api/evidence/:id/status
router.get('/:id/status', async (req, res) => {
  const evidenceId = req.params.id;
  try {
    const { data, error } = await supabase
      .from('evidence')
      .select('id, case_id, uploader_id, file_path, sha256, metadata, ocr_text, transcription, created_at')
      .eq('id', evidenceId)
      .single();

    if (error) return res.status(500).json({ error });

    // build minimal status object
    const status = {
      id: data.id,
      case_id: data.case_id,
      uploaded_at: data.created_at,
      file_path: data.file_path,
      sha256: data.sha256,
      processed: !!(data.metadata && data.metadata.processed_at),
      processed_at: data.metadata && data.metadata.processed_at ? data.metadata.processed_at : null,
      has_ocr: !!(data.ocr_text && data.ocr_text.trim().length > 0),
      has_transcription: !!(data.transcription && data.transcription.trim().length > 0),
      ocr_excerpt: data.ocr_text ? (data.ocr_text.length > 300 ? data.ocr_text.slice(0,300) + '...' : data.ocr_text) : null,
      transcription_excerpt: data.transcription ? (data.transcription.length > 300 ? data.transcription.slice(0,300) + '...' : data.transcription) : null
    };

    res.json({ status });
  } catch (e) {
    res.status(500).json({ error: e.message || e });
  }
});

module.exports = router;
