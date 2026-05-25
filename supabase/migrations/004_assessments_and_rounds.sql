-- Platform assessments + hiring rounds timeline

CREATE TABLE IF NOT EXISTS job_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Technical Assessment',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  config JSONB NOT NULL DEFAULT '{"mcq": 5, "dsa": 2, "sql": 1, "passing_score": 60}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_assessments_job_id ON job_assessments(job_id);

CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES job_assessments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'dsa', 'sql')),
  order_index INTEGER NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  starter_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON assessment_questions(assessment_id);

CREATE TABLE IF NOT EXISTS assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES job_assessments(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'submitted', 'graded')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_candidate ON assessment_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_job ON assessment_assignments(job_id);

CREATE TABLE IF NOT EXISTS assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assessment_assignments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  score DOUBLE PRECISION,
  is_correct BOOLEAN,
  execution_log JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_assignment ON assessment_answers(assignment_id);

CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES assessment_assignments(id) ON DELETE CASCADE,
  total_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  section_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'shortlisted', 'not_shortlisted')),
  review JSONB NOT NULL DEFAULT '{}'::jsonb,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hiring_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL
    CHECK (round_type IN ('platform_test', 'ai_interview', 'live_interview', 'legacy_test')),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  reference_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  outcome TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'shortlisted', 'not_shortlisted')),
  total_score DOUBLE PRECISION,
  review_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hiring_rounds_candidate_job ON hiring_rounds(candidate_id, job_id);
CREATE INDEX IF NOT EXISTS idx_hiring_rounds_job ON hiring_rounds(job_id);

ALTER TABLE job_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_rounds ENABLE ROW LEVEL SECURITY;
