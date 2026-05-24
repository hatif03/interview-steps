-- Round control: close assessment / AI interview rounds

ALTER TABLE job_assessments
  ADD COLUMN IF NOT EXISTS round_status TEXT NOT NULL DEFAULT 'open'
    CHECK (round_status IN ('open', 'closed')),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS ai_interview_round_status TEXT NOT NULL DEFAULT 'open'
    CHECK (ai_interview_round_status IN ('open', 'closed')),
  ADD COLUMN IF NOT EXISTS ai_interview_round_closed_at TIMESTAMPTZ;
