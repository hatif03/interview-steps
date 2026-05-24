"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AiInterviewResult, AssessmentAssignment } from "@/lib/api";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

function OutcomeBadge({ outcome }: { outcome?: string | null }) {
  if (outcome === "shortlisted") {
    return (
      <Badge className="bg-green-600 text-[10px]">
        <CheckCircle2 className="h-3 w-3 mr-1" />Shortlisted
      </Badge>
    );
  }
  if (outcome === "not_shortlisted") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        <XCircle className="h-3 w-3 mr-1" />Not advanced
      </Badge>
    );
  }
  if (outcome === "pending") {
    return (
      <Badge variant="outline" className="text-[10px]">
        <Clock className="h-3 w-3 mr-1" />Needs review
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">—</Badge>;
}

export function RoundReviewPanel({
  assessmentResults,
  aiInterviewResults,
  onShortlistAssessment,
  onRejectAssessment,
  onShortlistAi,
  onRejectAi,
  onBulkShortlistAssessments,
  onBulkShortlistAi,
  loading,
}: {
  assessmentResults: AssessmentAssignment[];
  aiInterviewResults: AiInterviewResult[];
  onShortlistAssessment: (assignmentId: string) => void;
  onRejectAssessment: (assignmentId: string) => void;
  onShortlistAi: (interviewId: string) => void;
  onRejectAi: (interviewId: string) => void;
  onBulkShortlistAssessments: (topN: number) => void;
  onBulkShortlistAi: (topN: number) => void;
  loading?: boolean;
}) {
  const gradedAssessments = assessmentResults.filter((r) => r.status === "graded" && r.result);
  const pendingAssessments = gradedAssessments.filter((r) => r.result?.outcome === "pending");
  const completedAi = aiInterviewResults.filter((r) => r.feedback);
  const pendingAi = completedAi.filter((r) => r.outcome === "pending");

  if (gradedAssessments.length === 0 && completedAi.length === 0) {
    return null;
  }

  return (
    <Card className="md:col-span-2 lg:col-span-3 border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          Round Review — Move candidates forward
          {(pendingAssessments.length > 0 || pendingAi.length > 0) && (
            <Badge variant="outline">
              {pendingAssessments.length + pendingAi.length} awaiting decision
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          After each round completes, shortlist candidates to advance them. Use the Rankings tab to compare scores before scheduling live interviews.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {gradedAssessments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">Platform Assessments</p>
              {pendingAssessments.length > 1 && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => onBulkShortlistAssessments(3)}>
                    Shortlist top 3
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => onBulkShortlistAssessments(5)}>
                    Shortlist top 5
                  </Button>
                </div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>MCQ</TableHead>
                  <TableHead>DSA</TableHead>
                  <TableHead>SQL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradedAssessments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.candidate?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{Math.round(r.result?.total_score || 0)}/100</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.result?.section_scores?.mcq ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.result?.section_scores?.dsa ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.result?.section_scores?.sql ?? "—"}</TableCell>
                    <TableCell><OutcomeBadge outcome={r.result?.outcome} /></TableCell>
                    <TableCell className="text-right">
                      {r.result?.outcome === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => onShortlistAssessment(r.id)}>
                            → AI Interview
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={loading} onClick={() => onRejectAssessment(r.id)}>
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Decided</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {completedAi.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium">Automated AI Interviews</p>
              {pendingAi.length > 1 && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => onBulkShortlistAi(3)}>
                    Shortlist top 3
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => onBulkShortlistAi(5)}>
                    Shortlist top 5
                  </Button>
                </div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedAi.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.candidate?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{r.feedback?.total_score ?? "—"}/100</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.role}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell><OutcomeBadge outcome={r.outcome} /></TableCell>
                    <TableCell className="text-right">
                      {r.outcome === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => onShortlistAi(r.id)}>
                            → Live Interview
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={loading} onClick={() => onRejectAi(r.id)}>
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Decided</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
