// backend/src/lib/authMiddleware.js
const jwt = require('jsonwebtoken');
const { verifySupabaseToken } = require('./supabaseAuth');

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret';

// helper to read Bearer token
function getTokenFromHeader(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h) return null;
  const parts = h.split(' ');
  if (parts.length !== 2) return null;
  const scheme = parts[0];
  const token = parts[1];
  if (!/^Bearer$/i.test(scheme)) return null;
  return token;
}

async function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'missing auth token' });

  // 1) Try Supabase token verification first
  try {
    const supa = await verifySupabaseToken(token);
    if (supa.ok && supa.user) {
      req.user = { sub: supa.user.id, email: supa.user.email || null, name: supa.user.name || null, provider: 'supabase' };
      return next();
    }
    // if verification failed because secret not set, continue to fallback below
  } catch (e) {
    // fallthrough to dev token verification
  }

  // 2) Fallback: dev JWT (AUTH_JWT_SECRET)
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { sub: payload.sub, email: payload.email || null, name: payload.name || null, provider: 'dev' };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid auth token', detail: e.message });
  }
}

module.exports = { requireAuth };
