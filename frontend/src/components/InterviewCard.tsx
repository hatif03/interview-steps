"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MockInterview } from "@/lib/api";
import { Calendar, Trophy, Lock } from "lucide-react";

export function InterviewCard({
  interview,
  disabled,
  disabledReason,
}: {
  interview: MockInterview;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const score = interview.feedback?.total_score;
  const hasFeedback = score != null || interview.feedback != null;
  const eliminated = interview.is_eliminated || interview.outcome === "not_shortlisted";
  const canTakeInterview = interview.can_take !== false && !eliminated && !hasFeedback;
  const feedbackHref = hasFeedback ? `/candidate/interview/${interview.id}/feedback` : undefined;
  const takeHref = canTakeInterview ? `/candidate/interview/${interview.id}` : undefined;
  const href = feedbackHref || takeHref;

  const inner = (
    <Card className={`h-full transition-colors ${disabled ? "opacity-75 border-muted cursor-not-allowed" : "hover:border-primary/50 cursor-pointer"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{interview.role}</CardTitle>
          <Badge variant="secondary">{interview.type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{interview.level} · {interview.techstack?.slice(0, 3).join(", ")}</p>
        {disabledReason && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> {disabledReason}
          </p>
        )}
        {!canTakeInterview && !hasFeedback && !disabledReason && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Application closed — view feedback only
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {interview.created_at ? new Date(interview.created_at).toLocaleDateString() : "—"}
          </span>
          {score != null && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <Trophy className="h-3 w-3" />
              {score}/100
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}
