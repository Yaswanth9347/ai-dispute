#!/usr/bin/env node

/**
 * Inspect specific case data
 * Shows what's actually stored in the database for a case
 */

require('dotenv').config();
const { Client } = require('pg');

const caseRef = process.argv[2] || 'AIDR-2025-0002';

async function inspectCase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log(`  INSPECTING CASE: ${caseRef}`);
    console.log('════════════════════════════════════════════════════════════════════════════════\n');

    // Get case data
    const result = await client.query(`
      SELECT * FROM cases 
      WHERE case_reference_number = $1
    `, [caseRef]);

    if (result.rows.length === 0) {
      console.log(`❌ No case found with reference: ${caseRef}\n`);
      process.exit(1);
    }

    const caseData = result.rows[0];

    console.log('📋 Case Information:\n');
    console.log(`ID: ${caseData.id}`);
    console.log(`Reference: ${caseData.case_reference_number}`);
    console.log(`Title: ${caseData.title}`);
    console.log(`Status: ${caseData.status}`);
    console.log(`Filed By: ${caseData.filed_by}`);
    console.log(`Created By: ${caseData.created_by}`);
    console.log(`Created At: ${caseData.created_at}`);
    console.log('');

    console.log('👤 Plaintiff Information:\n');
    console.log(`Filed By ID: ${caseData.filed_by}`);
    console.log(`Phone: ${caseData.plaintiff_phone || '(not set)'}`);
    console.log(`Address: ${caseData.plaintiff_address || '(not set)'}`);
    console.log('');

    console.log('⚖️ Defendant Information:\n');
    console.log(`Name: ${caseData.other_party_name || '(not set)'}`);
    console.log(`Email: ${caseData.other_party_email || '(not set)'}`);
    console.log(`Phone: ${caseData.other_party_phone || '(not set)'}`);
    console.log(`Address: ${caseData.other_party_address || '(not set)'}`);
    console.log(`User ID: ${caseData.defendant_user_id || '(not joined yet)'}`);
    console.log('');

    console.log('📝 Case Details:\n');
    console.log(`Description: ${caseData.description || '(no description)'}`);
    console.log(`Case Type: ${caseData.case_type || '(not set)'}`);
    console.log(`Jurisdiction: ${caseData.jurisdiction || '(not set)'}`);
    console.log(`Dispute Amount: ${caseData.dispute_amount || '(not set)'} ${caseData.currency || ''}`);
    console.log('');

    console.log('⏰ Deadlines:\n');
    console.log(`Response Deadline: ${caseData.response_deadline || '(not set)'}`);
    console.log(`Submission Deadline: ${caseData.submission_deadline || '(not set)'}`);
    console.log(`Filed Date: ${caseData.filed_date || '(not set)'}`);
    console.log('');

    // Check for related data
    console.log('📎 Related Data:\n');
    
    const evidence = await client.query(`
      SELECT COUNT(*) as count FROM evidence WHERE case_id = $1
    `, [caseData.id]);
    console.log(`Evidence files: ${evidence.rows[0].count}`);

    const statements = await client.query(`
      SELECT COUNT(*) as count FROM statements WHERE case_id = $1
    `, [caseData.id]);
    console.log(`Statements: ${statements.rows[0].count}`);

    const timeline = await client.query(`
      SELECT COUNT(*) as count FROM case_timeline WHERE case_id = $1
    `, [caseData.id]);
    console.log(`Timeline entries: ${timeline.rows[0].count}`);

    console.log('');

    // Show all non-null fields
    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log('  ALL FIELDS (showing non-null values)');
    console.log('════════════════════════════════════════════════════════════════════════════════\n');

    Object.keys(caseData).forEach(key => {
      if (caseData[key] !== null) {
        const value = typeof caseData[key] === 'object' 
          ? JSON.stringify(caseData[key]) 
          : caseData[key];
        console.log(`${key}: ${value}`);
      }
    });

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

inspectCase();
