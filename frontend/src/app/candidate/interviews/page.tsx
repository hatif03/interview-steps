"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, MockInterview, ScheduledInterview, AssessmentAssignment } from "@/lib/api";
import { InterviewCard } from "@/components/InterviewCard";
import { PageSkeleton } from "@/components/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { PageHeader } from "@/components/page-header";
import { Calendar, Video, ExternalLink, FileText, Trophy } from "lucide-react";
import { StaggerList } from "@/components/motion";

export default function InterviewsPage() {
  const { user } = useAuth();
  const [aiInterviews, setAiInterviews] = useState<MockInterview[]>([]);
  const [assessments, setAssessments] = useState<AssessmentAssignment[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getUserMockInterviews(user.id, user.email || undefined),
      api.getMyAssessments(),
      api.getMyInterviews(),
    ])
      .then(([ai, assess, live]) => {
        setAiInterviews(ai.interviews);
        setAssessments(assess.assignments);
        setScheduled(live.interviews);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PageSkeleton rows={3} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Interviews" description="Platform assessments, automated AI interviews, and live sessions" />

      <Tabs defaultValue="assessments">
        <TabsList>
          <TabsTrigger value="assessments"><FileText className="h-4 w-4 mr-2" />Assessments ({assessments.length})</TabsTrigger>
          <TabsTrigger value="ai"><Video className="h-4 w-4 mr-2" />AI Interviews ({aiInterviews.length})</TabsTrigger>
          <TabsTrigger value="live"><Calendar className="h-4 w-4 mr-2" />Live ({scheduled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assessments" className="mt-4">
          {assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No platform assessments assigned yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {assessments.map((a) => {
                const done = a.status === "graded";
                const rejected = a.is_eliminated || a.result?.outcome === "not_shortlisted";
                const canTake = !rejected && !done && a.can_take !== false;
                const href = done || rejected ? `/candidate/assessments/${a.id}/results` : `/candidate/assessments/${a.id}`;
                return (
                  <Card key={a.id} className={rejected ? "border-muted" : "hover:border-primary/50 transition-colors"}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{a.job_title || "Assessment"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {a.result && (
                        <p className="text-sm flex items-center gap-1 text-primary font-medium">
                          <Trophy className="h-3.5 w-3.5" />{Math.round(a.result.total_score)}/100
                        </p>
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
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          {aiInterviews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No automated AI interviews assigned yet.</p>
          ) : (
            <StaggerList className="grid gap-4 sm:grid-cols-2">
              {aiInterviews.map((iv) => (
                <InterviewCard
                  key={iv.id}
                  interview={iv}
                  disabled={iv.can_take === false && !iv.feedback}
                  disabledReason={
                    iv.is_eliminated || iv.can_take === false
                      ? "Application closed — view feedback only"
                      : undefined
                  }
                />
              ))}
            </StaggerList>
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-4 space-y-4">
          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No scheduled interviews yet.</p>
          ) : (
            scheduled.map((iv) => (
              <Card key={iv.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between">
                    <CardTitle className="text-base">{iv.job_title || "Interview"}</CardTitle>
                    <Badge variant="outline" className="capitalize">{iv.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {new Date(iv.scheduled_at).toLocaleString()} · {iv.duration_minutes} min
                  </div>
                  {iv.google_meet_link && (
                    <LinkButton size="sm" href={iv.google_meet_link} target="_blank" rel="noopener noreferrer">
                      Join <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </LinkButton>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
