-- Add password reset token columns to users table
-- Run this SQL in your Supabase SQL editor

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash ON users(reset_token_hash);

COMMENT ON COLUMN users.reset_token_hash IS 'SHA256 hash of the password reset token';
COMMENT ON COLUMN users.reset_token_expires_at IS 'Expiry timestamp for the reset token (typically 1 hour)';
