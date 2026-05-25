-- Public bucket for candidate resume PDFs (backend uploads via service role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', true, 10485760, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for recruiter pipeline / resume processing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read resumes' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read resumes"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'resumes');
  END IF;
END $$;
