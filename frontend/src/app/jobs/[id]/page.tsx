// @ts-nocheck
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Job, Candidate, PipelineSummary, type AssessmentAssignment } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/loading";
import { CopyLinkButton } from "@/components/copy-link-button";
import { LinkButton } from "@/components/link-button";
import { FileDropzone, downloadCsvTemplate } from "@/components/file-dropzone";
import { WorkflowStepCard } from "@/components/workflow-step-card";
import { WorkflowRunButton, WorkflowFileUpload } from "@/components/workflow-run-button";
import { computeWorkflowSteps } from "@/lib/workflow-status";
import { RoundReviewPanel } from "@/components/assessment/RoundReviewPanel";
import type { AiInterviewResult } from "@/lib/api";
import {
  Upload,
  Brain,
  Send,
  Calendar,
  FileText,
  GitFork,
  Trophy,
  ChevronRight,
  Loader2,
  Trash2,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
} from "lucide-react";

const STAGE_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  uploaded: { label: "Uploaded", color: "bg-gray-100 text-gray-700", icon: Clock },
  resume_processed: { label: "Resume Processed", color: "bg-blue-100 text-blue-700", icon: FileText },
  evaluating: { label: "Evaluating...", color: "bg-yellow-100 text-yellow-700 animate-pulse", icon: Brain },
  evaluated: { label: "AI Evaluated", color: "bg-purple-100 text-purple-700", icon: CheckCircle2 },
  ranked: { label: "Ranked", color: "bg-amber-100 text-amber-700", icon: Trophy },
  test_sent: { label: "Test Sent", color: "bg-cyan-100 text-cyan-700", icon: Send },
  test_completed: { label: "Test Done", color: "bg-teal-100 text-teal-700", icon: CheckCircle2 },
  shortlisted: { label: "Shortlisted", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  mock_interview_assigned: { label: "AI Interview", color: "bg-indigo-100 text-indigo-700", icon: Brain },
  mock_interview_completed: { label: "AI Interview Done", color: "bg-violet-100 text-violet-700", icon: CheckCircle2 },
  assessment_assigned: { label: "Assessment Assigned", color: "bg-cyan-100 text-cyan-700", icon: Send },
  assessment_completed: { label: "Assessment Done", color: "bg-teal-100 text-teal-700", icon: CheckCircle2 },
  ai_interview_assigned: { label: "AI Interview", color: "bg-indigo-100 text-indigo-700", icon: Brain },
  ai_interview_completed: { label: "AI Interview Done", color: "bg-violet-100 text-violet-700", icon: CheckCircle2 },
  interview_scheduled: { label: "Interview", color: "bg-emerald-100 text-emerald-700", icon: Calendar },
  error: { label: "Error", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

function ScoreCell({ entry, label }: { entry?: { raw: number; weight: number; weighted: number }; label: string }) {
  if (!entry) {
    return <TableCell className="font-mono text-sm text-muted-foreground">—</TableCell>;
  }
  return (
    <TableCell className="font-mono text-sm">
      <Tooltip>
        <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4 decoration-muted-foreground/40">
          {(entry.raw * 100).toFixed(0)}%
        </TooltipTrigger>
        <TooltipContent side="top" className="text-left">
          <p className="font-semibold mb-1">{label}</p>
          <div className="space-y-0.5 text-[11px] font-mono">
            <div className="flex justify-between gap-4">
              <span className="opacity-70">Raw score</span>
              <span>{(entry.raw * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="opacity-70">Weight</span>
              <span>{(entry.weight * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-white/20 pt-0.5 font-semibold">
              <span>Contribution</span>
              <span>{(entry.weighted * 100).toFixed(1)}%</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TableCell>
  );
}

function CandidatePicker({
  candidates,
  selectedIds,
  onToggle,
  topN,
  onSetTopN,
  onApplyTopN,
  open,
  onToggleOpen,
}: {
  candidates: Candidate[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  topN: number;
  onSetTopN: (n: number) => void;
  onApplyTopN: () => void;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const [nameSearch, setNameSearch] = useState("");

  const filteredCandidates = nameSearch.trim()
    ? candidates.filter((c) => c.name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
    : candidates;

  const selectedNotInFiltered = nameSearch.trim()
    ? candidates.filter((c) => selectedIds.has(c.id) && !c.name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
    : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5">
          <Label className="text-xs whitespace-nowrap">Top</Label>
          <Input
            type="number"
            min={1}
            max={candidates.length || 10}
            value={topN}
            onChange={(e) => onSetTopN(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-7 w-16 text-xs"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={onApplyTopN}>
            Apply
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onToggleOpen}>
          {open ? "Hide" : "Edit"} ({selectedIds.size})
        </Button>
      </div>
      {open && (
        <div className="space-y-2">
          <Input
            placeholder="Search by name to add..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/30">
            {filteredCandidates.map((c) => {
              const checked = selectedIds.has(c.id);
              const rank = c.scores?.rank;
              return (
                <label key={c.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm hover:bg-accent ${checked ? "bg-accent/50" : ""}`}>
                  <Checkbox checked={checked} onCheckedChange={() => onToggle(c.id)} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.scores?.composite_score != null && (
                    <span className="text-xs font-mono text-muted-foreground">{(c.scores.composite_score * 100).toFixed(1)}%</span>
                  )}
                  {rank && <span className="text-[10px] text-muted-foreground">#{rank}</span>}
                </label>
              );
            })}
            {filteredCandidates.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No candidates match "{nameSearch}"</p>
            )}
          </div>
          {selectedNotInFiltered.length > 0 && (
            <p className="text-[10px] text-muted-foreground">+ {selectedNotInFiltered.length} selected not shown (filtered out)</p>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{selectedIds.size} candidate{selectedIds.size !== 1 ? "s" : ""} selected</p>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const [testLink, setTestLink] = useState("");
  const [testTopN, setTestTopN] = useState(5);
  const [testSelectedIds, setTestSelectedIds] = useState<Set<string>>(new Set());
  const [testPickerOpen, setTestPickerOpen] = useState(false);

  const [interviewerEmail, setInterviewerEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [interviewTopN, setInterviewTopN] = useState(5);
  const [interviewSelectedIds, setInterviewSelectedIds] = useState<Set<string>>(new Set());
  const [interviewPickerOpen, setInterviewPickerOpen] = useState(false);

  const [mockTopN, setMockTopN] = useState(5);
  const [mockSelectedIds, setMockSelectedIds] = useState<Set<string>>(new Set());
  const [mockPickerOpen, setMockPickerOpen] = useState(false);
  const [mockSendEmail, setMockSendEmail] = useState(true);

  const [assessmentTopN, setAssessmentTopN] = useState(5);
  const [assessmentSelectedIds, setAssessmentSelectedIds] = useState<Set<string>>(new Set());
  const [assessmentPickerOpen, setAssessmentPickerOpen] = useState(false);
  const [assessmentSendEmail, setAssessmentSendEmail] = useState(true);
  const [assessmentResults, setAssessmentResults] = useState<AssessmentAssignment[]>([]);
  const [aiInterviewResults, setAiInterviewResults] = useState<AiInterviewResult[]>([]);
  const [shortlistedIds, setShortlistedIds] = useState<string[]>([]);
  const [liveShortlistedIds, setLiveShortlistedIds] = useState<string[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [sendInterviewEmail, setSendInterviewEmail] = useState(true);

  const toggleTestCandidate = (id: string) => {
    setTestSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleInterviewCandidate = (id: string) => {
    setInterviewSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleMockCandidate = (id: string) => {
    setMockSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAssessmentCandidate = (id: string) => {
    setAssessmentSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const prevCandidatesRef = useRef<Candidate[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [j, c, p, ar, sl, air, liveSl] = await Promise.all([
        api.getJob(jobId),
        api.listCandidates({ job_id: jobId, limit: 200 }),
        api.getPipelineSummary(jobId),
        api.getAssessmentResults(jobId).catch(() => ({ results: [] })),
        api.getAssessmentShortlisted(jobId).catch(() => ({ candidate_ids: [] })),
        api.getAiInterviewResults(jobId).catch(() => ({ results: [] })),
        api.getLiveShortlisted(jobId).catch(() => ({ candidate_ids: [] })),
      ]);
      setAssessmentResults(ar.results || []);
      setAiInterviewResults(air.results || []);
      setShortlistedIds(sl.candidate_ids || []);
      setLiveShortlistedIds(liveSl.candidate_ids || []);
      setJob(j);
      setPipeline(p);

      // Detect transitions and fire toasts
      const prev = prevCandidatesRef.current;
      if (prev.length > 0) {
        const prevMap = new Map(prev.map((x) => [x.id, x]));
        let newlyCompleted = 0;
        let newlyFailed = 0;
        for (const cand of c.candidates) {
          const old = prevMap.get(cand.id);
          if (!old) continue;
          if (old.pipeline_stage === "evaluating" && cand.pipeline_stage === "evaluated") newlyCompleted++;
          if (old.pipeline_stage !== "error" && cand.pipeline_stage === "error") newlyFailed++;
        }
        if (newlyCompleted > 0) toast.success(`${newlyCompleted} candidate${newlyCompleted > 1 ? "s" : ""} evaluation complete`);
        if (newlyFailed > 0) toast.error(`${newlyFailed} candidate${newlyFailed > 1 ? "s" : ""} failed — check error details`);

        const allDone = c.candidates.every((x) => x.pipeline_stage !== "evaluating" && !(x.status_message && x.status_message.includes("Processing")));
        const wasBusy = prev.some((x) => x.pipeline_stage === "evaluating" || (x.status_message && x.status_message.includes("Processing")));
        if (wasBusy && allDone && c.candidates.length > 0) {
          const errCount = c.candidates.filter((x) => x.pipeline_stage === "error").length;
          if (errCount === 0) toast.success("All processing complete!");
          else toast.warning(`Processing finished with ${errCount} error${errCount > 1 ? "s" : ""}`);
        }
      }

      prevCandidatesRef.current = c.candidates;
      setCandidates(c.candidates);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh while any candidate is in a processing state
  useEffect(() => {
    const hasProcessing = candidates.some(
      (c) => c.pipeline_stage === "evaluating" || c.pipeline_stage === "uploaded" ||
             (c.status_message && c.status_message.includes("Processing"))
    );
    if (hasProcessing) {
      autoRefreshRef.current = setInterval(refresh, 3000);
    } else if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [candidates, refresh]);

  const handleUploadFile = async (file: File) => {
    setActionLoading("upload");
    try {
      const result = await api.uploadCandidates(jobId, file);
      toast.success(`Uploaded ${result.count} candidates. Resume processing started.`);
      refresh();
    } catch (err) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setActionLoading(null);
    }
  };

  const runAction = async (action: string, fn: () => Promise<unknown>, loadingKey?: string) => {
    setActionLoading(loadingKey ?? action);
    try {
      await fn();
      toast.success(`${action} started!`);
      setTimeout(refresh, 3000);
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = async () => {
    try {
      await api.deleteJob(jobId);
      toast.success("Job deleted");
      router.push("/jobs");
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleDeleteCandidate = async (id: string, name: string) => {
    try {
      await api.deleteCandidate(id);
      toast.success(`Deleted ${name}`);
      refresh();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handleRetryResume = async (id: string) => {
    try {
      await api.retryResume(id);
      toast.success("Resume retry started");
      setTimeout(refresh, 2000);
    } catch (err) {
      toast.error("Retry failed");
    }
  };

  const handleRetryEvaluation = async (id: string) => {
    try {
      await api.retryEvaluation(id);
      toast.success("Evaluation retry started");
      setTimeout(refresh, 3000);
    } catch (err) {
      toast.error("Retry failed");
    }
  };

  if (loading) return <PageSkeleton rows={4} />;
  if (!job) return <p className="text-destructive">Job not found.</p>;

  const rankedCandidates = [...candidates].sort((a, b) => {
    const ra = a.scores?.rank ?? 999;
    const rb = b.scores?.rank ?? 999;
    return ra - rb;
  });

  const aiInterviewCandidates = shortlistedIds.length > 0
    ? rankedCandidates.filter((c) => shortlistedIds.includes(c.id))
    : rankedCandidates;

  const liveInterviewCandidates = liveShortlistedIds.length > 0
    ? rankedCandidates.filter((c) => liveShortlistedIds.includes(c.id))
    : aiInterviewCandidates.length > 0
      ? aiInterviewCandidates
      : rankedCandidates;

  const assessmentAssignedCount = assessmentResults.length;
  const assessmentGradedCount = assessmentResults.filter((r) => r.status === "graded" || r.result).length;

  const handleShortlistAssessment = async (assignmentId: string) => {
    setReviewLoading(true);
    try {
      await api.shortlistAssessment({ job_id: jobId, outcomes: { [assignmentId]: "shortlisted" }, send_email: true });
      toast.success("Candidate advanced to AI interview round");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleRejectAssessment = async (assignmentId: string) => {
    setReviewLoading(true);
    try {
      await api.shortlistAssessment({ job_id: jobId, outcomes: { [assignmentId]: "not_shortlisted" }, send_email: false });
      toast.success("Candidate marked as not advanced");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleBulkShortlistAssessments = async (topN: number) => {
    const pending = assessmentResults
      .filter((r) => r.result?.outcome === "pending")
      .sort((a, b) => (b.result?.total_score || 0) - (a.result?.total_score || 0))
      .slice(0, topN);
    if (pending.length === 0) return;
    setReviewLoading(true);
    try {
      const outcomes = Object.fromEntries(pending.map((r) => [r.id, "shortlisted"]));
      await api.shortlistAssessment({ job_id: jobId, outcomes, send_email: true });
      toast.success(`Shortlisted top ${pending.length} by assessment score`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleShortlistAi = async (interviewId: string) => {
    setReviewLoading(true);
    try {
      await api.shortlistAiInterview({
        job_id: jobId,
        interview_ids: [interviewId],
        outcomes: { [interviewId]: "shortlisted" },
        send_email: true,
      });
      toast.success("Candidate advanced to live interview pool");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleRejectAi = async (interviewId: string) => {
    setReviewLoading(true);
    try {
      await api.shortlistAiInterview({
        job_id: jobId,
        interview_ids: [interviewId],
        outcomes: { [interviewId]: "not_shortlisted" },
        send_email: false,
      });
      toast.success("Candidate marked as not advanced");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleBulkShortlistAi = async (topN: number) => {
    const pending = aiInterviewResults
      .filter((r) => r.feedback && r.outcome === "pending")
      .sort((a, b) => (b.feedback?.total_score || 0) - (a.feedback?.total_score || 0))
      .slice(0, topN);
    if (pending.length === 0) return;
    setReviewLoading(true);
    try {
      const ids = pending.map((r) => r.id);
      const outcomes = Object.fromEntries(ids.map((id) => [id, "shortlisted"]));
      await api.shortlistAiInterview({ job_id: jobId, interview_ids: ids, outcomes, send_email: true });
      toast.success(`Shortlisted top ${pending.length} by AI interview score`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const applyTestTopN = () => {
    setTestSelectedIds(new Set(rankedCandidates.slice(0, testTopN).map((c) => c.id)));
  };

  const applyInterviewTopN = () => {
    setInterviewSelectedIds(new Set(liveInterviewCandidates.slice(0, interviewTopN).map((c) => c.id)));
  };

  const processingCount = candidates.filter(
    (c) => c.pipeline_stage === "evaluating" || (c.status_message && c.status_message.includes("Processing"))
  ).length;
  const errorCount = candidates.filter((c) => c.pipeline_stage === "error").length;

  const workflowSteps = computeWorkflowSteps(candidates, pipeline, actionLoading, assessmentAssignedCount, assessmentGradedCount);

  return (
    <div className="space-y-6">
      <BackButton href="/jobs" label="Back to Jobs" />
      <PageHeader
        title={job.title}
        description={job.description.slice(0, 200) + "..."}
        badge={
          <Badge variant={job.status === "open" ? "default" : "secondary"} className="capitalize">
            {job.status || "draft"}
          </Badge>
        }
        actions={
          <AlertDialog>
            <AlertDialogTrigger
              className="inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-3"
            >
              <Trash2 className="h-4 w-4" /> Delete Job
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                <AlertDialogDescription>
                This will permanently delete "{job.title}" and all {candidates.length} candidates. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteJob} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        }
      />

      {/* Live status banner */}
      {(processingCount > 0 || errorCount > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {processingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              {processingCount} candidate{processingCount > 1 ? "s" : ""} processing — auto-refreshing...
            </div>
          )}
          {errorCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4" />
              {errorCount} candidate{errorCount > 1 ? "s" : ""} with errors — use retry buttons below
            </div>
          )}
        </div>
      )}

      {/* Pipeline overview */}
      {pipeline && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {Object.entries(STAGE_CONFIG).map(([stage, conf], i) => {
            const count = pipeline.stages[stage] || 0;
            if (count === 0 && stage !== "uploaded") return null;
            return (
              <div key={stage} className="flex items-center gap-2">
                {i > 0 && count > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${conf.color}`}>
                  {conf.label}: {count}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="candidates">
            Candidates ({candidates.length})
            {processingCount > 0 && <Loader2 className="ml-1.5 h-3 w-3 animate-spin" />}
          </TabsTrigger>
          <TabsTrigger value="intake">Intake</TabsTrigger>
          {job.apply_enabled && <TabsTrigger value="apply-form">Apply Form</TabsTrigger>}
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
              <CardContent>
                <Badge className="capitalize">{job.status || "draft"}</Badge>
                {job.location && <p className="text-xs text-muted-foreground mt-2">{job.location} · {job.job_type}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Candidates</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{candidates.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sources</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>Upload: {candidates.filter((c) => c.source !== "form").length}</p>
                <p>Form: {candidates.filter((c) => c.source === "form").length}</p>
              </CardContent>
            </Card>
          </div>
          {job.apply_enabled && job.apply_slug && (
            <Card>
              <CardHeader><CardTitle className="text-base">Share Application Link</CardTitle></CardHeader>
              <CardContent>
                <CopyLinkButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/apply/${job.apply_slug}`} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="intake" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bulk Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone onFile={handleUploadFile} disabled={actionLoading === "upload"} />
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>Download CSV template</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {job.apply_enabled && (
          <TabsContent value="apply-form">
            <Card>
              <CardHeader><CardTitle className="text-base">Public Apply Form</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Candidates must sign in before submitting. Standard fields: college, branch, CGPA, GitHub, projects, resume.</p>
                {job.apply_slug && (
                  <CopyLinkButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/apply/${job.apply_slug}`} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Candidates Tab */}
        <TabsContent value="candidates">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead>CGPA</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c) => {
                    const stageConf = STAGE_CONFIG[c.pipeline_stage] || { label: c.pipeline_stage, color: "bg-gray-100 text-gray-700", icon: Info };
                    const StageIcon = stageConf.icon;
                    const isError = c.pipeline_stage === "error";
                    const isProcessing = c.pipeline_stage === "evaluating" || (c.status_message && c.status_message.includes("Processing"));
                    return (
                      <TableRow key={c.id} className={isError ? "bg-red-50/50" : isProcessing ? "bg-yellow-50/30" : ""}>
                        <TableCell className="font-mono text-xs">{c.s_no}</TableCell>
                        <TableCell>
                          <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{c.college || "—"}</TableCell>
                        <TableCell>{c.cgpa?.toFixed(2) || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${stageConf.color}`}>
                            <StageIcon className="h-3 w-3" />
                            {stageConf.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{c.source || "upload"}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          {c.status_message ? (
                            <span className={`text-xs ${isError ? "text-red-600" : "text-muted-foreground"} truncate block`} title={c.status_message}>
                              {c.status_message}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.scores?.composite_score != null ? (
                            <span className="font-mono font-bold">{(c.scores.composite_score * 100).toFixed(1)}%</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {isError && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => handleRetryResume(c.id)} title="Retry resume processing">
                                  <RotateCcw className="h-3 w-3" /> Resume
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => handleRetryEvaluation(c.id)} title="Retry evaluation">
                                  <RotateCcw className="h-3 w-3" /> Eval
                                </Button>
                              </>
                            )}
                            {!isError && !isProcessing && (c.pipeline_stage === "resume_processed" || c.pipeline_stage === "evaluated") && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => handleRetryEvaluation(c.id)} title="Re-run evaluation">
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                            <Link href={`/candidates/${c.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View</Button>
                            </Link>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteCandidate(c.id, c.name)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <WorkflowStepCard
              title={<><Upload className="h-4 w-4" /> 1. Upload Candidates</>}
              description="Upload a CSV/Excel file with candidate data."
              step={workflowSteps.upload}
            >
              <WorkflowFileUpload
                step={workflowSteps.upload}
                loading={actionLoading === "upload"}
                label="Choose File"
                loadingLabel="Uploading..."
                skipCompletedGuard
                onFile={handleUploadFile}
              />
            </WorkflowStepCard>

            <WorkflowStepCard
              title={<><FileText className="h-4 w-4" /> 2. Process Resumes</>}
              description="Download and extract text from candidate resumes."
              step={workflowSteps.process_resumes}
            >
              <WorkflowRunButton
                step={workflowSteps.process_resumes}
                variant="outline"
                className="w-full"
                loading={actionLoading === "resumes"}
                disabled={candidates.length === 0}
                label="Process Resumes"
                rerunLabel="Reprocess all resumes"
                rerunDescription="All resumes are already processed. Re-running will re-download and re-parse every candidate resume."
                onRun={() => runAction("Resume processing", () => api.processResumes(jobId), "resumes")}
              />
            </WorkflowStepCard>

            <WorkflowStepCard
              title={<><Brain className="h-4 w-4" /> 3. AI Evaluation</>}
              description="Run LLM evaluation + GitHub analysis + semantic scoring."
              step={workflowSteps.ai_evaluation}
            >
              <WorkflowRunButton
                step={workflowSteps.ai_evaluation}
                className="w-full"
                loading={actionLoading === "evaluate"}
                disabled={candidates.length === 0}
                label="Run AI Evaluation"
                loadingLabel="Starting..."
                rerunLabel="Re-run AI evaluation"
                rerunDescription="All candidates are already evaluated. Re-running will re-evaluate every candidate and overwrite existing scores."
                onRun={() => runAction("AI evaluation", () => api.runEvaluations(jobId), "evaluate")}
              />
            </WorkflowStepCard>

            <WorkflowStepCard
              title={<><Trophy className="h-4 w-4" /> 4. Rank Candidates</>}
              description="Compute composite scores and rank candidates."
              step={workflowSteps.rank}
            >
              <WorkflowRunButton
                step={workflowSteps.rank}
                variant="outline"
                className="w-full"
                loading={actionLoading === "rank"}
                disabled={candidates.length === 0}
                label="Compute Rankings"
                rerunLabel="Recompute rankings"
                rerunDescription="Rankings are already computed. Re-running will recalculate composite scores for all candidates."
                onRun={() => runAction("Ranking", () => api.rankCandidates(jobId), "rank")}
              />
            </WorkflowStepCard>

            <WorkflowStepCard
              title={<><Send className="h-4 w-4" /> 5. Platform Assessment</>}
              description="Create on-platform test (MCQ, DSA, SQL) and assign to ranked candidates."
              step={workflowSteps.platform_assessment}
            >
              <LinkButton href={`/jobs/${jobId}/assessment`} variant="outline" size="sm" className="w-full">
                Create / Edit Assessment
              </LinkButton>
              <CandidatePicker
                candidates={rankedCandidates}
                selectedIds={assessmentSelectedIds}
                onToggle={toggleAssessmentCandidate}
                topN={assessmentTopN}
                onSetTopN={setAssessmentTopN}
                onApplyTopN={() => setAssessmentSelectedIds(new Set(rankedCandidates.slice(0, assessmentTopN).map((c) => c.id)))}
                open={assessmentPickerOpen}
                onToggleOpen={() => setAssessmentPickerOpen(!assessmentPickerOpen)}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={assessmentSendEmail} onCheckedChange={(v) => setAssessmentSendEmail(!!v)} />
                Send email invite to candidates
              </label>
              <WorkflowRunButton
                step={workflowSteps.platform_assessment}
                variant="outline"
                className="w-full"
                loading={actionLoading === "Assigning assessment"}
                disabled={assessmentSelectedIds.size === 0}
                skipCompletedGuard
                label={`Assign to ${assessmentSelectedIds.size} Candidate${assessmentSelectedIds.size !== 1 ? "s" : ""}`}
                onRun={() =>
                  runAction("Assigning assessment", () =>
                    api.assignAssessment({
                      job_id: jobId,
                      candidate_ids: [...assessmentSelectedIds],
                      send_email: assessmentSendEmail,
                    })
                  )
                }
              />
            </WorkflowStepCard>

            <RoundReviewPanel
              assessmentResults={assessmentResults}
              aiInterviewResults={aiInterviewResults}
              loading={reviewLoading}
              onShortlistAssessment={handleShortlistAssessment}
              onRejectAssessment={handleRejectAssessment}
              onShortlistAi={handleShortlistAi}
              onRejectAi={handleRejectAi}
              onBulkShortlistAssessments={handleBulkShortlistAssessments}
              onBulkShortlistAi={handleBulkShortlistAi}
            />

            <WorkflowStepCard
              title={<><Brain className="h-4 w-4" /> 6. Assign Automated AI Interview</>}
              description="Voice AI interview for candidates shortlisted from platform assessment."
              step={workflowSteps.ai_interview}
            >
              <CandidatePicker
                candidates={aiInterviewCandidates}
                selectedIds={mockSelectedIds}
                onToggle={toggleMockCandidate}
                topN={mockTopN}
                onSetTopN={setMockTopN}
                onApplyTopN={() => {
                  const top = aiInterviewCandidates.slice(0, mockTopN);
                  setMockSelectedIds(new Set(top.map((c) => c.id)));
                }}
                open={mockPickerOpen}
                onToggleOpen={() => setMockPickerOpen(!mockPickerOpen)}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={mockSendEmail} onCheckedChange={(v) => setMockSendEmail(!!v)} />
                Send email invite to candidate portal
              </label>
              <WorkflowRunButton
                step={workflowSteps.ai_interview}
                variant="outline"
                className="w-full"
                loading={actionLoading === "Assigning AI interviews"}
                disabled={mockSelectedIds.size === 0}
                skipCompletedGuard
                label={`Assign to ${mockSelectedIds.size} Candidate${mockSelectedIds.size !== 1 ? "s" : ""}`}
                onRun={() =>
                  runAction("Assigning AI interviews", () =>
                    api.assignMockInterview({
                      job_id: jobId,
                      candidate_ids: [...mockSelectedIds],
                      interview_type: "Mixed",
                      question_count: 5,
                      send_email: mockSendEmail,
                    })
                  )
                }
              />
            </WorkflowStepCard>

            <WorkflowStepCard
              title={<><Send className="h-4 w-4" /> 5b. Send External Test Links (Legacy)</>}
              description="Optional fallback: email external assessment links."
              step={workflowSteps.test_emails}
            >
              <div>
                <Label className="text-xs">Test Link URL</Label>
                <Input placeholder="https://..." value={testLink} onChange={(e) => setTestLink(e.target.value)} />
              </div>
              <CandidatePicker
                candidates={rankedCandidates}
                selectedIds={testSelectedIds}
                onToggle={toggleTestCandidate}
                topN={testTopN}
                onSetTopN={setTestTopN}
                onApplyTopN={applyTestTopN}
                open={testPickerOpen}
                onToggleOpen={() => setTestPickerOpen(!testPickerOpen)}
              />
              <WorkflowRunButton
                step={workflowSteps.test_emails}
                variant="outline"
                className="w-full"
                loading={actionLoading === "Sending test emails"}
                disabled={!testLink || testSelectedIds.size === 0}
                skipCompletedGuard
                label={`Send to ${testSelectedIds.size} Candidate${testSelectedIds.size !== 1 ? "s" : ""}`}
                onRun={() =>
                  runAction("Sending test emails", () =>
                    api.sendTestEmails({
                      job_id: jobId,
                      candidate_ids: [...testSelectedIds],
                      test_link: testLink,
                    })
                  )
                }
              />
            </WorkflowStepCard>

            <WorkflowStepCard
              title={<><FileText className="h-4 w-4" /> 6b. Upload Legacy Test Results</>}
              description="Optional fallback: upload CSV/Excel with test_la and test_code scores."
              step={workflowSteps.test_results}
            >
              <WorkflowFileUpload
                step={workflowSteps.test_results}
                loading={actionLoading === "test-upload"}
                label="Upload Test Results"
                loadingLabel="Uploading..."
                skipCompletedGuard
                onFile={async (file) => {
                  setActionLoading("test-upload");
                  try {
                    const result = await api.uploadTestResults(jobId, file);
                    toast.success(`Updated test results for ${result.count} candidates.`);
                    setTimeout(refresh, 3000);
                  } catch {
                    toast.error("Upload failed");
                  } finally {
                    setActionLoading(null);
                  }
                }}
              />
            </WorkflowStepCard>

            <WorkflowStepCard
              title={<><Calendar className="h-4 w-4" /> 7. Schedule Live Interviews</>}
              description="Book live interviews with AI-interview shortlisted candidates."
              step={workflowSteps.schedule_interviews}
              className="md:col-span-2 lg:col-span-1"
            >
              <div>
                <Label className="text-xs">Interviewer Email</Label>
                <Input placeholder="interviewer@company.com" value={interviewerEmail} onChange={(e) => setInterviewerEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <CandidatePicker
                candidates={liveInterviewCandidates}
                selectedIds={interviewSelectedIds}
                onToggle={toggleInterviewCandidate}
                topN={interviewTopN}
                onSetTopN={setInterviewTopN}
                onApplyTopN={applyInterviewTopN}
                open={interviewPickerOpen}
                onToggleOpen={() => setInterviewPickerOpen(!interviewPickerOpen)}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={sendInterviewEmail} onCheckedChange={(v) => setSendInterviewEmail(!!v)} />
                Send interview invitation emails after scheduling
              </label>
              <WorkflowRunButton
                step={workflowSteps.schedule_interviews}
                className="w-full"
                loading={actionLoading === "Scheduling interviews"}
                disabled={!interviewerEmail || !startDate || interviewSelectedIds.size === 0}
                skipCompletedGuard
                label={`Schedule ${interviewSelectedIds.size} Interview${interviewSelectedIds.size !== 1 ? "s" : ""}`}
                onRun={async () => {
                  setActionLoading("Scheduling interviews");
                  try {
                    await api.scheduleInterviews({
                      job_id: jobId,
                      candidate_ids: [...interviewSelectedIds],
                      interviewer_email: interviewerEmail,
                      start_date: startDate,
                    });
                    if (sendInterviewEmail) {
                      await api.sendInterviewEmails(jobId, [...interviewSelectedIds]);
                    }
                    toast.success("Interviews scheduled!");
                    setTimeout(refresh, 3000);
                  } catch (err) {
                    toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                  } finally {
                    setActionLoading(null);
                  }
                }}
              />
            </WorkflowStepCard>
          </div>
        </TabsContent>

        {/* Rankings Tab */}
        <TabsContent value="rankings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Candidate Rankings</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Composite scores include platform assessment results. Recompute after assessments are graded, then use Round Review to advance candidates.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading === "rank"}
                onClick={() => runAction("Ranking", () => api.rankCandidates(jobId), "rank")}
              >
                {actionLoading === "rank" ? "Recomputing..." : "Recompute Rankings"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Assessment</TableHead>
                    <TableHead>AI Interview</TableHead>
                    <TableHead>Round Status</TableHead>
                    <TableHead>JD Match</TableHead>
                    <TableHead>GitHub</TableHead>
                    <TableHead>Code Test</TableHead>
                    <TableHead>Logic Test</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>CGPA</TableHead>
                    <TableHead className="font-bold">Composite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedCandidates.map((c) => {
                    const bd = c.scores?.score_breakdown;
                    const assess = assessmentResults
                      .filter((r) => r.candidate_id === c.id && r.result)
                      .sort((a, b) => (b.result?.total_score || 0) - (a.result?.total_score || 0))[0];
                    const aiIv = aiInterviewResults
                      .filter((r) => r.candidate_id === c.id && r.feedback)
                      .sort((a, b) => (b.feedback?.total_score || 0) - (a.feedback?.total_score || 0))[0];
                    const roundLabel = liveShortlistedIds.includes(c.id)
                      ? "Live pool"
                      : shortlistedIds.includes(c.id)
                        ? "AI pool"
                        : assess?.result?.outcome === "not_shortlisted" || aiIv?.outcome === "not_shortlisted"
                          ? "Not advanced"
                          : "—";
                    return (
                      <TableRow key={c.id} className={c.scores?.rank === 1 ? "bg-amber-50" : liveShortlistedIds.includes(c.id) ? "bg-green-50/50" : ""}>
                        <TableCell>
                          <span className="font-bold text-lg">
                            {c.scores?.rank != null ? `#${c.scores.rank}` : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {assess?.result ? `${Math.round(assess.result.total_score)}/100` : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {aiIv?.feedback ? `${aiIv.feedback.total_score}/100` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{roundLabel}</Badge>
                        </TableCell>
                        <ScoreCell entry={bd?.jd_match} label="JD Match" />
                        <ScoreCell entry={bd?.github} label="GitHub" />
                        <ScoreCell entry={bd?.test_code} label="Code Test" />
                        <ScoreCell entry={bd?.test_la} label="Logic Test" />
                        <ScoreCell entry={bd?.project_relevance} label="Project" />
                        <ScoreCell entry={bd?.cgpa} label="CGPA" />
                        <TableCell>
                          {c.scores?.composite_score != null ? (
                            <Tooltip>
                              <TooltipTrigger className="cursor-help">
                                <Badge variant="default" className="font-mono">
                                  {(c.scores.composite_score * 100).toFixed(1)}%
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-left">
                                <p className="font-semibold mb-1">Composite Score</p>
                                <p className="text-[11px] opacity-80">Weighted sum of all scores below</p>
                                {bd && (
                                  <div className="mt-1 space-y-0.5 text-[11px] font-mono">
                                    {Object.entries(bd).map(([key, val]) => (
                                      <div key={key} className="flex justify-between gap-3">
                                        <span className="opacity-70">{key.replace(/_/g, " ")}</span>
                                        <span>{((val as any)?.weighted * 100).toFixed(1)}%</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </TooltipProvider>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
