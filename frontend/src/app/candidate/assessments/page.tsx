"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, type AssessmentAssignment } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { FileText, Trophy } from "lucide-react";

export default function CandidateAssessmentsPage() {
  const [assignments, setAssignments] = useState<AssessmentAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.getMyAssessments()
      .then((r) => setAssignments(r.assignments))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton rows={3} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Assessments" description="Platform technical assessments assigned to you" />
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No assessments assigned yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assignments.map((a) => {
            const done = a.status === "graded";
            const rejected = a.is_eliminated || a.result?.outcome === "not_shortlisted";
            const canTake = a.can_take !== false && !rejected && !done;
            const href = done || rejected
              ? `/candidate/assessments/${a.id}/results`
              : `/candidate/assessments/${a.id}`;
            return (
              <Card key={a.id} className={rejected ? "opacity-90 border-muted" : "hover:border-primary/50 transition-colors"}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between gap-2">
                    <CardTitle className="text-base">{a.job_title || a.assessment?.title || "Assessment"}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {rejected ? "closed" : a.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Attempt {a.attempt_number} · {new Date(a.assigned_at).toLocaleDateString()}
                  </p>
                  {a.result && (
                    <p className="text-sm flex items-center gap-1 text-primary font-medium">
                      <Trophy className="h-3.5 w-3.5" />
                      {Math.round(a.result.total_score)}/100
                      {a.result.outcome !== "pending" && (
                        <Badge variant="secondary" className="ml-2 capitalize">{a.result.outcome.replace("_", " ")}</Badge>
                      )}
                    </p>
                  )}
                  {rejected && (
                    <p className="text-xs text-muted-foreground">Not advanced — view your feedback and recommendations.</p>
                  )}
                  <LinkButton href={href} size="sm" variant={canTake ? "default" : "outline"}>
                    {canTake ? "Take Assessment" : "View Results & Feedback"}
                  </LinkButton>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
