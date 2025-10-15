#!/usr/bin/env node

/**
 * Complete Migration - Add ALL Missing Columns
 * 
 * This script adds all columns that the Case model expects but are missing from the database.
 */

require('dotenv').config();
const { Client } = require('pg');

const SQL_MIGRATION = `
-- Add all missing columns to cases table

-- Add defendant/other party fields
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS other_party_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS other_party_address TEXT,
ADD COLUMN IF NOT EXISTS defendant_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS filed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cases_defendant_user_id ON cases(defendant_user_id);
CREATE INDEX IF NOT EXISTS idx_cases_filed_date ON cases(filed_date);
CREATE INDEX IF NOT EXISTS idx_cases_other_party_email ON cases(other_party_email);

-- Add comments
COMMENT ON COLUMN cases.other_party_phone IS 'Defendant/other party phone number';
COMMENT ON COLUMN cases.other_party_address IS 'Defendant/other party full address';
COMMENT ON COLUMN cases.defendant_user_id IS 'User ID of defendant if they have signed up';
COMMENT ON COLUMN cases.filed_date IS 'Date when the case was originally filed';
`;

async function applyMigration() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  APPLYING COMPLETE MIGRATION - ALL MISSING COLUMNS');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📝 Applying migration...\n');
    await client.query(SQL_MIGRATION);
    console.log('✅ Migration applied successfully!\n');

    // Verify all columns
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cases'
      AND column_name IN (
        'case_reference_number',
        'response_deadline',
        'submission_deadline',
        'status',
        'plaintiff_phone',
        'plaintiff_address',
        'defendant_phone',
        'defendant_address',
        'other_party_phone',
        'other_party_address',
        'other_party_name',
        'other_party_email',
        'defendant_user_id',
        'filed_date',
        'court_filing_number',
        'court_filing_date',
        'court_status',
        'escalation_date',
        'escalation_reason'
      )
      ORDER BY column_name;
    `);

    console.log('✅ All Case Model Columns:\n');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name} (${row.data_type})`);
    });

    const expectedColumns = [
      'case_reference_number',
      'response_deadline', 
      'submission_deadline',
      'status',
      'other_party_name',
      'other_party_email',
      'other_party_phone',
      'other_party_address',
      'defendant_user_id',
      'filed_date'
    ];

    const existingColumns = result.rows.map(r => r.column_name);
    const missingColumns = expectedColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n⚠️  Still missing columns:');
      missingColumns.forEach(col => console.log(`   - ${col}`));
      process.exit(1);
    } else {
      console.log('\n════════════════════════════════════════════════════════════════════════════════');
      console.log('  ✅ ALL COLUMNS PRESENT!');
      console.log('════════════════════════════════════════════════════════════════════════════════\n');
      console.log('📋 Database is ready for case filing!');
      console.log('\nNext steps:');
      console.log('  1. Start backend server: npm start');
      console.log('  2. Try filing a case');
      console.log('  3. Check that case is created with reference number\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
