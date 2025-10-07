// src/routes/health.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');

router.get('/', async (req, res) => {
  try {
    const dbStatus = await (supabase.health ? supabase.health() : { ok: false, error: 'no_health_fn' });
    return res.status(200).json({ ok: true, service: 'AI Dispute Resolver backend', time: new Date().toISOString(), db: dbStatus });
  } catch (e) {
    return res.status(200).json({ ok: true, service: 'AI Dispute Resolver backend', time: new Date().toISOString(), db: { ok: false, error: e && e.message ? e.message : e } });
  }
});

module.exports = router;
