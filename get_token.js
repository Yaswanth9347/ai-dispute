// get_token.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function signIn() {
  const email = 'yerrayaswanth2020@gmail.com';
  const password = 'Amma@9347'; // needs actual password

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('signIn error', error);
    process.exit(1);
  }
  console.log(data.session?.access_token || JSON.stringify(data.session, null, 2));
}

signIn();
