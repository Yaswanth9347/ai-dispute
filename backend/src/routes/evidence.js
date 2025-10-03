const express = require('express');
const router = express.Router();
const { processEvidence } = require('../lib/mediaWorker');

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
