-- Migration: Add workflow columns to cases table for case filing and resolution flow
-- Date: 2025-10-15
-- Description: Adds columns needed for case reference numbers, deadlines, party information, and workflow tracking

-- Add case reference number (unique identifier)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS case_reference_number VARCHAR(50) UNIQUE;

-- Add filed date
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS filed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add response deadline (48 hours for defendant to respond)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMP WITH TIME ZONE;

-- Add submission deadline (24 hours for both parties to submit statements)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMP WITH TIME ZONE;

-- Add other party details (defendant information)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS other_party_name VARCHAR(255);

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS other_party_email VARCHAR(255);

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS other_party_phone VARCHAR(50);

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS other_party_address TEXT;

-- Add defendant user ID (once they create account and join case)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS defendant_user_id UUID REFERENCES users(id);

-- Add escalation tracking
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS escalation_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS advocate_notified BOOLEAN DEFAULT FALSE;

-- Add promissory note tracking
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS promissory_note_url TEXT;

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS promissory_note_signed_at TIMESTAMP WITH TIME ZONE;

-- Add court submission tracking
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS court_reference_number VARCHAR(100);

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS court_submission_date TIMESTAMP WITH TIME ZONE;

-- Create index on case_reference_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_cases_reference_number ON cases(case_reference_number);

-- Create index on other_party_email for faster defendant lookups
CREATE INDEX IF NOT EXISTS idx_cases_other_party_email ON cases(other_party_email);

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);

-- Create index on response_deadline for deadline monitoring
CREATE INDEX IF NOT EXISTS idx_cases_response_deadline ON cases(response_deadline);

-- Create index on submission_deadline for deadline monitoring
CREATE INDEX IF NOT EXISTS idx_cases_submission_deadline ON cases(submission_deadline);

COMMENT ON COLUMN cases.case_reference_number IS 'Unique case reference number in format AIDR-YYYY-NNNN';
COMMENT ON COLUMN cases.filed_date IS 'Date when the case was filed';
COMMENT ON COLUMN cases.response_deadline IS 'Deadline for defendant to respond (48 hours from filing)';
COMMENT ON COLUMN cases.submission_deadline IS 'Deadline for both parties to submit statements (24 hours from case acceptance)';
COMMENT ON COLUMN cases.other_party_name IS 'Name of the defendant/other party';
COMMENT ON COLUMN cases.other_party_email IS 'Email of the defendant for notifications';
COMMENT ON COLUMN cases.other_party_phone IS 'Phone number of the defendant';
COMMENT ON COLUMN cases.other_party_address IS 'Address of the defendant';
COMMENT ON COLUMN cases.defendant_user_id IS 'User ID once defendant creates account and joins case';
COMMENT ON COLUMN cases.escalation_date IS 'Date when case was escalated to advocate';
COMMENT ON COLUMN cases.advocate_notified IS 'Whether advocate has been notified about the case';
COMMENT ON COLUMN cases.promissory_note_url IS 'URL to the signed promissory note document';
COMMENT ON COLUMN cases.promissory_note_signed_at IS 'Timestamp when promissory note was signed';
COMMENT ON COLUMN cases.court_reference_number IS 'Court reference number if case is forwarded to court';
COMMENT ON COLUMN cases.court_submission_date IS 'Date when case was submitted to court';
