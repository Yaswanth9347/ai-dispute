// backend/src/routes/processCase.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { enqueueEvidence } = require('../lib/mediaWorker');

// Enqueue all evidence for a case that seems unprocessed
router.post('/:id/process', async (req, res) => {
  const caseId = req.params.id;
  try {
    const { data: evidence, error } = await supabase.from('evidence').select('*').eq('case_id', caseId);
    if (error) return res.status(500).json({ error });

    const unprocessed = evidence.filter(e => !e.metadata || !e.metadata.processed_at);
    unprocessed.forEach(e => enqueueEvidence(e.id));

    res.json({ enqueued: unprocessed.length, ids: unprocessed.map(e => e.id) });
  } catch (e) {
    res.status(500).json({ error: e.message || e });
  }
});

module.exports = router;
