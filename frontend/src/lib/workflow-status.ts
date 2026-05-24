import type { Candidate, PipelineSummary } from "@/lib/api";

export type WorkflowStepId =
  | "upload"
  | "process_resumes"
  | "ai_evaluation"
  | "rank"
  | "platform_assessment"
  | "ai_interview"
  | "test_emails"
  | "test_results"
  | "schedule_interviews";

export type StepStatus = "pending" | "running" | "completed" | "partial";

export interface WorkflowStepState {
  status: StepStatus;
  summary: string;
  allowRun: boolean;
}

const STAGE_ORDER = [
  "uploaded",
  "resume_processed",
  "evaluating",
  "evaluated",
  "ranked",
  "assessment_assigned",
  "assessment_completed",
  "test_sent",
  "test_completed",
  "shortlisted",
  "ai_interview_assigned",
  "ai_interview_completed",
  "mock_interview_assigned",
  "mock_interview_completed",
  "interview_scheduled",
  "error",
] as const;

function stageIndex(stage: string): number {
  const i = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return i >= 0 ? i : -1;
}

function isAtOrPastStage(stage: string, threshold: string): boolean {
  if (stage === "error") return false;
  const si = stageIndex(stage);
  const ti = stageIndex(threshold);
  return si >= 0 && ti >= 0 && si >= ti;
}

function isProcessingMessage(msg?: string | null): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes("processing") || lower.includes("retrying");
}

function countAtOrPast(candidates: Candidate[], threshold: string): number {
  return candidates.filter((c) => isAtOrPastStage(c.pipeline_stage, threshold)).length;
}

export function computeWorkflowSteps(
  candidates: Candidate[],
  pipeline: PipelineSummary | null,
  actionLoading: string | null,
  assessmentAssignedCount = 0,
  assessmentGradedCount = 0,
): Record<WorkflowStepId, WorkflowStepState> {
  const total = candidates.length;
  const stages = pipeline?.stages ?? {};

  const uploadedCount = candidates.filter((c) => c.pipeline_stage === "uploaded").length;
  const resumeProcessing = candidates.some(
    (c) => c.pipeline_stage === "uploaded" && isProcessingMessage(c.status_message)
  );
  const resumeReadyCount = countAtOrPast(candidates, "resume_processed");
  const evaluatingCount = candidates.filter((c) => c.pipeline_stage === "evaluating").length;
  const evaluatedCount = countAtOrPast(candidates, "evaluated");
  const rankedCount = candidates.filter((c) => c.scores?.rank != null).length;
  const aiCount =
    (stages.ai_interview_assigned ?? 0) +
    (stages.ai_interview_completed ?? 0) +
    (stages.mock_interview_assigned ?? 0) +
    (stages.mock_interview_completed ?? 0);
  const testSentCount = (stages.test_sent ?? 0) + (stages.test_completed ?? 0);
  const testDoneCount = stages.test_completed ?? 0;
  const interviewCount = stages.interview_scheduled ?? 0;
  const errorCount = stages.error ?? 0;

  const upload: WorkflowStepState = {
    status: total > 0 ? "completed" : "pending",
    summary: total > 0 ? `${total} candidate${total !== 1 ? "s" : ""} uploaded` : "No candidates yet",
    allowRun: true,
  };

  let processResumes: WorkflowStepState;
  if (total === 0) {
    processResumes = { status: "pending", summary: "Upload candidates first", allowRun: false };
  } else if (
    actionLoading === "resumes" ||
    actionLoading === "Resume processing" ||
    resumeProcessing
  ) {
    processResumes = {
      status: "running",
      summary: `Processing resumes (${uploadedCount} remaining)`,
      allowRun: false,
    };
  } else if (uploadedCount === 0 && resumeReadyCount > 0) {
    processResumes = {
      status: "completed",
      summary: `${resumeReadyCount}/${total} resumes processed`,
      allowRun: false,
    };
  } else if (uploadedCount > 0) {
    processResumes = {
      status: "partial",
      summary: `${uploadedCount} resume${uploadedCount !== 1 ? "s" : ""} pending`,
      allowRun: true,
    };
  } else {
    processResumes = { status: "pending", summary: "Ready to process", allowRun: true };
  }

  let aiEvaluation: WorkflowStepState;
  if (total === 0) {
    aiEvaluation = { status: "pending", summary: "Upload candidates first", allowRun: false };
  } else if (actionLoading === "evaluate" || actionLoading === "AI evaluation" || evaluatingCount > 0) {
    aiEvaluation = {
      status: "running",
      summary: `Evaluating (${evaluatingCount} in progress)`,
      allowRun: false,
    };
  } else if (evaluatedCount >= total - errorCount && evaluatedCount > 0 && errorCount <= total) {
    aiEvaluation = {
      status: "completed",
      summary: `${evaluatedCount}/${total} evaluated${errorCount ? ` · ${errorCount} error${errorCount !== 1 ? "s" : ""}` : ""}`,
      allowRun: false,
    };
  } else if (evaluatedCount > 0) {
    aiEvaluation = {
      status: "partial",
      summary: `${evaluatedCount}/${total} evaluated`,
      allowRun: true,
    };
  } else if (resumeReadyCount === 0) {
    aiEvaluation = { status: "pending", summary: "Process resumes first", allowRun: false };
  } else {
    aiEvaluation = { status: "pending", summary: "Ready to evaluate", allowRun: true };
  }

  let rank: WorkflowStepState;
  if (total === 0) {
    rank = { status: "pending", summary: "Upload candidates first", allowRun: false };
  } else if (actionLoading === "rank" || actionLoading === "Ranking") {
    rank = { status: "running", summary: "Computing rankings...", allowRun: false };
  } else if (rankedCount >= evaluatedCount && rankedCount > 0) {
    rank = {
      status: "completed",
      summary: `${rankedCount} candidate${rankedCount !== 1 ? "s" : ""} ranked`,
      allowRun: false,
    };
  } else if (rankedCount > 0) {
    rank = { status: "partial", summary: `${rankedCount}/${total} ranked`, allowRun: true };
  } else if (evaluatedCount === 0) {
    rank = { status: "pending", summary: "Run AI evaluation first", allowRun: false };
  } else {
    rank = { status: "pending", summary: "Ready to rank", allowRun: true };
  }

  const platformAssessment: WorkflowStepState =
    assessmentAssignedCount > 0
      ? {
          status: assessmentGradedCount > 0 ? "completed" : "partial",
          summary: `${assessmentAssignedCount} assigned · ${assessmentGradedCount} graded`,
          allowRun: true,
        }
      : rankedCount > 0
        ? { status: "pending", summary: "Create assessment and assign", allowRun: true }
        : { status: "pending", summary: "Rank candidates first", allowRun: false };

  const aiInterview: WorkflowStepState =
    aiCount > 0
      ? {
          status: "completed",
          summary: `${aiCount} AI interview${aiCount !== 1 ? "s" : ""} assigned`,
          allowRun: true,
        }
      : rankedCount > 0
        ? { status: "pending", summary: "Shortlist from assessment first", allowRun: true }
        : { status: "pending", summary: "Rank candidates first", allowRun: false };

  const testEmails: WorkflowStepState =
    testSentCount > 0
      ? {
          status: "completed",
          summary: `Legacy test links sent to ${testSentCount}`,
          allowRun: true,
        }
      : { status: "pending", summary: "Optional fallback", allowRun: rankedCount > 0 };

  const testResults: WorkflowStepState =
    testDoneCount > 0
      ? {
          status: "completed",
          summary: `${testDoneCount} with legacy test scores`,
          allowRun: true,
        }
      : { status: "pending", summary: "Optional CSV upload", allowRun: true };

  const schedule: WorkflowStepState =
    interviewCount > 0
      ? {
          status: "completed",
          summary: `${interviewCount} interview${interviewCount !== 1 ? "s" : ""} scheduled`,
          allowRun: true,
        }
      : rankedCount > 0
        ? { status: "pending", summary: "Shortlist from AI interview", allowRun: true }
        : { status: "pending", summary: "Rank candidates first", allowRun: false };

  return {
    upload,
    process_resumes: processResumes,
    ai_evaluation: aiEvaluation,
    rank,
    platform_assessment: platformAssessment,
    ai_interview: aiInterview,
    test_emails: testEmails,
    test_results: testResults,
    schedule_interviews: schedule,
  };
}
