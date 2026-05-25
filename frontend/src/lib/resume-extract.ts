export interface ExtractedProfile {
  phone?: string;
  location?: string;
  college?: string;
  branch?: string;
  graduation_year?: number;
  cgpa?: number;
  github_url?: string;
  linkedin_url?: string;
  skills?: string[];
  best_ai_project?: string;
  research_work?: string;
}

const GITHUB_RE = /https?:\/\/(?:www\.)?github\.com\/[\w-]+\/?/i;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const CGPA_RE = /(?:CGPA|GPA)[:\s]*(\d\.\d{1,2})/i;
const YEAR_RE = /(?:graduat(?:ed|ion)|class of|expected)[:\s]*(\d{4})/i;
const BRANCH_RE =
  /(?:b\.?\s*tech|bachelor(?:'s)?|major|branch|degree)\s*(?:in|of|:)?\s*([A-Za-z &/.-]{3,60})/i;

const SKILL_KEYWORDS = [
  "python",
  "javascript",
  "typescript",
  "java",
  "react",
  "node",
  "pytorch",
  "tensorflow",
  "sql",
  "aws",
  "docker",
  "kubernetes",
  "c++",
  "go",
  "rust",
  "machine learning",
  "deep learning",
  "nlp",
  "computer vision",
];

export const SUGGESTED_SKILLS = SKILL_KEYWORDS.map((s) => {
  if (s === "c++") return "C++";
  if (s === "node") return "Node.js";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
});

export function extractProfileFromResumeText(text: string): ExtractedProfile {
  const cleaned = text.trim();
  if (!cleaned) return {};

  const fields: ExtractedProfile = {};

  const gh = cleaned.match(GITHUB_RE);
  if (gh) fields.github_url = gh[0].replace(/\/$/, "");

  const li = cleaned.match(LINKEDIN_RE);
  if (li) fields.linkedin_url = li[0].replace(/\/$/, "");

  const phone = cleaned.match(PHONE_RE);
  if (phone) fields.phone = phone[0].trim();

  const cgpa = cleaned.match(CGPA_RE);
  if (cgpa) {
    const value = parseFloat(cgpa[1]);
    if (!Number.isNaN(value)) fields.cgpa = value;
  }

  const year = cleaned.match(YEAR_RE);
  if (year) {
    const value = parseInt(year[1], 10);
    if (!Number.isNaN(value)) fields.graduation_year = value;
  }

  const branch = cleaned.match(BRANCH_RE);
  if (branch) fields.branch = branch[1].trim().replace(/[.,]$/, "");

  const lower = cleaned.toLowerCase();
  const skills = SKILL_KEYWORDS.filter((s) => lower.includes(s)).map((s) => {
    if (s === "c++") return "C++";
    if (s === "node") return "Node";
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  });
  if (skills.length) {
    fields.skills = [...new Set(skills)].slice(0, 12);
  }

  const lines = cleaned.split("\n").map((ln) => ln.trim()).filter(Boolean);
  for (const line of lines) {
    const low = line.toLowerCase();
    if (
      (low.includes("university") ||
        low.includes("college") ||
        low.includes("institute") ||
        low.includes("iit") ||
        low.includes("nit")) &&
      line.length < 120 &&
      !line.includes("@")
    ) {
      fields.college = line;
      break;
    }
  }

  return fields;
}

export function mergeExtractedProfile<T extends Record<string, unknown>>(
  form: T,
  extracted: ExtractedProfile,
  resumeText?: string
): T {
  const existingSkills = Array.isArray(form.skills) ? (form.skills as string[]) : [];

  return {
    ...form,
    ...(resumeText ? { resume_text: resumeText } : {}),
    phone: (form.phone as string) || extracted.phone || "",
    location: (form.location as string) || extracted.location || "",
    college: (form.college as string) || extracted.college || "",
    branch: (form.branch as string) || extracted.branch || "",
    graduation_year:
      (form.graduation_year as string) ||
      (extracted.graduation_year != null ? String(extracted.graduation_year) : ""),
    cgpa:
      (form.cgpa as string) || (extracted.cgpa != null ? String(extracted.cgpa) : ""),
    github_url: (form.github_url as string) || extracted.github_url || "",
    linkedin_url: (form.linkedin_url as string) || extracted.linkedin_url || "",
    best_ai_project: (form.best_ai_project as string) || extracted.best_ai_project || "",
    research_work: (form.research_work as string) || extracted.research_work || "",
    skills: existingSkills,
  };
}
