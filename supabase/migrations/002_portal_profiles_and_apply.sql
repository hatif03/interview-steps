-- Portal profiles, public apply forms, recruiter scoping

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS apply_slug TEXT UNIQUE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS apply_enabled BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS apply_form_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS recruiter_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  company_size TEXT,
  industry TEXT,
  website TEXT,
  job_title TEXT,
  hiring_volume TEXT,
  email_notifications BOOLEAN DEFAULT true,
  default_scoring_preset TEXT DEFAULT 'balanced',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT,
  location TEXT,
  college TEXT,
  branch TEXT,
  graduation_year INTEGER,
  cgpa DOUBLE PRECISION,
  github_url TEXT,
  linkedin_url TEXT,
  skills TEXT[] DEFAULT '{}',
  best_ai_project TEXT,
  research_work TEXT,
  resume_url TEXT,
  resume_text TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_id ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_jobs_apply_slug ON jobs(apply_slug);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates(source);
