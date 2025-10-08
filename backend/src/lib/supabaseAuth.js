// backend/src/lib/supabaseAuth.js
const jwt = require('jsonwebtoken');
const supabase = require('./supabaseClient');

/**
 * Verify a Supabase GoTrue JWT using SUPABASE_JWT_SECRET.
 * Returns { ok: true, user: { id, email, name } } on success,
 * or { ok: false, reason } on failure.
 */
async function verifySupabaseToken(token) {
  try {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) return { ok: false, reason: 'no_jwt_secret' };

    // Verify JWT signature and expiration
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });

    // payload.sub is typically the user id
    const userId = payload && (payload.sub || payload.user_id || payload.user?.id);
    if (!userId) return { ok: false, reason: 'no_user_in_token' };

    // fetch user record (optional but useful)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', userId)
        .limit(1)
        .single();

      if (error || !data) {
        // User not present in our users table — still return ok with id
        return { ok: true, user: { id: userId, email: payload.email || null, name: payload.name || null } };
      }

      return { ok: true, user: { id: data.id, email: data.email, name: data.name } };
    } catch (e) {
      // if DB lookup fails, still return token user id
      return { ok: true, user: { id: userId, email: payload.email || null, name: payload.name || null } };
    }
  } catch (e) {
    return { ok: false, reason: 'verify_failed', error: e.message };
  }
}

module.exports = { verifySupabaseToken };
