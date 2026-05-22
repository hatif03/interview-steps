"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Job } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { StaggerList } from "@/components/motion";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { StatsSkeleton } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Briefcase, Users, GitGraph, Plus, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listJobs().then(setJobs).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalCandidates = jobs.reduce((s, j) => s + (j.candidate_count || 0), 0);
  const openJobs = jobs.filter((j) => j.status === "open").length;

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" description="AI-powered candidate screening overview" />
        <StatsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="AI-powered candidate screening overview"
        actions={
          <LinkButton href="/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            Create job
          </LinkButton>
        }
      />

      <StaggerList className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Jobs" value={jobs.length} icon={Briefcase} />
        <StatCard title="Open Roles" value={openJobs} icon={Briefcase} description="Accepting applications" />
        <StatCard title="Total Candidates" value={totalCandidates} icon={Users} />
        <StatCard title="Active Pipelines" value={jobs.filter((j) => (j.candidate_count || 0) > 0).length} icon={GitGraph} />
      </StaggerList>

      <Section title="Recent Jobs" actions={<LinkButton variant="ghost" size="sm" href="/jobs">View all <ArrowRight className="h-4 w-4 ml-1" /></LinkButton>}>
        <Card>
          <CardContent className="pt-6">
            {jobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No jobs yet"
                description="Create your first job to start screening candidates with AI."
                actionLabel="Create job"
                href="/jobs/new"
              />
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 5).map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <h3 className="font-semibold">{job.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{job.description.slice(0, 80)}...</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={job.status === "open" ? "default" : "secondary"}>
                        {job.status === "open" ? "Open" : job.status === "closed" ? "Closed" : "Draft"}
                      </Badge>
                      <Badge variant="outline">{job.candidate_count || 0}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <LinkButton variant="outline" className="w-full justify-start" href="/jobs/new"><Plus className="h-4 w-4 mr-2" />Create new job</LinkButton>
          <LinkButton variant="outline" className="w-full justify-start" href="/pipeline"><GitGraph className="h-4 w-4 mr-2" />View pipeline</LinkButton>
          <LinkButton variant="outline" className="w-full justify-start" href="/candidates"><Users className="h-4 w-4 mr-2" />All candidates</LinkButton>
        </CardContent>
      </Card>
    </div>
  );
}
