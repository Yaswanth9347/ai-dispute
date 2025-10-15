/**
 * Manual Database Migration Helper - Priority 2
 * Generates SQL for case_notifications table
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

async function generateMigrationSQL() {
  console.log('🔄 Generating Priority 2 migration SQL...\n');

  // Check if case_notifications table exists
  const { data, error } = await supabase
    .from('case_notifications')
    .select('id')
    .limit(1);

  if (!error || error.code === 'PGRST116') {
    console.log('📋 Checking case_notifications table...\n');
    
    if (!error) {
      console.log('✅ case_notifications table already exists!\n');
      console.log('If you need to recreate it, drop it first in Supabase SQL Editor:\n');
      console.log('DROP TABLE IF EXISTS case_notifications CASCADE;\n');
      console.log('═'.repeat(80));
      return;
    }
  }

  console.log('⚠️  case_notifications table does not exist yet.\n');
  console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
  console.log('https://app.supabase.com/project/<your-project>/sql\n');
  console.log('═'.repeat(80));
  console.log('\n-- Priority 2: Create case_notifications table\n');

  const sql = `
-- Create case_notifications table
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
  `.trim();

  console.log(sql);
  console.log('\n' + '═'.repeat(80));
  console.log('\n✨ After running the SQL above, your database will be ready for email notifications!\n');
}

generateMigrationSQL().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
