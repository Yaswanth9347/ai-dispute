// backend/src/routes/caseEvidenceList.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');

// GET /api/cases/:id/evidence
// returns list of evidence rows for the case with publicUrl computed
router.get('/:id/evidence', async (req, res) => {
  const caseId = req.params.id;
  try {
    const { data, error } = await supabase
      .from('evidence')
      .select('id, case_id, uploader_id, file_path, sha256, metadata, ocr_text, transcription, created_at')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error });

    const bucket = process.env.SUPABASE_BUCKET || 'evidence';
    const list = (data || []).map(row => {
      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(row.file_path)}`;
      return {
        id: row.id,
        case_id: row.case_id,
        uploader_id: row.uploader_id,
        file_path: row.file_path,
        publicUrl,
        sha256: row.sha256,
        metadata: row.metadata,
        created_at: row.created_at,
        has_ocr: !!(row.ocr_text && row.ocr_text.trim().length > 0),
        has_transcription: !!(row.transcription && row.transcription.trim().length > 0)
      };
    });

    res.json({ count: list.length, items: list });
  } catch (e) {
    res.status(500).json({ error: e.message || e });
  }
});

module.exports = router;
