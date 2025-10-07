```sql
-- filepath: sql/database_schema.sql
-- ============================================================================
-- AI Dispute Resolver - Complete Database Schema
-- ============================================================================
-- This file contains the complete database schema for the AI Dispute Resolver
-- Run this entire file in your Supabase SQL Editor to set up the database
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    organization TEXT,
    bio TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'mediator')),
    is_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cases table
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    case_number TEXT UNIQUE,
    case_type TEXT NOT NULL CHECK (case_type IN ('civil', 'family', 'property', 'contract', 'employment', 'other')),
    status TEXT DEFAULT 'filed' CHECK (status IN ('filed', 'under_review', 'in_negotiation', 'settled', 'in_court', 'closed', 'rejected')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    dispute_amount DECIMAL(15, 2),
    currency TEXT DEFAULT 'INR',
    filed_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    party_ids UUID[] DEFAULT '{}',
    filing_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hearing_date TIMESTAMP WITH TIME ZONE,
    resolution_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Case parties table
CREATE TABLE IF NOT EXISTS public.case_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    party_type TEXT NOT NULL CHECK (party_type IN ('plaintiff', 'defendant', 'mediator', 'witness', 'lawyer')),
    status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'inactive', 'removed')),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(case_id, user_id, party_type)
);

-- Evidence table
CREATE TABLE IF NOT EXISTS public.evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    description TEXT,
    evidence_type TEXT CHECK (evidence_type IN ('document', 'image', 'video', 'audio', 'other')),
    is_verified BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_relevance_score DECIMAL(3, 2),
    ai_key_points JSONB,
    ocr_text TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AI ANALYSIS & SETTLEMENTS
-- ============================================================================

-- AI analysis results
CREATE TABLE IF NOT EXISTS public.ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('case_summary', 'legal_advice', 'settlement_suggestion', 'evidence_analysis', 'risk_assessment')),
    input_data JSONB NOT NULL,
    result JSONB NOT NULL,
    confidence_score DECIMAL(3, 2),
    model_version TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settlements table
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    proposed_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    settlement_type TEXT CHECK (settlement_type IN ('monetary', 'non_monetary', 'mixed')),
    terms JSONB NOT NULL,
    amount DECIMAL(15, 2),
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'under_review', 'accepted', 'rejected', 'counter_proposed', 'finalized')),
    ai_confidence_score DECIMAL(3, 2),
    ai_reasoning TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settlement responses
CREATE TABLE IF NOT EXISTS public.settlement_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID REFERENCES public.settlements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    response TEXT NOT NULL CHECK (response IN ('accept', 'reject', 'counter')),
    counter_terms JSONB,
    comments TEXT,
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- NEGOTIATION SYSTEM
-- ============================================================================

-- Active negotiation sessions
CREATE TABLE IF NOT EXISTS public.negotiation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'expired')),
    current_round INTEGER DEFAULT 1,
    max_rounds INTEGER DEFAULT 10,
    deadline TIMESTAMP WITH TIME ZONE,
    started_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    current_proposal JSONB,
    ai_enabled BOOLEAN DEFAULT true,
    rules JSONB,
    metadata JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Negotiation participants
CREATE TABLE IF NOT EXISTS public.negotiation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('plaintiff', 'defendant', 'mediator', 'observer')),
    status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'inactive')),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

-- Negotiation responses
CREATE TABLE IF NOT EXISTS public.negotiation_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    response_type TEXT NOT NULL CHECK (response_type IN ('accept', 'reject', 'counter')),
    proposal JSONB NOT NULL,
    reasoning TEXT,
    ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI-generated compromises
CREATE TABLE IF NOT EXISTS public.negotiation_compromises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    compromise_proposal JSONB NOT NULL,
    confidence_score DECIMAL(3, 2),
    reasoning TEXT,
    accepted_by UUID[] DEFAULT '{}',
    rejected_by UUID[] DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Negotiation activity log
CREATE TABLE IF NOT EXISTS public.negotiation_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.negotiation_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- DOCUMENTS & SIGNATURES
-- ============================================================================

-- Generated documents
CREATE TABLE IF NOT EXISTS public.generated_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    settlement_id UUID REFERENCES public.settlements(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('settlement_agreement', 'court_filing', 'notice', 'affidavit', 'petition', 'other')),
    template_name TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'signed', 'filed', 'archived')),
    generated_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digital signatures
CREATE TABLE IF NOT EXISTS public.document_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.generated_documents(id) ON DELETE CASCADE,
    signed_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    signature_data TEXT NOT NULL,
    ip_address INET,
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- COURT INTEGRATION
-- ============================================================================

-- Court filings
CREATE TABLE IF NOT EXISTS public.court_filings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.generated_documents(id) ON DELETE SET NULL,
    court_system TEXT NOT NULL,
    court_id TEXT,
    filing_type TEXT NOT NULL,
    filing_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'processing')),
    filed_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    response_data JSONB,
    error_message TEXT,
    filed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TIMELINE & NOTIFICATIONS
-- ============================================================================

-- Case timeline events
CREATE TABLE IF NOT EXISTS public.case_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB,
    is_milestone BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('case_update', 'settlement_proposal', 'negotiation_update', 'document_ready', 'deadline_reminder', 'system')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT false,
    link_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- WORKFLOW AUTOMATION
-- ============================================================================

-- Workflow definitions
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('case_filed', 'evidence_uploaded', 'settlement_reached', 'time_based', 'manual')),
    trigger_config JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    trigger_data JSONB,
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Cases indexes
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_filed_by ON public.cases(filed_by);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON public.cases(case_type);
CREATE INDEX IF NOT EXISTS idx_cases_filing_date ON public.cases(filing_date);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);

-- Evidence indexes
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON public.evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON public.evidence(uploaded_by);

-- Settlements indexes
CREATE INDEX IF NOT EXISTS idx_settlements_case_id ON public.settlements(case_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.settlements(status);

-- Negotiation indexes
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_case_id ON public.negotiation_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_status ON public.negotiation_sessions(status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Timeline indexes
CREATE INDEX IF NOT EXISTS idx_timeline_case_id ON public.case_timeline(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON public.case_timeline(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::uuid = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid()::uuid = id);

-- Cases policies
CREATE POLICY "Users can view cases they're involved in" ON public.cases
    FOR SELECT USING (
        auth.uid()::uuid = filed_by OR 
        auth.uid()::uuid = created_by OR 
        auth.uid()::uuid = ANY(party_ids)
    );

CREATE POLICY "Users can create cases" ON public.cases
    FOR INSERT WITH CHECK (auth.uid()::uuid = created_by);

-- Evidence policies
CREATE POLICY "Users can view evidence for their cases" ON public.evidence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.cases 
            WHERE cases.id = evidence.case_id 
            AND (cases.filed_by = auth.uid()::uuid OR auth.uid()::uuid = ANY(cases.party_ids))
        )
    );

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid()::uuid = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON public.settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_negotiation_sessions_updated_at BEFORE UPDATE ON public.negotiation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify all tables were created successfully
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
    
    RAISE NOTICE 'Database setup complete! Created % tables.', table_count;
END $$;

-- List all created tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```