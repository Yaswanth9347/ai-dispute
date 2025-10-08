// backend/src/lib/supabaseClient.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Supabase client will be created in degraded mode. See backend/.env.example');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { persistSession: false },
  global: {
    headers: { 'x-client': 'ai-dispute-resolver-backend' }
  }
});

async function health() {
  // lightweight health check - adjust table to a small table guaranteed to exist
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: 'missing_supabase_env' };
  }
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : e };
  }
}

module.exports = { supabase, health };
