import type { CandidateProfile } from "@/lib/api";

/** Build a PUT payload from editable profile fields (excludes read-only / server-managed data). */
export function buildCandidateProfilePayload(
  profile: CandidateProfile
): Partial<CandidateProfile> {
  const cgpa =
    profile.cgpa != null && !Number.isNaN(profile.cgpa) ? profile.cgpa : undefined;
  const graduationYear =
    profile.graduation_year != null && !Number.isNaN(profile.graduation_year)
      ? profile.graduation_year
      : undefined;

  return {
    phone: profile.phone?.trim() || undefined,
    location: profile.location?.trim() || undefined,
    college: profile.college?.trim() || undefined,
    branch: profile.branch?.trim() || undefined,
    graduation_year: graduationYear,
    cgpa,
    github_url: profile.github_url?.trim() || undefined,
    linkedin_url: profile.linkedin_url?.trim() || undefined,
    skills: profile.skills ?? [],
    best_ai_project: profile.best_ai_project?.trim() || undefined,
    research_work: profile.research_work?.trim() || undefined,
    resume_url: profile.resume_url?.trim() || undefined,
    // resume_text is managed by parse-resume; omit from manual saves
  };
}

export function parseOptionalFloat(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = parseFloat(value);
  return Number.isNaN(n) ? undefined : n;
}

export function formatOptionalNumber(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}
