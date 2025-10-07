// backend/src/lib/authMiddleware.js
const jwt = require('jsonwebtoken');
const { verifySupabaseToken } = require('./supabaseAuth'); // keep your existing supabase verifier
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || 'dev-secret';

function getTokenFromHeader(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  if (!h) return null;
  const parts = h.split(' ');
  // allow either "Bearer <token>" or raw token
  if (parts.length === 1) return parts[0];
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

async function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'missing auth token' });

  // 1) Try Supabase token verification first (if you have verifier)
  if (typeof verifySupabaseToken === 'function') {
    try {
      const supa = await verifySupabaseToken(token);
      if (supa && supa.ok && supa.user) {
        req.user = {
          sub: supa.user.id,
          email: supa.user.email || null,
          name: supa.user.name || null,
          provider: 'supabase',
          raw: supa
        };
        // minimal debug log
        console.log('[auth] supabase token ok:', req.user.sub);
        return next();
      }
      // otherwise fall through to dev JWT
    } catch (e) {
      // don't fail hard here — fallback to dev JWT/ decode
      console.warn('[auth] supabase verify failed:', e.message || e);
    }
  }

  // 2) Try HMAC dev JWT verification (AUTH_JWT_SECRET)
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      sub: payload.sub || payload.user_id || payload.id || null,
      email: payload.email || null,
      name: payload.name || null,
      provider: 'dev',
      raw: payload
    };
    console.log('[auth] dev jwt ok:', req.user.sub);
    return next();
  } catch (errVerify) {
    // 3) Last-resort: try jwt.decode without verification (dev convenience)
    try {
      const decoded = jwt.decode(token) || {};
      if (decoded && (decoded.sub || decoded.user_id || decoded.id)) {
        req.user = {
          sub: decoded.sub || decoded.user_id || decoded.id,
          email: decoded.email || null,
          name: decoded.name || null,
          provider: 'decode',
          raw: decoded
        };
        console.log('[auth] token decoded (no verify):', req.user.sub);
        return next();
      }
    } catch (e) {
      // ignore
    }

    // If we get here, auth failed
    return res.status(401).json({ error: 'invalid auth token', detail: errVerify.message || String(errVerify) });
  }
}

module.exports = { requireAuth };
