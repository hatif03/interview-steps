"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, MapPin, Briefcase, CheckCircle2 } from "lucide-react";
import { api, PublicJob, ApplyFormPayload, CandidateProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/loading";
import { toast } from "sonner";
import { AppContainer } from "@/components/app-container";
import { scaleIn } from "@/lib/motion";

type View = "preview" | "form" | "success";

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, profile, getIdToken } = useAuth();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<View>("preview");
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [form, setForm] = useState<ApplyFormPayload>({});

  useEffect(() => {
    api.getPublicJob(slug).then(setJob).catch(() => toast.error("Job not found")).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!user || profile?.role !== "candidate") return;
    getIdToken().then(async (token) => {
      if (!token) return;
      try {
        const cp = await api.getCandidateProfile(token);
        setCandidateProfile(cp);
        if (!cp.onboarding_completed) {
          router.push(`/candidate/onboarding?redirect=/apply/${slug}`);
          return;
        }
        setForm({
          college: cp.college,
          branch: cp.branch,
          cgpa: cp.cgpa,
          best_ai_project: cp.best_ai_project,
          research_work: cp.research_work,
          github_url: cp.github_url,
          resume_url: cp.resume_url,
        });
      } catch {
        router.push("/candidate/onboarding");
      }
    });
  }, [user, profile, slug, router, getIdToken]);

  const handleApplyClick = () => {
    if (!user) {
      router.push(`/candidate/sign-in?redirect=/apply/${slug}`);
      return;
    }
    if (profile?.role === "recruiter") {
      toast.error("Sign in with a candidate account to apply");
      return;
    }
    setView("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.applyToJob(slug, form);
      setView("success");
      toast.success("Application submitted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Application failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto p-8"><PageSkeleton rows={4} /></div>;
  if (!job) return <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground">Job not found</div>;

  if (view === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-background via-muted/30 to-background">
        <motion.div initial={scaleIn.initial} animate={scaleIn.animate} className="max-w-md w-full">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="pt-12 pb-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Application submitted!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your application for {job.title} has been received. Track progress in your dashboard.
              </p>
              <LinkButton href="/candidate/applications">View applications</LinkButton>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (view === "form" && user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background py-12 px-4">
        <AppContainer size="candidate">
          <Card className="rounded-2xl shadow-sm max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Apply to {job.title}</CardTitle>
              <p className="text-sm text-muted-foreground">Review and submit your application details</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>College</Label>
                    <Input value={form.college || ""} onChange={(e) => setForm({ ...form, college: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <Input value={form.branch || ""} onChange={(e) => setForm({ ...form, branch: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label>CGPA</Label>
                  <Input type="number" step="0.01" value={form.cgpa ?? ""} onChange={(e) => setForm({ ...form, cgpa: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <Label>GitHub URL</Label>
                  <Input value={form.github_url || ""} onChange={(e) => setForm({ ...form, github_url: e.target.value })} required />
                </div>
                <div>
                  <Label>Best AI Project</Label>
                  <Textarea value={form.best_ai_project || ""} onChange={(e) => setForm({ ...form, best_ai_project: e.target.value })} rows={3} />
                </div>
                <div>
                  <Label>Research Work</Label>
                  <Textarea value={form.research_work || ""} onChange={(e) => setForm({ ...form, research_work: e.target.value })} rows={2} />
                </div>
                <div>
                  <Label>Resume URL</Label>
                  <Input value={form.resume_url || ""} onChange={(e) => setForm({ ...form, resume_url: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit application"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </AppContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background py-12 px-4">
      <AppContainer size="candidate">
        <Card className="rounded-2xl shadow-sm max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{job.company_name || "Company"}</p>
                <CardTitle className="text-2xl">{job.title}</CardTitle>
              </div>
              <Briefcase className="h-8 w-8 text-primary shrink-0" />
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
              {job.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
              )}
              {job.job_type && (
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.job_type}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">About this role</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </div>
            <div className="border-t pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Sign in with a candidate account to submit your application.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleApplyClick} className="flex-1">
                  {user ? "Continue application" : "Sign in to apply"}
                </Button>
                {!user && (
                  <LinkButton variant="outline" className="flex-1" href={`/candidate/sign-up?redirect=/apply/${slug}`}>
                    Create account
                  </LinkButton>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </AppContainer>
    </div>
  );
}
