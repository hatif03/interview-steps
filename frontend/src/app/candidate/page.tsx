"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, Application, MockInterview, STAGE_LABELS } from "@/lib/api";
import { InterviewCard } from "@/components/InterviewCard";
import { StatCard } from "@/components/stat-card";
import { StaggerList } from "@/components/motion";
import { PageSkeleton } from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { FileText, Video, User } from "lucide-react";

const STAGE_PROGRESS: Record<string, number> = {
  uploaded: 10,
  resume_processed: 20,
  evaluating: 35,
  evaluated: 50,
  ranked: 60,
  test_sent: 65,
  test_completed: 75,
  shortlisted: 85,
  assessment_assigned: 62, assessment_completed: 70,
  ai_interview_assigned: 85, ai_interview_completed: 90,
  mock_interview_assigned: 85,
  mock_interview_completed: 90,
  interview_scheduled: 100,
  error: 0,
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function CandidateDashboardPage() {
  const { user, profile } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<MockInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getMyApplications().then((r) => setApplications(r.applications)),
      api.getUserMockInterviews(user.id, user.email || undefined).then((r) => setInterviews(r.interviews)),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PageSkeleton rows={3} />;

  const pendingInterviews = interviews.filter((i) => !i.feedback);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}${profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}`}
        description="Track your applications and upcoming interviews"
      />

      <StaggerList className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Applications" value={applications.length} icon={FileText} />
        <StatCard title="AI Interviews" value={pendingInterviews.length} icon={Video} description="Pending" />
        <StatCard title="Profile" value="Active" icon={User} description="Complete" />
      </StaggerList>

      {applications.length > 0 && (
        <Section
          title="Application Status"
          actions={
            <Link href="/candidate/applications" className="text-sm text-primary hover:underline">
              View all
            </Link>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {applications.slice(0, 4).map((app) => (
              <Card key={app.candidate_id} className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{app.job_title}</CardTitle>
                    <Badge variant="outline" className="text-xs capitalize">{app.source}</Badge>
                  </div>
                  {app.company_name && <p className="text-xs text-muted-foreground">{app.company_name}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{STAGE_LABELS[app.pipeline_stage] || app.pipeline_stage}</span>
                      <span>{STAGE_PROGRESS[app.pipeline_stage] || 0}%</span>
                    </div>
                    <Progress value={STAGE_PROGRESS[app.pipeline_stage] || 0} className="h-1.5" />
                  </div>
                  {app.status_message && (
                    <p className="text-xs text-muted-foreground">{app.status_message}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title="Automated AI Interviews">
        {interviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No AI interviews assigned yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {interviews.map((iv) => (
              <InterviewCard key={iv.id} interview={iv} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
