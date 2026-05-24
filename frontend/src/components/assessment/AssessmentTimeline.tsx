"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUND_TYPE_LABELS, type HiringRound } from "@/lib/api";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

function outcomeBadge(outcome: string) {
  if (outcome === "shortlisted") {
    return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Shortlisted</Badge>;
  }
  if (outcome === "not_shortlisted") {
    return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Not advanced</Badge>;
  }
  return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending review</Badge>;
}

export function AssessmentTimeline({ rounds }: { rounds: HiringRound[] }) {
  if (rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">No interview rounds yet.</p>;
  }

  return (
    <div className="space-y-4">
      {rounds.map((round) => {
        const label = ROUND_TYPE_LABELS[round.round_type] || round.round_type;
        const review = round.review_summary as Record<string, unknown> | undefined;
        const detail = round.detail as Record<string, unknown> | undefined;
        const assignment = detail?.assignment as Record<string, unknown> | undefined;
        const result = assignment?.result as Record<string, unknown> | undefined;
        const feedback = detail?.feedback as Record<string, unknown> | undefined;

        return (
          <Card key={round.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {label} · Attempt {round.attempt_number}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(round.created_at).toLocaleString()}
                    {round.total_score != null && ` · Score: ${Math.round(round.total_score)}/100`}
                  </p>
                </div>
                {outcomeBadge(round.outcome)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {round.round_type === "platform_test" && result && (
                <>
                  {(result.section_scores as Record<string, number>) && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.section_scores as Record<string, number>).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="capitalize">{k}: {v}%</Badge>
                      ))}
                    </div>
                  )}
                  {(result.review as Record<string, unknown>)?.summary && (
                    <p className="text-muted-foreground">{(result.review as Record<string, string>).summary}</p>
                  )}
                  {assignment?.id && (
                    <Link href={`/candidate/assessments/${assignment.id}/results`} className="text-primary underline text-xs">
                      View full assessment feedback
                    </Link>
                  )}
                </>
              )}
              {round.round_type === "ai_interview" && (
                <>
                  {feedback?.final_assessment && (
                    <p className="text-muted-foreground">{String(feedback.final_assessment)}</p>
                  )}
                  {round.reference_id && (
                    <Link href={`/candidate/interview/${round.reference_id}/feedback`} className="text-primary underline text-xs">
                      View AI interview feedback
                    </Link>
                  )}
                </>
              )}
              {review && (
                <div className="space-y-2 bg-muted/40 rounded-lg p-3">
                  {(review.future_suggestions as string[])?.length > 0 && (
                    <div>
                      <p className="font-medium text-xs mb-1">Suggestions for future success</p>
                      <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
                        {(review.future_suggestions as string[]).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(review.areas_for_improvement as string[])?.length > 0 && (
                    <div>
                      <p className="font-medium text-xs mb-1">Areas to improve</p>
                      <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
                        {(review.areas_for_improvement as string[]).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {round.outcome === "not_shortlisted" && (
                <p className="text-xs text-muted-foreground italic">
                  You were not advanced to the next round. Review your feedback above for improvement tips.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
