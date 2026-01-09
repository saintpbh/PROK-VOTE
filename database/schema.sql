-- PROK Vote Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions Table: Meeting session metadata
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  gps_lat DECIMAL(10, 8),
  gps_lng DECIMAL(11, 8),
  gps_radius INT DEFAULT 100, -- meters
  gps_enabled BOOLEAN DEFAULT true,
  access_code CHAR(4) NOT NULL,
  code_expires_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tokens Table: QR code authentication tokens
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255),
  is_used BOOLEAN DEFAULT false,
  is_revoked BOOLEAN DEFAULT false,
  bound_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_device_per_session UNIQUE(session_id, device_fingerprint)
);

CREATE INDEX idx_tokens_session ON tokens(session_id);
CREATE INDEX idx_tokens_fingerprint ON tokens(device_fingerprint);

-- Voters Table: Verified participants
CREATE TABLE voters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  gps_lat DECIMAL(10, 8),
  gps_lng DECIMAL(11, 8),
  access_code_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_token_voter UNIQUE(token_id)
);

CREATE INDEX idx_voters_session ON voters(session_id);
CREATE INDEX idx_voters_token ON voters(token_id);

-- Agendas Table: Voting agendas/items
CREATE TABLE agendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  stage VARCHAR(50) DEFAULT 'pending', -- 'pending', 'submitted', 'voting', 'ended', 'announced'
  is_important BOOLEAN DEFAULT false, -- Important votes require re-authentication
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agendas_session ON agendas(session_id);
CREATE INDEX idx_agendas_stage ON agendas(stage);

-- Votes Table: Cast votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voter_id UUID REFERENCES voters(id) ON DELETE CASCADE,
  agenda_id UUID REFERENCES agendas(id) ON DELETE CASCADE,
  choice VARCHAR(50) NOT NULL, -- '찬성' (Approve), '반대' (Reject), '기권' (Abstain)
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_vote_per_agenda UNIQUE(voter_id, agenda_id)
);

CREATE INDEX idx_votes_agenda ON votes(agenda_id);
CREATE INDEX idx_votes_voter ON votes(voter_id);
CREATE INDEX idx_votes_choice ON votes(choice);

-- Audit Log Table: System events and security tracking
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES voters(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, -- 'token_generated', 'login_attempt', 'vote_cast', 'stage_change', etc.
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_session ON audit_logs(session_id);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agendas_updated_at BEFORE UPDATE ON agendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for quick statistics
CREATE VIEW voting_statistics AS
SELECT 
  a.id as agenda_id,
  a.title,
  a.session_id,
  COUNT(DISTINCT v.voter_id) as total_votes,
  COUNT(DISTINCT CASE WHEN v.choice = '찬성' THEN v.voter_id END) as approve_count,
  COUNT(DISTINCT CASE WHEN v.choice = '반대' THEN v.voter_id END) as reject_count,
  COUNT(DISTINCT CASE WHEN v.choice = '기권' THEN v.voter_id END) as abstain_count,
  ROUND(COUNT(DISTINCT v.voter_id)::NUMERIC / NULLIF(COUNT(DISTINCT vt.id), 0) * 100, 2) as turnout_percentage
FROM agendas a
LEFT JOIN votes v ON a.id = v.agenda_id
LEFT JOIN voters vt ON a.session_id = vt.session_id
GROUP BY a.id, a.title, a.session_id;
