// src/routes/health.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ ok: true, service: 'AI Dispute Resolver backend', time: new Date().toISOString() });
});

module.exports = router;
