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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">AI-powered candidate screening overview</p>
        </div>
        <StatsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">AI-powered candidate screening overview</p>
        </div>
        <LinkButton href="/jobs/new"><Plus className="h-4 w-4 mr-2" />Create job</LinkButton>
      </div>

      <StaggerList className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Jobs" value={jobs.length} icon={Briefcase} />
        <StatCard title="Open Roles" value={openJobs} icon={Briefcase} description="Accepting applications" />
        <StatCard title="Total Candidates" value={totalCandidates} icon={Users} />
        <StatCard title="Active Pipelines" value={jobs.filter((j) => (j.candidate_count || 0) > 0).length} icon={GitGraph} />
      </StaggerList>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Jobs</CardTitle>
            <LinkButton variant="ghost" size="sm" href="/jobs">View all <ArrowRight className="h-4 w-4 ml-1" /></LinkButton>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No jobs yet"
                description="Create your first job to start screening candidates with AI."
                actionLabel="Create job"
                onAction={() => (window.location.href = "/jobs/new")}
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

        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <LinkButton variant="outline" className="w-full justify-start" href="/jobs/new"><Plus className="h-4 w-4 mr-2" />Create new job</LinkButton>
            <LinkButton variant="outline" className="w-full justify-start" href="/pipeline"><GitGraph className="h-4 w-4 mr-2" />View pipeline</LinkButton>
            <LinkButton variant="outline" className="w-full justify-start" href="/candidates"><Users className="h-4 w-4 mr-2" />All candidates</LinkButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
