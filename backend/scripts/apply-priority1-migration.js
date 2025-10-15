#!/usr/bin/env node

/**
 * Priority 1 Migration - Automatic SQL Application
 * 
 * This script applies all Priority 1 columns to the cases table:
 * - case_reference_number (unique)
 * - response_deadline (48 hours from filing)
 * - submission_deadline (24 hours after defendant joins)
 * - status (workflow states)
 * - Phone and address fields for both parties
 * - Court filing fields
 * - Escalation tracking
 */

require('dotenv').config();
const { Client } = require('pg');

const SQL_MIGRATION = `
-- Priority 1: Add case workflow and reference columns

-- Add case reference number (unique identifier)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS case_reference_number VARCHAR(50) UNIQUE;

-- Add deadline tracking columns
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMP WITH TIME ZONE;

-- Add status column with default
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';

-- Add plaintiff contact details
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS plaintiff_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS plaintiff_address TEXT;

-- Add defendant contact details
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS defendant_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS defendant_address TEXT;

-- Add court filing tracking
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS court_filing_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS court_filing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS court_status VARCHAR(50);

-- Add escalation tracking
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS escalation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_reference_number ON cases(case_reference_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_response_deadline ON cases(response_deadline);
CREATE INDEX IF NOT EXISTS idx_cases_submission_deadline ON cases(submission_deadline);

-- Add comments for documentation
COMMENT ON COLUMN cases.case_reference_number IS 'Unique case reference in format AIDR-YYYY-NNNN';
COMMENT ON COLUMN cases.response_deadline IS 'Defendant must respond within 48 hours of case filing';
COMMENT ON COLUMN cases.submission_deadline IS 'Both parties must submit final evidence within 24 hours of defendant joining';
COMMENT ON COLUMN cases.status IS 'Current workflow status: PENDING, ACTIVE, SUBMISSION_WINDOW, ANALYSIS, NEGOTIATION, RESOLVED, ESCALATED, CLOSED';
`;

async function applyMigration() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  PRIORITY 1: APPLYING DATABASE MIGRATION');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Database: ${process.env.DATABASE_URL}\n`);
    
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📝 Applying Priority 1 migration SQL...\n');
    
    await client.query(SQL_MIGRATION);
    
    console.log('✅ Migration applied successfully!\n');

    // Verify columns were added
    console.log('🔍 Verifying cases table structure...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
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
        'court_filing_number',
        'court_filing_date',
        'court_status',
        'escalation_date',
        'escalation_reason'
      )
      ORDER BY column_name;
    `);

    console.log('✅ Priority 1 columns added:\n');
    result.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? '(nullable)' : '(required)';
      const defaultVal = row.column_default ? ` [default: ${row.column_default}]` : '';
      console.log(`   ✓ ${row.column_name} (${row.data_type}) ${nullable}${defaultVal}`);
    });
    console.log('');

    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'cases'
      AND indexname LIKE 'idx_cases_%';
    `);

    console.log('✅ Indexes created:');
    indexResult.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });
    console.log('');

    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log('  ✨ PRIORITY 1 MIGRATION COMPLETE!');
    console.log('════════════════════════════════════════════════════════════════════════════════\n');
    console.log('📋 Case filing system is now ready!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Restart your backend server');
    console.log('  2. Try filing a case through the frontend');
    console.log('  3. Check that case_reference_number is generated (AIDR-2025-XXXX)');
    console.log('  4. Verify deadlines are calculated automatically');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('  1. Make sure Supabase is running (supabase status)');
    console.log('  2. Check DATABASE_URL in .env is correct');
    console.log('  3. Verify cases table exists');
    console.log('  4. Check for any conflicting column names');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

applyMigration();
