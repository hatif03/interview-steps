"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Job } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { PageSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { StaggerList, StaggerItem } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { Briefcase, Plus, Link2 } from "lucide-react";
import { toast } from "sonner";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "draft" | "closed">("all");

  useEffect(() => {
    api.listJobs().then(setJobs).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter((j) => filter === "all" || j.status === filter);

  const copyApplyLink = (slug: string) => {
    const url = `${window.location.origin}/apply/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Apply link copied");
  };

  if (loading) return <PageSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Manage roles and candidate intake"
        actions={
          <LinkButton href="/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            Create job
          </LinkButton>
        }
      />

      <div className="flex gap-2">
        {(["all", "open", "draft", "closed"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="capitalize" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="No jobs found" description="Create a job to start screening candidates." actionLabel="Create job" href="/jobs/new" />
      ) : (
        <StaggerList className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <StaggerItem key={job.id}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-1">{job.title}</CardTitle>
                    <Badge variant={job.status === "open" ? "default" : "secondary"} className="shrink-0 capitalize">
                      {job.status || "draft"}
                    </Badge>
                  </div>
                  {job.location && <p className="text-xs text-muted-foreground">{job.location}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{job.candidate_count || 0} candidates</span>
                    {job.apply_enabled && job.apply_slug && (
                      <Button variant="ghost" size="sm" onClick={() => copyApplyLink(job.apply_slug!)}>
                        <Link2 className="h-3.5 w-3.5 mr-1" />Copy link
                      </Button>
                    )}
                  </div>
                  <LinkButton variant="outline" className="w-full" href={`/jobs/${job.id}`}>Manage job</LinkButton>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
