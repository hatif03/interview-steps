"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, MapPin, Briefcase, CheckCircle2 } from "lucide-react";
import { api, PublicJob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { usePortalProfile } from "@/lib/portal-profile-context";
import {
  applyFormToProfilePayload,
  getApplyFormConfig,
  hasResume,
  mergeApplyFormWithExtracted,
  profileToApplyForm,
  type ApplyFormFieldKey,
  type ApplyFormState,
  APPLY_FIELD_LABELS,
} from "@/lib/apply-form";
import { ResumeSection } from "@/components/apply/resume-section";
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
  const { user, profile } = useAuth();
  const { candidateProfile, portalReady, candidateOnboardingComplete, setCandidateProfileLocal } =
    usePortalProfile();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedHint, setParsedHint] = useState(false);
  const [view, setView] = useState<View>("preview");
  const [form, setForm] = useState<ApplyFormState>({});
  const prefilledRef = useRef(false);

  const fieldConfig = getApplyFormConfig(job?.apply_form_config);

  useEffect(() => {
    api.getPublicJob(slug).then(setJob).catch(() => toast.error("Job not found")).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!user || profile?.role !== "candidate" || !portalReady) return;

    if (candidateOnboardingComplete === false) {
      router.push(`/candidate/onboarding?redirect=/apply/${slug}`);
      return;
    }
  }, [user, profile, slug, router, portalReady, candidateOnboardingComplete]);

  useEffect(() => {
    if (view !== "form" || !portalReady || !candidateProfile || prefilledRef.current) return;
    prefilledRef.current = true;
    setForm(profileToApplyForm(candidateProfile));
  }, [view, portalReady, candidateProfile]);

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

  const applyResumeResult = (result: Awaited<ReturnType<typeof api.uploadResume>>) => {
    setForm((prev) =>
      mergeApplyFormWithExtracted(prev, result.extracted, result.resume_url, result.resume_text)
    );
    if (candidateProfile) {
      setCandidateProfileLocal({
        ...candidateProfile,
        resume_url: result.resume_url || candidateProfile.resume_url,
        resume_text: result.resume_text,
        college: candidateProfile.college || result.extracted.college,
        branch: candidateProfile.branch || result.extracted.branch,
        cgpa: candidateProfile.cgpa ?? result.extracted.cgpa,
        github_url: candidateProfile.github_url || result.extracted.github_url,
        best_ai_project: candidateProfile.best_ai_project || result.extracted.best_ai_project,
        research_work: candidateProfile.research_work || result.extracted.research_work,
      });
    }
    setParsedHint(true);
  };

  const uploadResumeFile = async (file: File) => {
    setUploading(true);
    setParsedHint(false);
    try {
      const result = await api.uploadResume(file);
      applyResumeResult(result);
      toast.success("Resume uploaded — review pre-filled fields below");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const extractFromUrl = async (url: string) => {
    setUploading(true);
    setParsedHint(false);
    try {
      const result = await api.extractResumeFromUrl(url);
      applyResumeResult(result);
      toast.success("Resume processed — review pre-filled fields below");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read resume link");
    } finally {
      setUploading(false);
    }
  };

  const handleResumeClear = () => {
    setForm((prev) => ({ ...prev, resume_url: undefined, resume_text: undefined }));
    setParsedHint(false);
  };

  const validateForm = (): boolean => {
    if (fieldConfig.resume_url.enabled && fieldConfig.resume_url.required && !hasResume(form, candidateProfile)) {
      toast.error("Please upload or link your resume before submitting");
      return false;
    }

    const checks: { key: ApplyFormFieldKey; value: string | number | undefined }[] = [
      { key: "college", value: form.college },
      { key: "branch", value: form.branch },
      { key: "github_url", value: form.github_url },
      { key: "best_ai_project", value: form.best_ai_project },
      { key: "research_work", value: form.research_work },
    ];

    for (const { key, value } of checks) {
      const cfg = fieldConfig[key];
      if (cfg.enabled && cfg.required && !String(value ?? "").trim()) {
        toast.error(`${APPLY_FIELD_LABELS[key]} is required`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const profilePayload = applyFormToProfilePayload(form);
      const updatedProfile = await api.updateCandidateProfile(profilePayload);
      setCandidateProfileLocal(updatedProfile);

      const applyPayload = {
        college: form.college,
        branch: form.branch,
        cgpa: form.cgpa,
        best_ai_project: form.best_ai_project,
        research_work: form.research_work,
        github_url: form.github_url,
        resume_url: form.resume_url || updatedProfile.resume_url,
      };

      await api.applyToJob(slug, applyPayload);
      setView("success");
      toast.success("Application submitted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Application failed");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (key: keyof ApplyFormState, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const busy = submitting || uploading;

  const renderField = (key: ApplyFormFieldKey) => {
    const cfg = fieldConfig[key];
    if (!cfg.enabled || key === "resume_url") return null;

    const required = cfg.required;
    const label = APPLY_FIELD_LABELS[key];

    if (key === "best_ai_project" || key === "research_work") {
      return (
        <div key={key}>
          <Label>{label}</Label>
          <Textarea
            value={(form[key] as string) || ""}
            onChange={(e) => updateField(key, e.target.value)}
            rows={key === "best_ai_project" ? 3 : 2}
            required={required}
          />
        </div>
      );
    }

    if (key === "cgpa") {
      return (
        <div key={key}>
          <Label>{label}</Label>
          <Input
            type="number"
            step="0.01"
            value={form.cgpa ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              updateField("cgpa", val ? parseFloat(val) : undefined);
            }}
            required={required}
          />
        </div>
      );
    }

    return (
      <div key={key}>
        <Label>{label}</Label>
        <Input
          value={(form[key] as string) || ""}
          onChange={(e) => updateField(key, e.target.value)}
          required={required}
        />
      </div>
    );
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
    if (!portalReady || !candidateProfile) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background py-12 px-4">
          <AppContainer size="candidate">
            <div className="max-w-xl mx-auto">
              <PageSkeleton rows={6} />
            </div>
          </AppContainer>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-background py-12 px-4">
        <AppContainer size="candidate">
          <Card className="rounded-2xl shadow-sm max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Apply to {job.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review and submit your application details
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {fieldConfig.resume_url.enabled && (
                  <ResumeSection
                    resumeUrl={form.resume_url || candidateProfile.resume_url}
                    resumeText={form.resume_text || candidateProfile.resume_text}
                    uploading={uploading}
                    parsedHint={parsedHint}
                    onUpload={(file) => void uploadResumeFile(file)}
                    onExtractFromUrl={(url) => void extractFromUrl(url)}
                    onClear={handleResumeClear}
                    onResumeUrlChange={(url) => updateField("resume_url", url)}
                  />
                )}

                <div className="space-y-4 border-t pt-6">
                  {(fieldConfig.college.enabled || fieldConfig.branch.enabled) && (
                    <div className="grid grid-cols-2 gap-4">
                      {fieldConfig.college.enabled && renderField("college")}
                      {fieldConfig.branch.enabled && renderField("branch")}
                    </div>
                  )}
                  {renderField("cgpa")}
                  {renderField("github_url")}
                  {renderField("best_ai_project")}
                  {renderField("research_work")}
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {submitting ? "Submitting..." : uploading ? "Processing resume..." : "Submit application"}
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
