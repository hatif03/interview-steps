"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MockInterview } from "@/lib/api";
import { Calendar, Trophy } from "lucide-react";

export function InterviewCard({ interview }: { interview: MockInterview }) {
  const score = interview.feedback?.totalScore;
  const href = score != null
    ? `/candidate/interview/${interview.id}/feedback`
    : `/candidate/interview/${interview.id}`;

  return (
    <Link href={href}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{interview.role}</CardTitle>
            <Badge variant="secondary">{interview.type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{interview.level} · {interview.techstack?.slice(0, 3).join(", ")}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {interview.createdAt ? new Date(interview.createdAt).toLocaleDateString() : "—"}
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
    </Link>
  );
}
