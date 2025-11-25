-- AI Conversation History Table
-- Stores chat history between users and AI assistant for each case/dispute

CREATE TABLE IF NOT EXISTS ai_conversation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_conv_case_user ON ai_conversation_history(case_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_created_at ON ai_conversation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conv_case_created ON ai_conversation_history(case_id, created_at DESC);

-- Comments
COMMENT ON TABLE ai_conversation_history IS 'Stores AI chat conversation history per case and user';
COMMENT ON COLUMN ai_conversation_history.case_id IS 'Reference to the case/dispute this conversation belongs to';
COMMENT ON COLUMN ai_conversation_history.user_id IS 'User who owns this message';
COMMENT ON COLUMN ai_conversation_history.message IS 'Text content of the message';
COMMENT ON COLUMN ai_conversation_history.role IS 'Message role: user or assistant';
COMMENT ON COLUMN ai_conversation_history.attachments IS 'JSON array of file attachments with metadata';
COMMENT ON COLUMN ai_conversation_history.metadata IS 'Additional metadata like analysis results, tokens, etc.';
