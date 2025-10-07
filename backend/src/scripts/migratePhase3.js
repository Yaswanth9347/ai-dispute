// Database Migration Script for Phase 3
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Reading Phase 3 migration file...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../../../sql/08_phase3_multiparty_schema_simple.sql'),
      'utf8'
    );

    console.log('Executing Phase 3 migration...');
    await client.query(migrationSQL);

    console.log('✅ Phase 3 migration completed successfully!');
    console.log('New tables created:');
    console.log('- party_invitations');
    console.log('- settlement_negotiations');
    console.log('- negotiation_proposals');
    console.log('- proposal_responses');
    console.log('- signature_requests');
    console.log('- signature_assignments');
    console.log('- realtime_sessions');
    console.log('- realtime_activities');
    console.log('- notifications');
    console.log('- case_parties (extended)');
    console.log('- cases table extended with multi-party columns');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };