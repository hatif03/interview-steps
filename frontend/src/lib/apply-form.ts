import type { ApplyFormPayload, CandidateProfile } from "@/lib/api";
import { DEFAULT_APPLY_FORM_CONFIG } from "@/lib/api";
import { mergeExtractedProfile, type ExtractedProfile } from "@/lib/resume-extract";

export type ApplyFormFieldKey =
  | "college"
  | "branch"
  | "cgpa"
  | "github_url"
  | "best_ai_project"
  | "research_work"
  | "resume_url";

export type ApplyFormFieldConfig = {
  required: boolean;
  enabled: boolean;
};

export type ApplyFormState = ApplyFormPayload & {
  resume_text?: string;
};

export const APPLY_FIELD_LABELS: Record<ApplyFormFieldKey, string> = {
  college: "College",
  branch: "Branch",
  cgpa: "CGPA",
  github_url: "GitHub URL",
  best_ai_project: "Best AI Project",
  research_work: "Research Work",
  resume_url: "Resume URL",
};

export function getApplyFormConfig(jobConfig?: Record<string, unknown>) {
  const fields = (jobConfig?.fields as Record<string, ApplyFormFieldConfig> | undefined) ?? {};
  const defaults = DEFAULT_APPLY_FORM_CONFIG.fields as Record<string, ApplyFormFieldConfig>;
  const merged: Record<ApplyFormFieldKey, ApplyFormFieldConfig> = {
    college: { ...defaults.college, ...fields.college },
    branch: { ...defaults.branch, ...fields.branch },
    cgpa: { ...defaults.cgpa, ...fields.cgpa },
    github_url: { ...defaults.github_url, ...fields.github_url },
    best_ai_project: { ...defaults.best_ai_project, ...fields.best_ai_project },
    research_work: { ...defaults.research_work, ...fields.research_work },
    resume_url: { ...defaults.resume_url, ...fields.resume_url },
  };
  return merged;
}

export function profileToApplyForm(profile: CandidateProfile | null | undefined): ApplyFormState {
  if (!profile) return {};
  return {
    college: profile.college,
    branch: profile.branch,
    cgpa: profile.cgpa,
    best_ai_project: profile.best_ai_project,
    research_work: profile.research_work,
    github_url: profile.github_url,
    resume_url: profile.resume_url,
    resume_text: profile.resume_text,
  };
}

export function mergeApplyFormWithExtracted(
  form: ApplyFormState,
  extracted: ExtractedProfile,
  resumeUrl?: string,
  resumeText?: string
): ApplyFormState {
  const merged = mergeExtractedProfile(
    {
      college: form.college || "",
      branch: form.branch || "",
      cgpa: form.cgpa != null ? String(form.cgpa) : "",
      github_url: form.github_url || "",
      best_ai_project: form.best_ai_project || "",
      research_work: form.research_work || "",
    },
    extracted,
    resumeText
  );

  return {
    ...form,
    college: form.college || merged.college || undefined,
    branch: form.branch || merged.branch || undefined,
    cgpa: form.cgpa ?? (merged.cgpa ? parseFloat(merged.cgpa) : undefined),
    github_url: form.github_url || merged.github_url || undefined,
    best_ai_project: form.best_ai_project || merged.best_ai_project || undefined,
    research_work: form.research_work || merged.research_work || undefined,
    resume_url: resumeUrl || form.resume_url,
    resume_text: resumeText || form.resume_text,
  };
}

export function applyFormToProfilePayload(form: ApplyFormState): Partial<CandidateProfile> {
  const cgpa =
    form.cgpa != null && !Number.isNaN(form.cgpa) ? form.cgpa : undefined;

  return {
    college: form.college?.trim() || undefined,
    branch: form.branch?.trim() || undefined,
    cgpa,
    github_url: form.github_url?.trim() || undefined,
    best_ai_project: form.best_ai_project?.trim() || undefined,
    research_work: form.research_work?.trim() || undefined,
    resume_url: form.resume_url?.trim() || undefined,
  };
}

export function hasResume(form: ApplyFormState, profile?: CandidateProfile | null): boolean {
  return !!(
    form.resume_url?.trim() ||
    form.resume_text?.trim() ||
    profile?.resume_url?.trim() ||
    profile?.resume_text?.trim()
  );
}

export function resumeDisplayLabel(resumeUrl?: string | null): string {
  if (!resumeUrl?.trim()) return "Stored resume";
  try {
    const path = new URL(resumeUrl).pathname;
    const name = path.split("/").pop();
    if (name && name.includes(".")) return decodeURIComponent(name);
  } catch {
    // not a valid URL
  }
  if (resumeUrl.includes("/storage/v1/object/public/resumes/")) {
    return "Uploaded resume (PDF)";
  }
  return "Resume on file";
}

export function isStoredSupabaseResume(resumeUrl?: string | null): boolean {
  return !!resumeUrl?.includes("/storage/v1/object/public/resumes/");
}
