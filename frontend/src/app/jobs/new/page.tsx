"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepWizard } from "@/components/onboarding/step-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { CopyLinkButton } from "@/components/copy-link-button";
import { api, DEFAULT_APPLY_FORM_CONFIG, SCORING_PRESETS } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { AppContainer } from "@/components/app-container";
import { BackButton } from "@/components/back-button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  { id: "basics", title: "Job Details", description: "Title, description, and location" },
  { id: "weights", title: "Scoring Weights", description: "How candidates are ranked" },
  { id: "intake", title: "Candidate Intake", description: "Upload CSV or public apply form" },
  { id: "review", title: "Review & Publish", description: "Confirm and publish your job" },
];

const WEIGHT_LABELS: Record<string, string> = {
  jd_match: "JD Match",
  github: "GitHub Impact",
  test_code: "Coding Test",
  test_la: "Logical Aptitude",
  project_relevance: "AI Project",
  research_relevance: "Research",
  cgpa: "CGPA",
};

export default function NewJobPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    job_type: "Full-time",
    weights: { ...SCORING_PRESETS.balanced },
    enableUpload: true,
    enableApplyForm: false,
  });

  const totalWeight = Object.values(form.weights).reduce((s, w) => s + w, 0);

  const canProceed = () => {
    if (step === 0) return !!form.title && !!form.description;
    if (step === 1) return Math.abs(totalWeight - 1) <= 0.01;
    return true;
  };

  const publish = async (asDraft = false) => {
    setLoading(true);
    try {
      const job = await api.createJob({
        title: form.title,
        description: form.description,
        location: form.location || undefined,
        job_type: form.job_type,
        weight_config: form.weights,
        apply_enabled: form.enableApplyForm,
        apply_form_config: DEFAULT_APPLY_FORM_CONFIG,
        status: asDraft ? "draft" : "open",
      });
      toast.success(asDraft ? "Job saved as draft" : "Job published!");
      setCreatedJobId(job.id);
      if (form.enableApplyForm && job.apply_slug) {
        setCreatedSlug(job.apply_slug);
      } else {
        router.push(`/jobs/${job.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create job";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const applyUrl = createdSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/apply/${createdSlug}`
    : "";

  if (createdJobId && form.enableApplyForm) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Badge className="mb-2">Job published</Badge>
            <h2 className="text-xl font-bold">
              {createdSlug ? "Share your application link" : "Job created"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {createdSlug
                ? "Candidates can apply using this link after signing in."
                : "Your job is ready. Upload candidates or manage it from the job page."}
            </p>
            {createdSlug ? <CopyLinkButton url={applyUrl} /> : null}
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={() => router.push("/jobs")}>All jobs</Button>
              <Button onClick={() => router.push(`/jobs/${createdJobId}`)}>View job</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppContainer size="narrow" className="space-y-6">
      <BackButton href="/jobs" label="Back to Jobs" />
      <PageHeader
        title="Create Job"
        description="Set up a role and choose how candidates enter the pipeline"
      />

      <StepWizard
        steps={STEPS}
        currentStep={step}
        onNext={() => setStep((s) => s + 1)}
        onBack={() => setStep((s) => s - 1)}
        onFinish={() => publish(false)}
        isLastStep={step === STEPS.length - 1}
        finishLabel="Publish job"
        canProceed={canProceed()}
        loading={loading}
      >
        {step === 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="title">Job Title *</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Founding AI Engineer" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Remote" />
                </div>
                <div>
                  <Label htmlFor="type">Job type</Label>
                  <Input id="type" value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Job Description *</Label>
                <Textarea id="description" rows={10} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Paste the full job description..." />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex gap-2 flex-wrap">
                {(["technical", "balanced", "academic"] as const).map((preset) => (
                  <Button key={preset} type="button" variant="outline" size="sm" className="capitalize" onClick={() => setForm({ ...form, weights: { ...SCORING_PRESETS[preset] } })}>
                    {preset}
                  </Button>
                ))}
              </div>
              <p className={`text-sm ${Math.abs(totalWeight - 1) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}>
                Total: {(totalWeight * 100).toFixed(0)}%
              </p>
              {Object.entries(form.weights).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between">
                    <Label>{WEIGHT_LABELS[key] || key}</Label>
                    <span className="text-sm font-mono text-muted-foreground">{(value * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[value * 100]}
                    onValueChange={(val) => setForm({ ...form, weights: { ...form.weights, [key]: (Array.isArray(val) ? val[0] : val) / 100 } })}
                    min={0}
                    max={50}
                    step={5}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-lg border">
                <Checkbox id="upload" checked={form.enableUpload} onCheckedChange={(c) => setForm({ ...form, enableUpload: !!c })} />
                <div>
                  <Label htmlFor="upload" className="font-medium">Bulk CSV/Excel upload</Label>
                  <p className="text-xs text-muted-foreground mt-1">Upload candidate lists from spreadsheets after creating the job.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg border">
                <Checkbox id="apply" checked={form.enableApplyForm} onCheckedChange={(c) => setForm({ ...form, enableApplyForm: !!c })} />
                <div>
                  <Label htmlFor="apply" className="font-medium">Public application form</Label>
                  <p className="text-xs text-muted-foreground mt-1">Generate a shareable link. Candidates must sign in to apply.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="font-medium">{form.title}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{form.location || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Intake</span>
                  <span>{[form.enableUpload && "CSV upload", form.enableApplyForm && "Public form"].filter(Boolean).join(" + ") || "None"}</span>
                </div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => publish(true)} disabled={loading}>
                Save as draft instead
              </Button>
            </CardContent>
          </Card>
        )}
      </StepWizard>
    </AppContainer>
  );
}
