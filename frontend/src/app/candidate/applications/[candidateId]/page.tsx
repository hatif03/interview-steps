"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type ApplicationRoundsResponse } from "@/lib/api";
import { PageSkeleton } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { AssessmentTimeline } from "@/components/assessment/AssessmentTimeline";
import { EliminationBanner } from "@/components/candidate/EliminationBanner";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS } from "@/lib/api";

export default function ApplicationDetailPage() {
  const params = useParams();
  const candidateId = params.candidateId as string;
  const [data, setData] = useState<ApplicationRoundsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getApplicationRounds(candidateId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) return <PageSkeleton rows={4} />;
  if (!data) return <p className="text-destructive">Application not found.</p>;

  return (
    <div className="space-y-6">
      <BackButton href="/candidate/applications" label="Back to Applications" />
      <PageHeader
        title={data.job_title}
        description="Your performance and feedback for each interview round"
        badge={
          <Badge variant={data.is_eliminated ? "secondary" : "outline"}>
            {data.is_eliminated ? "Application closed" : STAGE_LABELS[data.pipeline_stage] || data.pipeline_stage}
          </Badge>
        }
      />
      {data.is_eliminated && (
        <EliminationBanner message={data.elimination_message} candidateId={candidateId} />
      )}
      {data.status_message && !data.is_eliminated && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{data.status_message}</p>
      )}
      <AssessmentTimeline rounds={data.rounds} />
    </div>
  );
}
