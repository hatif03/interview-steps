/** In dev, defaults to same-origin `/api` (proxied to FastAPI via next.config rewrites). */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

let tokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(fn: () => Promise<string | null>) {
  tokenProvider = null;
  tokenProvider = fn;
}

async function getToken(): Promise<string | null> {
  return tokenProvider ? tokenProvider() : null;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

function backendUnavailableMessage() {
  return "Backend unavailable. Start the API server with: cd backend && uvicorn app.main:app --reload --port 8000";
}

function normalizeApiError(status: number, detail: unknown, statusText: string) {
  const message =
    typeof detail === "string"
      ? detail
      : detail != null
        ? JSON.stringify(detail)
        : statusText || `HTTP ${status}`;

  if (
    status === 500 &&
    (message === "Internal Server Error" || statusText === "Internal Server Error")
  ) {
    return backendUnavailableMessage();
  }

  return message;
}

async function request<T>(
  path: string,
  options?: RequestInit,
  retries = 0
): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  const maxRetries = method === "GET" ? 0 : retries;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new ApiError(
          res.status,
          normalizeApiError(res.status, error.detail, res.statusText)
        );
      }
      return res.json();
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Request timed out. Check that the backend is running.");
      }
      if (err instanceof TypeError) {
        throw new Error(backendUnavailableMessage());
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("Request failed");
}

async function authRequest<T>(path: string, options?: RequestInit, retries = 0): Promise<T> {
  const token = await getToken();
  return request<T>(
    path,
    {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    },
    retries
  );
}

async function authFormRequest<T>(path: string, form: FormData): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const SCORING_PRESETS = {
  technical: { jd_match: 0.20, github: 0.25, test_code: 0.30, test_la: 0.05, project_relevance: 0.10, research_relevance: 0.05, cgpa: 0.05 },
  balanced: { jd_match: 0.25, github: 0.20, test_code: 0.20, test_la: 0.10, project_relevance: 0.10, research_relevance: 0.05, cgpa: 0.10 },
  academic: { jd_match: 0.20, github: 0.10, test_code: 0.15, test_la: 0.15, project_relevance: 0.10, research_relevance: 0.10, cgpa: 0.20 },
};

export const DEFAULT_APPLY_FORM_CONFIG = {
  fields: {
    college: { required: true, enabled: true },
    branch: { required: true, enabled: true },
    cgpa: { required: false, enabled: true },
    best_ai_project: { required: true, enabled: true },
    research_work: { required: false, enabled: true },
    github_url: { required: true, enabled: true },
    resume_url: { required: true, enabled: true },
  },
};

export const api = {
  // Jobs
  createJob: (data: JobCreatePayload) =>
    authRequest<Job>("/jobs", { method: "POST", body: JSON.stringify(data) }),
  listJobs: () => authRequest<Job[]>("/jobs"),
  getJob: (id: string) => authRequest<Job>(`/jobs/${id}`),
  updateJob: (id: string, data: Partial<JobCreatePayload> & { regenerate_slug?: boolean }) =>
    authRequest<Job>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteJob: (id: string) => authRequest(`/jobs/${id}`, { method: "DELETE" }),

  // Candidates
  uploadCandidates: async (jobId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("job_id", jobId);
    const token = await getToken();
    const res = await fetch(`${API_BASE}/candidates/upload`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  listCandidates: (params?: { job_id?: string; stage?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.job_id) query.set("job_id", params.job_id);
    if (params?.stage) query.set("stage", params.stage);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    return request<{ candidates: Candidate[]; total: number }>(`/candidates?${query}`);
  },
  getCandidate: (id: string) => request<Candidate>(`/candidates/${id}`),
  deleteCandidate: (id: string) => request(`/candidates/${id}`, { method: "DELETE" }),
  retryResume: (id: string) => request(`/candidates/${id}/retry-resume`, { method: "POST" }),
  retryEvaluation: (id: string) => request(`/candidates/${id}/retry-evaluation`, { method: "POST" }),
  getPipelineSummary: (jobId: string) => request<PipelineSummary>(`/candidates/pipeline/summary?job_id=${jobId}`),
  processResumes: (jobId: string) =>
    request(`/candidates/process-resumes?job_id=${jobId}`, { method: "POST" }),
  analyzeGithub: (jobId: string) =>
    request(`/candidates/analyze-github?job_id=${jobId}`, { method: "POST" }),

  // Evaluations
  runEvaluations: (jobId: string, candidateIds?: string[]) =>
    request("/evaluations/run", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, candidate_ids: candidateIds }),
    }),
  rankCandidates: (jobId: string) =>
    request(`/evaluations/rank?job_id=${jobId}`, { method: "POST" }),
  getRankings: (jobId: string) => request<RankingResponse>(`/evaluations/rankings/${jobId}`),
  getEvaluations: (jobId: string) => request<{ evaluations: Evaluation[]; total: number }>(`/evaluations/${jobId}`),
  getCandidateEvaluation: (candidateId: string) =>
    request<{ evaluation: Evaluation | null; score: Score | null }>(`/evaluations/candidate/${candidateId}`),

  // Tests
  uploadTestResults: async (jobId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("job_id", jobId);
    const res = await fetch(`${API_BASE}/tests/upload-results`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  getTestResults: (jobId: string) => request<{ results: TestResult[]; total: number }>(`/tests/results/${jobId}`),

  // Interviews
  scheduleInterviews: (data: {
    job_id: string;
    candidate_ids: string[];
    duration_minutes?: number;
    interviewer_email: string;
    start_date: string;
    start_hour?: number;
    gap_minutes?: number;
  }) => request("/interviews/schedule", { method: "POST", body: JSON.stringify(data) }),
  sendTestEmails: (data: {
    job_id: string;
    candidate_ids: string[];
    test_link: string;
    subject?: string;
  }) => request("/interviews/send-test-emails", { method: "POST", body: JSON.stringify(data) }),
  getInterviews: (jobId: string) => request<{ interviews: Interview[]; total: number }>(`/interviews/${jobId}`),
  getEmailLogs: (jobId: string) => request<{ emails: EmailLog[]; total: number }>(`/interviews/emails/${jobId}`),

  // Auth
  registerUser: (data: { uid: string; email: string; name: string; role: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(data) }, 1),
  getMe: (token: string) =>
    request<AppUser>("/auth/me", { headers: { Authorization: `Bearer ${token}` } }),
  linkCandidate: (token: string) =>
    request("/auth/link-candidate", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),

  getRecruiterProfile: (token?: string) =>
    token
      ? request<RecruiterProfile>("/auth/recruiter-profile", { headers: { Authorization: `Bearer ${token}` } })
      : authRequest<RecruiterProfile>("/auth/recruiter-profile"),
  updateRecruiterProfile: (data: Partial<RecruiterProfile>, token?: string) =>
    token
      ? request<RecruiterProfile>("/auth/recruiter-profile", {
          method: "PUT",
          body: JSON.stringify(data),
          headers: { Authorization: `Bearer ${token}` },
        })
      : authRequest<RecruiterProfile>("/auth/recruiter-profile", { method: "PUT", body: JSON.stringify(data) }),

  getCandidateProfile: (token?: string) =>
    token
      ? request<CandidateProfile>("/auth/candidate-profile", { headers: { Authorization: `Bearer ${token}` } })
      : authRequest<CandidateProfile>("/auth/candidate-profile"),
  updateCandidateProfile: (data: Partial<CandidateProfile>, token?: string) =>
    token
      ? request<CandidateProfile>("/auth/candidate-profile", {
          method: "PUT",
          body: JSON.stringify(data),
          headers: { Authorization: `Bearer ${token}` },
        })
      : authRequest<CandidateProfile>("/auth/candidate-profile", { method: "PUT", body: JSON.stringify(data) }),
  /** Upload resume PDF to Supabase, extract text server-side, return autofill hints. */
  uploadResume: async (file: File) => {
    const token = await getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/auth/parse-resume`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = error.detail;
      throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return res.json() as Promise<ResumeParseResult>;
  },
  /** Fetch a remote resume PDF (e.g. Google Drive) and regex-extract fields. */
  extractResumeFromUrl: async (resume_url: string) => {
    const token = await getToken();
    const form = new FormData();
    form.append("resume_url", resume_url.trim());
    const res = await fetch(`${API_BASE}/auth/parse-resume`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = error.detail;
      throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return res.json() as Promise<ResumeParseResult>;
  },

  // Public
  getPublicJob: (slug: string) => request<PublicJob>(`/public/jobs/${slug}`),
  applyToJob: (slug: string, data: ApplyFormPayload) =>
    authRequest<{ success: boolean; candidate_id: string; job_title: string }>(
      `/public/jobs/${slug}/apply`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  // Candidate portal
  getMyApplications: () => authRequest<{ applications: Application[]; total: number }>("/candidate/applications"),
  getApplicationRounds: (candidateId: string) =>
    authRequest<ApplicationRoundsResponse>(`/candidate/applications/${candidateId}/rounds`),
  getMyInterviews: () => authRequest<{ interviews: ScheduledInterview[]; total: number }>("/candidate/interviews"),
  getMyAssessments: () => authRequest<{ assignments: AssessmentAssignment[]; total: number }>("/candidate/assessments"),

  // Platform assessments
  getJobAssessment: (jobId: string) => authRequest<{ assessment: JobAssessment | null }>(`/assessments/job/${jobId}`),
  createJobAssessment: (jobId: string, data: Partial<JobAssessment>) =>
    authRequest<{ assessment: JobAssessment }>(`/assessments/job/${jobId}`, { method: "POST", body: JSON.stringify(data) }),
  updateAssessment: (assessmentId: string, data: Partial<JobAssessment>) =>
    authRequest<{ assessment: JobAssessment }>(`/assessments/${assessmentId}`, { method: "PUT", body: JSON.stringify(data) }),
  generateAssessmentQuestions: (assessmentId: string, topicHints?: string) =>
    authRequest<{ assessment: JobAssessment }>(`/assessments/${assessmentId}/generate`, {
      method: "POST",
      body: JSON.stringify({ topic_hints: topicHints }),
    }),
  addAssessmentQuestion: (assessmentId: string, data: Partial<AssessmentQuestion>) =>
    authRequest<{ question: AssessmentQuestion }>(`/assessments/${assessmentId}/questions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAssessmentQuestion: (questionId: string, data: Partial<AssessmentQuestion>) =>
    authRequest<{ question: AssessmentQuestion }>(`/assessments/questions/${questionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAssessmentQuestion: (questionId: string) =>
    authRequest(`/assessments/questions/${questionId}`, { method: "DELETE" }),
  assignAssessment: (data: { job_id: string; candidate_ids: string[]; send_email?: boolean }) =>
    authRequest("/assessments/assign", { method: "POST", body: JSON.stringify(data) }),
  getAssessmentResults: (jobId: string) =>
    authRequest<{ results: AssessmentAssignment[] }>(`/assessments/results/${jobId}`),
  shortlistAssessment: (data: { job_id: string; outcomes: Record<string, string>; send_email?: boolean }) =>
    authRequest("/assessments/shortlist", { method: "POST", body: JSON.stringify(data) }),
  getAssessmentShortlisted: (jobId: string) =>
    authRequest<{ candidate_ids: string[] }>(`/assessments/shortlisted/${jobId}`),
  getLiveShortlisted: (jobId: string) =>
    authRequest<{ candidate_ids: string[] }>(`/assessments/live-shortlisted/${jobId}`),
  getAiInterviewResults: (jobId: string) =>
    authRequest<{ results: AiInterviewResult[] }>(`/assessments/ai-interview-results/${jobId}`),
  getAssessmentAssignment: (assignmentId: string) =>
    authRequest<AssessmentAssignment>(`/assessments/assignments/${assignmentId}`),
  startAssessmentAssignment: (assignmentId: string) =>
    authRequest<AssessmentAssignment>(`/assessments/assignments/${assignmentId}/start`, { method: "POST" }),
  submitAssessment: (assignmentId: string, data: { answers: Array<{ question_id: string; response: Record<string, unknown> }>; sql_results?: Record<string, Record<string, unknown>> }) =>
    authRequest<AssessmentAssignment>(`/assessments/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  shortlistAiInterview: (data: { job_id: string; interview_ids: string[]; outcomes: Record<string, string>; send_email?: boolean }) =>
    authRequest("/assessments/ai-interview/shortlist", { method: "POST", body: JSON.stringify(data) }),
  sendInterviewEmails: (jobId: string, candidateIds: string[]) =>
    request(`/interviews/send-interview-emails?job_id=${encodeURIComponent(jobId)}&${candidateIds.map((id) => `candidate_ids=${encodeURIComponent(id)}`).join("&")}`, { method: "POST" }),

  // Automated AI interviews (legacy API path)
  assignMockInterview: (data: {
    job_id: string;
    candidate_ids: string[];
    interview_type?: string;
    question_count?: number;
    send_email?: boolean;
  }) => request("/mock-interviews/assign", { method: "POST", body: JSON.stringify(data) }),
  getCandidateMockInterviews: (candidateId: string) =>
    request<{ interviews: MockInterview[]; total: number }>(`/mock-interviews/candidate/${candidateId}`),
  getUserMockInterviews: (userId: string, email?: string) => {
    const q = email ? `?email=${encodeURIComponent(email)}` : "";
    return request<{ interviews: MockInterview[]; total: number }>(`/mock-interviews/user/${userId}${q}`);
  },
  getMockInterview: (id: string) => request<MockInterview>(`/mock-interviews/${id}`),
  startMockSession: (interviewId: string, userId?: string) =>
    request<{ sessionId: string; assistantMessage: string; isComplete: boolean }>(
      `/mock-interviews/${interviewId}/sessions`,
      { method: "POST", body: JSON.stringify({ user_id: userId }) }
    ),
  mockInterviewTurn: (sessionId: string, userMessage: string) =>
    request<{ assistantMessage: string; isComplete: boolean; currentQuestionIndex: number }>(
      `/mock-interviews/sessions/${sessionId}/turn`,
      { method: "POST", body: JSON.stringify({ user_message: userMessage }) }
    ),
  mockInterviewFeedback: (sessionId: string, feedbackId?: string) =>
    request<MockFeedback & { feedbackId: string }>(
      `/mock-interviews/sessions/${sessionId}/feedback`,
      { method: "POST", body: JSON.stringify({ feedback_id: feedbackId }) }
    ),
  getMockFeedback: (interviewId: string) =>
    request<MockFeedback>(`/mock-interviews/feedback/${interviewId}`),
};

// Types
export interface JobCreatePayload {
  title: string;
  description: string;
  weight_config?: Record<string, number>;
  apply_enabled?: boolean;
  apply_form_config?: Record<string, unknown>;
  status?: string;
  location?: string;
  job_type?: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  weight_config: Record<string, number>;
  created_at: string;
  candidate_count?: number;
  recruiter_id?: string;
  apply_slug?: string;
  apply_enabled?: boolean;
  apply_form_config?: Record<string, unknown>;
  status?: string;
  location?: string;
  job_type?: string;
  company_name?: string;
}

export interface PublicJob {
  slug: string;
  title: string;
  description: string;
  location?: string;
  job_type?: string;
  company_name?: string;
  apply_form_config?: Record<string, unknown>;
  status?: string;
}

export interface ApplyFormPayload {
  college?: string;
  branch?: string;
  cgpa?: number;
  best_ai_project?: string;
  research_work?: string;
  github_url?: string;
  resume_url?: string;
}

export interface RecruiterProfile {
  user_id: string;
  company_name?: string;
  company_size?: string;
  industry?: string;
  website?: string;
  job_title?: string;
  hiring_volume?: string;
  email_notifications?: boolean;
  default_scoring_preset?: string;
  onboarding_completed?: boolean;
}

export interface CandidateProfile {
  user_id: string;
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
  resume_url?: string;
  resume_text?: string;
  onboarding_completed?: boolean;
}

export interface ResumeParseResult {
  resume_text: string;
  resume_url?: string;
  extracted: Partial<{
    phone: string;
    location: string;
    college: string;
    branch: string;
    graduation_year: number;
    cgpa: number;
    github_url: string;
    linkedin_url: string;
    skills: string[];
    best_ai_project: string;
    research_work: string;
  }>;
}

export interface Application {
  candidate_id: string;
  job_id: string;
  job_title: string;
  company_name?: string;
  pipeline_stage: string;
  status_message?: string;
  source: string;
  applied_at: string;
  composite_score?: number;
  rank?: number;
  current_round?: string;
  latest_outcome?: string;
}

export interface HiringRound {
  id: string;
  candidate_id: string;
  job_id: string;
  round_type: string;
  attempt_number: number;
  reference_id?: string;
  status: string;
  outcome: string;
  total_score?: number;
  review_summary?: Record<string, unknown>;
  email_sent: boolean;
  created_at: string;
  completed_at?: string;
  detail?: Record<string, unknown>;
}

export interface ApplicationRoundsResponse {
  candidate_id: string;
  job_id: string;
  job_title: string;
  pipeline_stage: string;
  status_message?: string;
  rounds: HiringRound[];
}

export interface JobAssessment {
  id: string;
  job_id: string;
  title: string;
  duration_minutes: number;
  config: { mcq?: number; dsa?: number; sql?: number; passing_score?: number };
  status: "draft" | "published";
  questions?: AssessmentQuestion[];
  created_at?: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  type: "mcq" | "dsa" | "sql";
  order_index: number;
  prompt: string;
  options: string[];
  correct_answer?: Record<string, unknown>;
  starter_code?: string;
  metadata?: Record<string, unknown>;
  source: string;
}

export interface AssessmentResult {
  id: string;
  assignment_id: string;
  total_score: number;
  section_scores: Record<string, number>;
  outcome: "pending" | "shortlisted" | "not_shortlisted";
  review?: {
    strengths?: string[];
    areas_for_improvement?: string[];
    future_suggestions?: string[];
    summary?: string;
  };
  graded_at?: string;
}

export interface AssessmentAssignment {
  id: string;
  assessment_id: string;
  candidate_id: string;
  job_id: string;
  attempt_number: number;
  status: string;
  assigned_at: string;
  started_at?: string;
  submitted_at?: string;
  assessment?: JobAssessment;
  questions?: AssessmentQuestion[];
  answers?: Array<Record<string, unknown>>;
  result?: AssessmentResult;
  job_title?: string;
  candidate?: Candidate;
}

export interface ScheduledInterview {
  id: string;
  candidate_id: string;
  job_id: string;
  scheduled_at: string;
  duration_minutes: number;
  google_meet_link?: string;
  status: string;
  job_title?: string;
  candidate_name?: string;
}

export interface Candidate {
  id: string;
  job_id: string;
  s_no?: number;
  name: string;
  email: string;
  college?: string;
  branch?: string;
  cgpa?: number;
  best_ai_project?: string;
  research_work?: string;
  github_url?: string;
  resume_url?: string;
  resume_text?: string;
  pipeline_stage: string;
  status_message?: string | null;
  source?: string;
  applied_at?: string;
  created_at: string;
  scores?: Score | null;
}

export interface Evaluation {
  id: string;
  candidate_id: string;
  job_id: string;
  resume_score?: number;
  project_score?: number;
  research_score?: number;
  github_score?: number;
  jd_match_score?: number;
  explanation?: Record<string, unknown>;
  created_at: string;
  candidates?: { name: string; email: string };
}

export interface Score {
  id: string;
  candidate_id: string;
  job_id: string;
  cgpa_z?: number;
  test_la_z?: number;
  test_code_z?: number;
  semantic_score?: number;
  github_score?: number;
  composite_score?: number;
  rank?: number;
  score_breakdown?: Record<string, { raw: number; weight: number; weighted: number }>;
}

export interface TestResult {
  id: string;
  candidate_id: string;
  test_la?: number;
  test_code?: number;
  uploaded_at: string;
  candidates?: { name: string; email: string };
}

export interface Interview {
  id: string;
  candidate_id: string;
  job_id: string;
  scheduled_at: string;
  duration_minutes: number;
  google_meet_link?: string;
  calendar_event_id?: string;
  status: string;
  created_at: string;
  candidates?: { name: string; email: string };
}

export interface EmailLog {
  id: string;
  candidate_id: string;
  email_type: string;
  status: string;
  sent_at: string;
  candidates?: { name: string; email: string };
}

export interface PipelineSummary {
  job_id: string;
  stages: Record<string, number>;
}

export interface RankingResponse {
  job_id: string;
  rankings: Array<Score & { candidates?: Candidate }>;
  total: number;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "recruiter" | "candidate";
}

export interface AiInterviewResult {
  id: string;
  job_id: string;
  candidate_id: string;
  role: string;
  type: string;
  level: string;
  attempt_number?: number;
  created_at: string;
  feedback?: MockFeedback | null;
  outcome?: string | null;
  candidate?: Candidate;
}

export interface MockInterview {
  id: string;
  job_id: string;
  candidate_id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  finalized: boolean;
  created_at: string;
  feedback?: MockFeedback | null;
}

export interface MockFeedback {
  id: string;
  interview_id: string;
  total_score: number;
  category_scores: Array<{ name: string; score: number; comment: string }>;
  strengths: string[];
  areas_for_improvement: string[];
  final_assessment: string;
  created_at: string;
}

export const STAGE_LABELS: Record<string, string> = {
  uploaded: "Application received",
  resume_processed: "Resume reviewed",
  evaluating: "Under AI evaluation",
  evaluated: "Evaluation complete",
  ranked: "Ranked in pool",
  assessment_assigned: "Platform assessment assigned",
  assessment_completed: "Platform assessment completed",
  test_sent: "Legacy assessment sent",
  test_completed: "Legacy assessment completed",
  shortlisted: "Shortlisted",
  ai_interview_assigned: "Automated AI interview assigned",
  ai_interview_completed: "Automated AI interview done",
  mock_interview_assigned: "Automated AI interview assigned",
  mock_interview_completed: "Automated AI interview done",
  interview_scheduled: "Live interview scheduled",
  error: "Needs attention",
};

export const ROUND_TYPE_LABELS: Record<string, string> = {
  platform_test: "Platform Assessment",
  ai_interview: "Automated AI Interview",
  live_interview: "Live Interview",
  legacy_test: "External Assessment",
};
