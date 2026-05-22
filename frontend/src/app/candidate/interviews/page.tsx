"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, MockInterview, ScheduledInterview } from "@/lib/api";
import { InterviewCard } from "@/components/InterviewCard";
import { PageSkeleton } from "@/components/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { PageHeader } from "@/components/page-header";
import { Calendar, Video, ExternalLink } from "lucide-react";
import { StaggerList } from "@/components/motion";

export default function InterviewsPage() {
  const { user } = useAuth();
  const [mockInterviews, setMockInterviews] = useState<MockInterview[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getUserMockInterviews(user.id, user.email || undefined).then((r) => setMockInterviews(r.interviews)),
      api.getMyInterviews().then((r) => setScheduled(r.interviews)),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PageSkeleton rows={3} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Interviews" description="Mock interviews and scheduled live sessions" />

      <Tabs defaultValue="mock">
        <TabsList>
          <TabsTrigger value="mock"><Video className="h-4 w-4 mr-2" />Mock ({mockInterviews.length})</TabsTrigger>
          <TabsTrigger value="live"><Calendar className="h-4 w-4 mr-2" />Live ({scheduled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mock" className="mt-4">
          {mockInterviews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No mock interviews assigned yet.</p>
          ) : (
            <StaggerList className="grid gap-4 sm:grid-cols-2">
              {mockInterviews.map((iv) => (
                <InterviewCard key={iv.id} interview={iv} />
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
