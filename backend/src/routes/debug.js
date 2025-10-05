const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authMiddleware');

router.get('/whoami', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
