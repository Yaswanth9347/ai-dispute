#!/usr/bin/env node

/**
 * Priority 2 Migration - Automatic SQL Application
 * 
 * This script automatically applies the case_notifications table migration
 * to your local Supabase/PostgreSQL database.
 */

require('dotenv').config();
const { Client } = require('pg');

const SQL_MIGRATION = `
-- Priority 2: Create case_notifications table

CREATE TABLE IF NOT EXISTS case_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  notification_type VARCHAR(100) NOT NULL,
  subject TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_case_notifications_case_id ON case_notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notifications_type ON case_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_case_notifications_status ON case_notifications(status);
CREATE INDEX IF NOT EXISTS idx_case_notifications_recipient ON case_notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_case_notifications_sent_at ON case_notifications(sent_at);

-- Add comments
COMMENT ON TABLE case_notifications IS 'Tracks all email notifications sent for cases';
COMMENT ON COLUMN case_notifications.notification_type IS 'Type: case_filed, response_reminder, defendant_joined, submission_window, etc.';
COMMENT ON COLUMN case_notifications.status IS 'Status: pending, sent, failed';
COMMENT ON COLUMN case_notifications.metadata IS 'Additional data: message_id, error details, etc.';
`;

async function applyMigration() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  PRIORITY 2: APPLYING DATABASE MIGRATION');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Database: ${process.env.DATABASE_URL}\n`);
    
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📝 Applying migration SQL...\n');
    
    await client.query(SQL_MIGRATION);
    
    console.log('✅ Migration applied successfully!\n');

    // Verify table was created
    console.log('🔍 Verifying case_notifications table...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'case_notifications'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length > 0) {
      console.log('✅ Table created with columns:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
      console.log('');

      // Check indexes
      const indexResult = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'case_notifications';
      `);

      console.log('✅ Indexes created:');
      indexResult.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
      console.log('');

      console.log('════════════════════════════════════════════════════════════════════════════════');
      console.log('  ✨ MIGRATION COMPLETE!');
      console.log('════════════════════════════════════════════════════════════════════════════════\n');
      console.log('📧 Email notification system is now ready!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Start your backend server: npm start');
      console.log('  2. File a test case through the frontend');
      console.log('  3. Check terminal for email logs (development mode)');
      console.log('  4. Test signup with case_ref parameter');
      console.log('');
    } else {
      console.log('❌ Table verification failed - please check manually');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('  1. Make sure Supabase is running (supabase start)');
    console.log('  2. Check DATABASE_URL in .env is correct');
    console.log('  3. Verify cases table exists first');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

applyMigration();
