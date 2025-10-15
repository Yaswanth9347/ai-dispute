#!/usr/bin/env node

/**
 * Check Cases Table Structure
 * 
 * This script checks what columns exist in the cases table
 * and identifies what's missing from Priority 1 migration.
 */

require('dotenv').config();
const { Client } = require('pg');

const REQUIRED_COLUMNS = [
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
];

async function checkTable() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  CHECKING CASES TABLE STRUCTURE');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get all columns in cases table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cases'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current Cases Table Columns:\n');
    const existingColumns = result.rows.map(row => row.column_name);
    
    result.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.column_name} (${row.data_type})`);
    });

    console.log('\n════════════════════════════════════════════════════════════════════════════════');
    console.log('  PRIORITY 1 COLUMNS CHECK');
    console.log('════════════════════════════════════════════════════════════════════════════════\n');

    const missingColumns = [];
    
    REQUIRED_COLUMNS.forEach(col => {
      const exists = existingColumns.includes(col);
      if (exists) {
        console.log(`   ✅ ${col}`);
      } else {
        console.log(`   ❌ ${col} - MISSING`);
        missingColumns.push(col);
      }
    });

    if (missingColumns.length > 0) {
      console.log('\n════════════════════════════════════════════════════════════════════════════════');
      console.log('  ⚠️  MIGRATION NEEDED!');
      console.log('════════════════════════════════════════════════════════════════════════════════\n');
      console.log(`Missing ${missingColumns.length} columns from Priority 1 migration:`);
      missingColumns.forEach(col => console.log(`   - ${col}`));
      console.log('\n💡 Run this command to apply the migration:');
      console.log('   node scripts/apply-priority1-migration.js\n');
      process.exit(1);
    } else {
      console.log('\n════════════════════════════════════════════════════════════════════════════════');
      console.log('  ✅ ALL COLUMNS PRESENT!');
      console.log('════════════════════════════════════════════════════════════════════════════════\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTable();
