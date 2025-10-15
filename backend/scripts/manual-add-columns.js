/**
 * Manual Database Migration - Add Case Workflow Columns
 * 
 * Run this script to add necessary columns to your Supabase cases table.
 * 
 * Usage:
 *   node backend/scripts/manual-add-columns.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumns() {
  console.log('🔄 Adding case workflow columns to cases table...\n');

  const columns = [
    { name: 'case_reference_number', type: 'text', unique: true },
    { name: 'filed_date', type: 'timestamptz', default: 'now()' },
    { name: 'response_deadline', type: 'timestamptz' },
    { name: 'submission_deadline', type: 'timestamptz' },
    { name: 'other_party_name', type: 'text' },
    { name: 'other_party_email', type: 'text' },
    { name: 'other_party_phone', type: 'text' },
    { name: 'other_party_address', type: 'text' },
    { name: 'defendant_user_id', type: 'uuid' },
    { name: 'escalation_date', type: 'timestamptz' },
    { name: 'advocate_notified', type: 'boolean', default: 'false' },
    { name: 'promissory_note_url', type: 'text' },
    { name: 'promissory_note_signed_at', type: 'timestamptz' },
    { name: 'court_reference_number', type: 'text' },
    { name: 'court_submission_date', type: 'timestamptz' },
  ];

  console.log('📋 Checking existing columns...\n');

  // Check which columns already exist
  const { data: existingColumns, error: schemaError } = await supabase
    .from('cases')
    .select('*')
    .limit(1);

  if (schemaError && schemaError.code !== 'PGRST116') {
    console.error('❌ Error checking table schema:', schemaError);
    return;
  }

  const existing = existingColumns && existingColumns.length > 0 
    ? Object.keys(existingColumns[0]) 
    : [];

  console.log(`✅ Found ${existing.length} existing columns in cases table\n`);

  console.log('📝 Columns to add:');
  columns.forEach(col => {
    const exists = existing.includes(col.name);
    console.log(`  ${exists ? '✓' : '+'} ${col.name} (${col.type})${exists ? ' - already exists' : ''}`);
  });

  console.log('\n⚠️  MANUAL STEPS REQUIRED:\n');
  console.log('Since Supabase doesn\'t allow ALTER TABLE via client libraries,');
  console.log('please run the following SQL commands in your Supabase SQL Editor:\n');
  console.log('https://app.supabase.com/project/<your-project>/sql\n');
  console.log('═'.repeat(80));
  console.log('\n-- Case Workflow Migration\n');

  columns.forEach(col => {
    if (!existing.includes(col.name)) {
      let sql = `ALTER TABLE cases ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`;
      if (col.default) sql += ` DEFAULT ${col.default}`;
      if (col.unique) sql += ` UNIQUE`;
      sql += ';';
      console.log(sql);
    }
  });

  console.log('\n-- Add indexes for performance');
  console.log('CREATE INDEX IF NOT EXISTS idx_cases_reference_number ON cases(case_reference_number);');
  console.log('CREATE INDEX IF NOT EXISTS idx_cases_other_party_email ON cases(other_party_email);');
  console.log('CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);');
  console.log('CREATE INDEX IF NOT EXISTS idx_cases_response_deadline ON cases(response_deadline);');
  console.log('CREATE INDEX IF NOT EXISTS idx_cases_submission_deadline ON cases(submission_deadline);');

  console.log('\n' + '═'.repeat(80));
  console.log('\n✨ After running the SQL above, your database will be ready!\n');
}

addColumns().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
