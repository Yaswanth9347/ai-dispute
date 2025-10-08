// backend/src/routes/adminRevoke.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { requireAuth } = require('../lib/authMiddleware');

// POST /api/admin/revoke_sessions/:user_id
// Requires admin privileges (we protect with requireAuth; you can tighten to check req.user.sub === admin id)
router.post('/revoke_sessions/:user_id', requireAuth, async (req, res) => {
  const adminUser = req.user && req.user.sub;
  const targetUser = req.params.user_id;

  // optional: restrict to admin user ids. Edit as needed.
  const allowedAdminIds = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);
  if (allowedAdminIds.length > 0 && !allowedAdminIds.includes(String(adminUser))) {
    return res.status(403).json({ error: 'forbidden: must be admin' });
  }

  try {
    // call RPC created above
    const { data, error } = await supabase.rpc('delete_user_sessions', { p_user_id: targetUser });
    if (error) {
      console.error('rpc error', error);
      return res.status(500).json({ ok: false, error });
    }
    return res.json({ ok: true, result: data });
  } catch (e) {
    console.error('revoke err', e);
    return res.status(500).json({ ok: false, error: e.message || e });
  }
});

module.exports = router;
