-- Initial schema: screening pipeline + auth + mock interviews
-- Apply in Supabase SQL Editor or via: supabase db push

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  weight_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App user profiles (id matches auth.users.id)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('recruiter', 'candidate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  s_no INTEGER,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  college TEXT,
  branch TEXT,
  cgpa DOUBLE PRECISION,
  best_ai_project TEXT,
  research_work TEXT,
  github_url TEXT,
  resume_url TEXT,
  resume_text TEXT,
  pipeline_stage TEXT NOT NULL DEFAULT 'uploaded',
  status_message TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_pipeline_stage ON candidates(pipeline_stage);

-- Evaluations (deterministic id: candidate_id_job_id stored as id text/uuid - we use TEXT id)
CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_name TEXT,
  resume_score DOUBLE PRECISION,
  project_score DOUBLE PRECISION,
  research_score DOUBLE PRECISION,
  github_score DOUBLE PRECISION,
  jd_match_score DOUBLE PRECISION,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_job_id ON evaluations(job_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_candidate_id ON evaluations(candidate_id);

-- Composite scores
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cgpa_z DOUBLE PRECISION,
  test_la_z DOUBLE PRECISION,
  test_code_z DOUBLE PRECISION,
  semantic_score DOUBLE PRECISION,
  github_score DOUBLE PRECISION,
  composite_score DOUBLE PRECISION,
  rank INTEGER,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_job_id ON scores(job_id);
CREATE INDEX IF NOT EXISTS idx_scores_candidate_id ON scores(candidate_id);

-- Test results (one row per candidate)
CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  test_la DOUBLE PRECISION,
  test_code DOUBLE PRECISION,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_test_results_job_id ON test_results(job_id);

-- Scheduled interviews
CREATE TABLE IF NOT EXISTS scheduled_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  google_meet_link TEXT,
  calendar_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_job_id ON scheduled_interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_candidate_id ON scheduled_interviews(candidate_id);

-- Email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_job_id ON email_logs(job_id);

-- Mock interviews
CREATE TABLE IF NOT EXISTS mock_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Mixed',
  level TEXT NOT NULL DEFAULT 'Mid',
  techstack JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  finalized BOOLEAN NOT NULL DEFAULT true,
  resume_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mock_interviews_candidate_id ON mock_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_job_id ON mock_interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_user_id ON mock_interviews(user_id);

-- Mock interview sessions
CREATE TABLE IF NOT EXISTS mock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_interview_id UUID NOT NULL REFERENCES mock_interviews(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  current_question_index INTEGER NOT NULL DEFAULT 0,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mock_sessions_mock_interview_id ON mock_sessions(mock_interview_id);

-- Mock interview feedback
CREATE TABLE IF NOT EXISTS mock_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES mock_interviews(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES mock_sessions(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total_score INTEGER NOT NULL DEFAULT 0,
  category_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  areas_for_improvement JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_assessment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mock_feedback_interview_id ON mock_feedback(interview_id);
CREATE INDEX IF NOT EXISTS idx_mock_feedback_candidate_id ON mock_feedback(candidate_id);
CREATE INDEX IF NOT EXISTS idx_mock_feedback_user_id ON mock_feedback(user_id);

-- Deny all client access; backend uses service_role key
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_jobs" ON jobs FOR ALL USING (false);
CREATE POLICY "deny_all_users" ON users FOR ALL USING (false);
CREATE POLICY "deny_all_candidates" ON candidates FOR ALL USING (false);
CREATE POLICY "deny_all_evaluations" ON evaluations FOR ALL USING (false);
CREATE POLICY "deny_all_scores" ON scores FOR ALL USING (false);
CREATE POLICY "deny_all_test_results" ON test_results FOR ALL USING (false);
CREATE POLICY "deny_all_scheduled_interviews" ON scheduled_interviews FOR ALL USING (false);
CREATE POLICY "deny_all_email_logs" ON email_logs FOR ALL USING (false);
CREATE POLICY "deny_all_mock_interviews" ON mock_interviews FOR ALL USING (false);
CREATE POLICY "deny_all_mock_sessions" ON mock_sessions FOR ALL USING (false);
CREATE POLICY "deny_all_mock_feedback" ON mock_feedback FOR ALL USING (false);
