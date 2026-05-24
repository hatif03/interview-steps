"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type AssessmentAssignment } from "@/lib/api";
import { PageSkeleton } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";

export default function AssessmentResultsPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;
  const [assignment, setAssignment] = useState<AssessmentAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAssessmentAssignment(assignmentId)
      .then(setAssignment)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assignmentId]);

  if (loading || !assignment) return <PageSkeleton rows={4} />;
  const result = assignment.result;
  const review = result?.review;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <BackButton href="/candidate/assessments" label="Back to Assessments" />
      <PageHeader
        title={`${assignment.job_title} — Results`}
        description={result ? `Score: ${Math.round(result.total_score)}/100` : "Pending grading"}
        badge={
          result?.outcome && result.outcome !== "pending" ? (
            <Badge className="capitalize">{result.outcome.replace("_", " ")}</Badge>
          ) : undefined
        }
      />

      {result?.section_scores && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(result.section_scores).map(([k, v]) => (
            <Badge key={k} variant="outline" className="capitalize">{k}: {v}%</Badge>
          ))}
        </div>
      )}

      {review?.summary && (
        <Card>
          <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{review.summary}</p></CardContent>
        </Card>
      )}

      {review?.strengths && review.strengths.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Strengths</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm space-y-1">{review.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {review?.areas_for_improvement && review.areas_for_improvement.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Areas to Improve</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm space-y-1">{review.areas_for_improvement.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {review?.future_suggestions && review.future_suggestions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Suggestions for Future Success</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm space-y-1">{review.future_suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      {(assignment.answers || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Question Feedback</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(assignment.answers || []).map((raw, i) => {
              const a = raw as { is_correct?: boolean; score?: number; ai_feedback?: string };
              return (
              <div key={i} className="text-sm border-b pb-2 last:border-0">
                <p className="font-medium">Q{i + 1}: {a.is_correct ? "✓" : "✗"} — {a.score != null ? `${a.score}%` : ""}</p>
                {a.ai_feedback ? <p className="text-muted-foreground text-xs mt-1">{a.ai_feedback}</p> : null}
              </div>
            );})}
          </CardContent>
        </Card>
      )}

      {result?.outcome === "not_shortlisted" && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          You were not advanced to the next round for this position. Use the feedback above to prepare for future opportunities.
        </p>
      )}

      <LinkButton href={`/candidate/applications/${assignment.candidate_id}`} variant="outline">
        View full application timeline
      </LinkButton>
    </div>
  );
}
