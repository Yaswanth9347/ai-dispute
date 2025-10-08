/**
 * backend/scripts/getSupabaseToken.js
 * Simple script to sign-in to local Supabase and print access_token.
 * Usage:
 *   cd backend
 *   node -r dotenv/config scripts/getSupabaseToken.js dotenv_config_path=./.env
 */

require('dotenv').config();

(async () => {
  try {
    // dynamic import works under CommonJS Node to use ESM-style supabase client
    const { createClient } = await import('@supabase/supabase-js');

    const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_ANON_KEY) {
      console.error('Missing SUPABASE_ANON_KEY in environment (.env)');
      process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // TODO: replace these with a real test user email/password that exists in your Supabase (or use the one you created)
    const email = process.env.TEST_USER_EMAIL || 'yerrayaswanth2020@gmail.com';
    const password = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

    console.log('Attempting sign-in for', email, 'against', SUPABASE_URL);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login failed:', error);
      process.exit(2);
    }

    if (!data || !data.session) {
      console.error('No session returned, inspect Supabase user/password or check Supabase auth logs.');
      process.exit(3);
    }

    console.log('Access token:\n', data.session.access_token);
    console.log('Expires at:', data.session.expires_at || '(expires_in)');
    console.log('User:', data.user || data.session.user);
    process.exit(0);
  } catch (e) {
    console.error('Script error:', e);
    process.exit(4);
  }
})();
