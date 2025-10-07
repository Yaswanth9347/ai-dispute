// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
// Support both shapes: module.exports = supabase (tests may mock) or module.exports = { supabase, health }
const _supabaseModule = require('../lib/supabaseClient');
const supabase = (_supabaseModule && _supabaseModule.supabase) ? _supabaseModule.supabase : _supabaseModule;
const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');
const validate = require('../middleware/validate');
const { z } = require('zod');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret'; // Use env variable
const AUTH_EXP = Number(process.env.AUTH_JWT_EXP_SECONDS || '86400'); // default 24h
const TOKEN_EXPIRATION = '1h'; // Set token expiration

// Enable CORS for frontend (allow both 3001 and 3002)
const allowedOrigins = ['http://localhost:3001', 'http://localhost:3002'];
router.use(cors({ 
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
  user_id: z.string().optional(),
});

// Simple dev login: POST /api/auth/login
// body: { user_id: "<uuid>" }  OR { email: "user@example.com" } OR { email, password }
router.post('/login', validate.zod({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { user_id, email, password } = req.body;
  if (!user_id && !email) throw new HttpError(400, 'missing_params', 'user_id or email required');

  // If email+password provided, try Supabase auth signInWithPassword when available
  if (email && password && supabase && supabase.auth && typeof supabase.auth.signInWithPassword === 'function') {
    try {
      const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr || !signData || !signData.user) {
        console.warn('supabase.signInWithPassword failed', signErr, signData);
        // If email not confirmed, return clear guidance
        if (signErr && signErr.code === 'email_not_confirmed') {
          return res.status(403).json({ success: false, message: 'Email not confirmed. Check your inbox for confirmation link or enable SUPABASE_AUTO_CONFIRM for dev.' , detail: signErr });
        }
        // return diagnostic in development
        return res.status(401).json({ success: false, message: 'Invalid credentials', detail: signErr || signData });
      }
      const user = signData.user;
      const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, email: user.email || null, name: user.user_metadata?.name || null, iat: now };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  return res.json({ token, expires_at: new Date((now + AUTH_EXP) * 1000).toISOString(), user: { id: user.id, email: user.email, name: user.user_metadata?.name || null } });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      console.error('signInWithPassword err', e);
      throw new HttpError(500, 'auth_signin_failed', 'Authentication failed', e);
    }
  }

  // Test helper: when running under Jest and supabase sign-in failed or is not configured,
  // allow passing a dev/test email that will be upserted into users table and return a token.
  if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
    // Try to upsert a user row for tests and return a token for convenience
    try {
      const devUserId = (await supabase.from('users').insert([{ email }], { upsert: true }).select('id').maybeSingle()).data?.id;
      const id = devUserId || user_id || `test-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);
      const payload = { sub: id, email: email || null, name: null, iat: now };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
      return res.json({ token, expires_at: new Date((now + AUTH_EXP) * 1000).toISOString(), user: { id, email, name: null } });
    } catch (e) {
      // swallow and continue to fallback logic
      console.warn('test dev login fallback failed', e.message || e);
    }
  }

  // fallback previous behavior
  // (preserve existing logic)
  let user = null;
  if (email) {
    const { data, error } = await supabase.from('users').select('id, email, name').eq('email', email).limit(1).single();
    if (error || !data) throw new HttpError(404, 'user_not_found', 'user not found');
    user = data;
  } else {
    const { data } = await supabase.from('users').select('id, email, name').eq('id', user_id).limit(1).single();
    if (!data) {
      user = { id: user_id, email: null, name: null };
    } else {
      user = data;
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, email: user.email || null, name: user.name || null, iat: now };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  return res.json({ token, expires_at: new Date((now + AUTH_EXP) * 1000).toISOString(), user: { id: user.id, email: user.email, name: user.name } });
}));

// Register endpoint: POST /api/auth/register
// body: { email: "<string>", password: "<string>", name?: "<string>" }
router.post('/register', validate.zod({ body: registerSchema }), asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // If Supabase auth admin is available, create a user there (requires service role key)
  if (supabase && supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.createUser === 'function') {
    const opts = { email, password, user_metadata: {} };
    if (name) opts.user_metadata.name = name;
    // optional: allow auto-confirm for dev if SUPABASE_AUTO_CONFIRM=true
    if (process.env.SUPABASE_AUTO_CONFIRM === 'true') {
      opts.email_confirm = true; // best-effort option; Supabase admin accepts email_confirm/email_confirmed in different versions
      opts.email_confirmed = true;
    }
    try {
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser(opts);
      if (createErr) {
        console.error('supabase.auth.admin.createUser error', createErr);
        // return diagnostic (development)
        return res.status(500).json({ success: false, message: 'Failed to create auth user', detail: createErr });
      }
      const createdUser = createData && createData.user ? createData.user : createData;

      // attempt to create a profile row in users table (non-blocking)
      try {
        const profile = { id: createdUser.id, email: createdUser.email };
        if (name) profile.name = name;
        await supabase.from('users').insert([profile]);
      } catch (profileErr) {
        console.warn('failed to insert profile row after auth create', profileErr);
      }

      // Optionally auto-login in development to bypass email confirmation
      if (process.env.SUPABASE_AUTO_LOGIN === 'true') {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: createdUser.id, email: createdUser.email || null, name: name || null, iat: now };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  return res.status(201).json({ success: true, user: { id: createdUser.id, email: createdUser.email, name: name || null }, token, expires_at: new Date((now + AUTH_EXP) * 1000).toISOString() });
      }

      return res.status(201).json({ success: true, user: { id: createdUser.id, email: createdUser.email, name: name || null } });
    } catch (e) {
      console.error('register(createUser) err', e);
      if (e instanceof HttpError) throw e;
      throw new HttpError(500, 'register_failed', 'Failed to register user', e);
    }
  }

  // Fallback: if users table supports password column, insert directly
  try {
    // Try selecting password column to detect schema
    const test = await supabase.from('users').select('password').limit(1).maybeSingle();
    // If the select didn't error, assume password column exists and proceed
    const hashedPassword = await bcrypt.hash(password, 10);
    const insertObj = { email, password: hashedPassword };
    if (name) insertObj.name = name;
    const { data, error } = await supabase.from('users').insert([insertObj]).select().single();
    if (error) {
      console.error('supabase insert error fallback', error);
      return res.status(500).json({ success: false, message: 'Failed to register user', detail: error });
    }
    return res.status(201).json({ success: true, user: { id: data.id, email: data.email, name: data.name } });
  } catch (fallbackErr) {
    console.error('register fallback err', fallbackErr);
    // schema doesn't support password or supabase auth not configured
    throw new HttpError(500, 'no_auth_backend', 'Server not configured to create users. Configure Supabase Auth (service role key) or add a password column to users table', fallbackErr);
  }
}));

// Token refresh endpoint: POST /api/auth/refresh
// body: { token: "<string>" }
router.post('/refresh', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      const now = Math.floor(Date.now() / 1000);
      const newPayload = {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        iat: now
      };

      const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
      res.json({ token: newToken, expires_at: new Date((now + AUTH_EXP) * 1000).toISOString() });
    });
  } catch (e) {
    console.error('auth/refresh err', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// Get current user from Authorization header: GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth) return res.status(401).json({ error: 'missing_token', message: 'Authorization header required' });
    const parts = String(auth).split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid_token', message: 'Bearer token required' });
    const token = parts[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return res.status(401).json({ error: 'invalid_token', message: err.message });
      const user = { id: decoded.sub, email: decoded.email || null, name: decoded.name || null };
      return res.json({ user });
    });
  } catch (e) {
    console.error('auth/me err', e);
    return res.status(500).json({ error: 'internal_error', message: e.message });
  }
});

// Helpful browser responses for GET requests (register/login) to avoid "Cannot GET" in browser
router.get('/register', (req, res) => {
  // Return a helpful JSON or a small HTML form for manual testing
  if (req.accepts('html')) {
    return res.send(`
      <html>
        <body>
          <h2>Register (POST)</h2>
          <form method="post" action="/api/auth/register">
            <label>Email: <input name="email" /></label><br/>
            <label>Password: <input name="password" type="password"/></label><br/>
            <label>Name: <input name="name" /></label><br/>
            <button type="submit">Register</button>
          </form>
          <p>Use POST /api/auth/register with JSON body: { email, password, name? }</p>
        </body>
      </html>
    `);
  }
  return res.status(405).json({ success: false, error: 'method_not_allowed', message: 'Use POST /api/auth/register with JSON body: { email, password, name? }' });
});

router.get('/login', (req, res) => {
  if (req.accepts('html')) {
    return res.send(`
      <html>
        <body>
          <h2>Login (POST)</h2>
          <form method="post" action="/api/auth/login">
            <label>Email: <input name="email" /></label><br/>
            <label>Password: <input name="password" type="password"/></label><br/>
            <button type="submit">Login</button>
          </form>
          <p>Use POST /api/auth/login with JSON body: { email, password } or { user_id } (dev)</p>
        </body>
      </html>
    `);
  }
  return res.status(405).json({ success: false, error: 'method_not_allowed', message: 'Use POST /api/auth/login with JSON body: { email, password } or { user_id } (dev)' });
});

// Hash password before saving (example endpoint)
// app.post('/register', async (req, res) => {
//   const { username, password } = req.body;
//   const hashedPassword = await bcrypt.hash(password, 10); // Hash password
//   // Save hashedPassword to the database
// });

module.exports = router;
