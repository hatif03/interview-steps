"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type AssessmentAssignment, type AssessmentQuestion } from "@/lib/api";
import { PageSkeleton } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeEditor } from "@/components/assessment/CodeEditor";
import { EliminationBanner } from "@/components/candidate/EliminationBanner";
import { LinkButton } from "@/components/link-button";
import { gradeSqlAnswer } from "@/lib/sql-runner";
import { toast } from "sonner";

export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;
  const [assignment, setAssignment] = useState<AssessmentAssignment | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [sqlResults, setSqlResults] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    api.getAssessmentAssignment(assignmentId)
      .then(async (a) => {
        if (a.status === "graded" || a.result?.outcome === "not_shortlisted") {
          router.replace(`/candidate/assessments/${assignmentId}/results`);
          return;
        }
        if (a.is_eliminated === false && a.can_take === false) {
          setBlocked("This assessment is no longer available.");
          setAssignment(a);
          return;
        }
        if (a.is_eliminated) {
          setBlocked("You were not advanced for this role. View your results and recommendations instead.");
          setAssignment(a);
          return;
        }
        if (a.status === "assigned") {
          try {
            const started = await api.startAssessmentAssignment(assignmentId);
            setAssignment(started);
          } catch (e) {
            setBlocked(e instanceof Error ? e.message : "Cannot start assessment");
            setAssignment(a);
          }
        } else {
          setAssignment(a);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assignmentId, router]);

  if (loading || !assignment) return <PageSkeleton rows={4} />;
  if (blocked) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <PageHeader title={assignment.job_title || "Technical Assessment"} description="This assessment is closed" />
        <EliminationBanner message={blocked} candidateId={assignment.candidate_id} />
        {assignment.status === "graded" && (
          <LinkButton href={`/candidate/assessments/${assignmentId}/results`} className="w-full">
            View results & feedback
          </LinkButton>
        )}
        <LinkButton href={`/candidate/applications/${assignment.candidate_id}`} variant="outline" className="w-full">
          View application timeline
        </LinkButton>
      </div>
    );
  }
  const questions = assignment.questions || [];
  const q = questions[currentIndex] as AssessmentQuestion | undefined;
  if (!q) return <p>No questions in this assessment.</p>;

  const setAnswer = (questionId: string, response: Record<string, unknown>) => {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    try {
      const payload = questions.map((question) => ({
        question_id: question.id,
        response: answers[question.id] || {},
      }));
      await api.submitAssessment(assignmentId, { answers: payload, sql_results: sqlResults });
      toast.success("Assessment submitted!");
      router.push(`/candidate/assessments/${assignmentId}/results`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const runSql = async () => {
    const sql = String(answers[q.id]?.code || "");
    const result = await gradeSqlAnswer(sql, q);
    setSqlResults((prev) => ({ ...prev, [q.id]: result }));
    if (result.error) toast.error(result.error);
    else if (result.passed) toast.success("Query matches expected output!");
    else toast.warning("Query ran but output differs from expected.");
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title={assignment.job_title || "Technical Assessment"}
        description={`Question ${currentIndex + 1} of ${questions.length}`}
        badge={<Badge className="capitalize">{q.type}</Badge>}
      />

      <div className="flex gap-1 flex-wrap">
        {questions.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentIndex(i)}
            className={`h-8 w-8 rounded text-xs font-medium border ${
              i === currentIndex ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{q.prompt}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.type === "mcq" && (
            <div className="space-y-2">
              {(q.options || []).map((opt, i) => (
                <label key={i} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-accent/50">
                  <input
                    type="radio"
                    name={`mcq-${q.id}`}
                    checked={answers[q.id]?.selected_index === i}
                    onChange={() => setAnswer(q.id, { selected_index: i })}
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {(q.type === "dsa" || q.type === "sql") && (
            <>
              {q.type === "sql" && q.metadata?.schema && (
                <div className="text-xs bg-muted/50 rounded p-3 font-mono overflow-auto max-h-32">
                  <p className="font-semibold mb-1">Schema</p>
                  <pre>{JSON.stringify(q.metadata.schema, null, 2)}</pre>
                </div>
              )}
              <CodeEditor
                value={String(answers[q.id]?.code ?? q.starter_code ?? "")}
                onChange={(code) => setAnswer(q.id, { code })}
                language={q.type === "sql" ? "sql" : "python"}
              />
              {q.type === "sql" && (
                <Button type="button" variant="outline" size="sm" onClick={runSql}>
                  Run query (preview)
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
          Previous
        </Button>
        {currentIndex < questions.length - 1 ? (
          <Button onClick={() => setCurrentIndex((i) => i + 1)}>Next</Button>
        ) : (
          <Button onClick={handleSubmitAll} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Assessment"}
          </Button>
        )}
      </div>
    </div>
  );
}
