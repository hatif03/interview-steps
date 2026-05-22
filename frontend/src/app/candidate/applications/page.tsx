"use client";

import { useEffect, useState } from "react";
import { api, Application, STAGE_LABELS } from "@/lib/api";
import { PageSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { StaggerList, StaggerItem } from "@/components/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { FileText } from "lucide-react";

const STAGE_PROGRESS: Record<string, number> = {
  uploaded: 10, resume_processed: 20, evaluating: 35, evaluated: 50, ranked: 60,
  test_sent: 65, test_completed: 75, shortlisted: 85, mock_interview_assigned: 88,
  mock_interview_completed: 92, interview_scheduled: 100, error: 0,
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyApplications().then((r) => setApplications(r.applications)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" description="Track your job applications and pipeline progress" />

      {applications.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="Apply via a job link shared by a recruiter to see your applications here."
        />
      ) : (
        <StaggerList className="space-y-4">
          {applications.map((app) => (
            <StaggerItem key={app.candidate_id}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{app.job_title}</CardTitle>
                      {app.company_name && <p className="text-sm text-muted-foreground">{app.company_name}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">{app.source}</Badge>
                      {app.rank && <Badge>Rank #{app.rank}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{STAGE_LABELS[app.pipeline_stage] || app.pipeline_stage}</span>
                      <span className="text-muted-foreground">{STAGE_PROGRESS[app.pipeline_stage] || 0}%</span>
                    </div>
                    <Progress value={STAGE_PROGRESS[app.pipeline_stage] || 0} />
                  </div>
                  {app.status_message && (
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{app.status_message}</p>
                  )}
                  {app.composite_score != null && (
                    <p className="text-sm">Composite score: <span className="font-semibold">{(app.composite_score * 100).toFixed(1)}%</span></p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Applied {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
