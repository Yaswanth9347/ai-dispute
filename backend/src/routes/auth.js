// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabaseClient');

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret';
const AUTH_EXP = Number(process.env.AUTH_JWT_EXP_SECONDS || '86400'); // default 24h

// Simple dev login: POST /api/auth/login
// body: { user_id: "<uuid>" }  OR { email: "user@example.com" }
// This endpoint is intentionally simple for dev/testing only.
router.post('/login', async (req, res) => {
  try {
    const { user_id, email } = req.body;
    if (!user_id && !email) return res.status(400).json({ error: 'user_id or email required' });

    // If email provided, try to find user id from users table
    let user = null;
    if (email) {
      const { data, error } = await supabase.from('users').select('id, email, name').eq('email', email).limit(1).single();
      if (error || !data) {
        return res.status(404).json({ error: 'user not found' });
      }
      user = data;
    } else {
      // user_id provided - fetch user record if exists (optional)
      const { data } = await supabase.from('users').select('id, email, name').eq('id', user_id).limit(1).single();
      if (!data) {
        // still allow JWT for provided id (helpful in dev) but warn
        user = { id: user_id, email: null, name: null };
      } else {
        user = data;
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: user.id,
      email: user.email || null,
      name: user.name || null,
      iat: now,
      exp: now + AUTH_EXP
    };

    const token = jwt.sign(payload, JWT_SECRET);
    return res.json({ token, expires_at: new Date((now + AUTH_EXP) * 1000).toISOString(), user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error('auth/login err', e);
    return res.status(500).json({ error: e.message || 'internal error' });
  }
});

module.exports = router;
