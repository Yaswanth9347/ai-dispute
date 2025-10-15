-- Migration: Create case_notifications table
-- Date: 2025-10-15
-- Description: Track all email notifications sent for cases

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
COMMENT ON COLUMN case_notifications.notification_type IS 'Type of notification: case_filed, response_reminder, defendant_joined, submission_window, etc.';
COMMENT ON COLUMN case_notifications.status IS 'Notification status: pending, sent, failed';
COMMENT ON COLUMN case_notifications.metadata IS 'Additional data: message_id, error details, etc.';
