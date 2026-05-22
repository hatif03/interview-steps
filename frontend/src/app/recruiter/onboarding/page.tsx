"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepWizard } from "@/components/onboarding/step-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { api, SCORING_PRESETS } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppContainer } from "@/components/app-container";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import Link from "next/link";

const STEPS = [
  { id: "company", title: "Company", description: "Tell us about your organization" },
  { id: "role", title: "Your Role", description: "How you fit into hiring" },
  { id: "preferences", title: "Preferences", description: "Customize your experience" },
  { id: "done", title: "All Set", description: "You're ready to start hiring" },
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Education", "Consulting", "Other"];
const HIRING_VOLUMES = ["1-5 roles/year", "6-20 roles/year", "20+ roles/year"];

export default function RecruiterOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    website: "",
    industry: "",
    company_size: "",
    job_title: "",
    hiring_volume: "",
    email_notifications: true,
    default_scoring_preset: "balanced",
  });

  const update = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canProceed = () => {
    if (step === 0) return !!form.company_name;
    if (step === 1) return !!form.job_title;
    return true;
  };

  const finish = async () => {
    setLoading(true);
    try {
      await api.updateRecruiterProfile({
        ...form,
        onboarding_completed: true,
      });
      toast.success("Welcome to AI Screener!");
      router.push("/jobs/new");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContainer size="narrow">
      <PageHeader
        title="Welcome to AI Screener"
        description="Let's set up your recruiter workspace in a few quick steps."
        className="mb-6"
      />
      <StepWizard
        steps={STEPS}
        currentStep={step}
        onNext={() => setStep((s) => s + 1)}
        onBack={() => setStep((s) => s - 1)}
        onFinish={finish}
        isLastStep={step === STEPS.length - 1}
        finishLabel="Create first job"
        canProceed={canProceed()}
        loading={loading}
      >
        {step === 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="company_name">Company name *</Label>
                <Input id="company_name" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Acme Corp" />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://acme.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Industry</Label>
                  <Select value={form.industry} onValueChange={(v) => update("industry", v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Company size</Label>
                  <Select value={form.company_size} onValueChange={(v) => update("company_size", v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="job_title">Your job title *</Label>
                <Input id="job_title" value={form.job_title} onChange={(e) => update("job_title", e.target.value)} placeholder="Head of Talent" />
              </div>
              <div>
                <Label>Hiring volume</Label>
                <Select value={form.hiring_volume} onValueChange={(v) => update("hiring_volume", v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {HIRING_VOLUMES.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notifications"
                  checked={form.email_notifications}
                  onCheckedChange={(c) => update("email_notifications", !!c)}
                />
                <Label htmlFor="notifications">Send email notifications for pipeline updates</Label>
              </div>
              <div>
                <Label>Default scoring preset for new jobs</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {(["technical", "balanced", "academic"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => update("default_scoring_preset", preset)}
                      className={`p-3 rounded-lg border text-left text-sm capitalize transition-colors ${
                        form.default_scoring_preset === preset
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="font-medium">{preset}</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {preset === "technical" && "Emphasizes code & GitHub"}
                        {preset === "balanced" && "Even mix of all signals"}
                        {preset === "academic" && "Emphasizes CGPA & research"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">You're all set!</h3>
              <p className="text-muted-foreground text-sm mb-6">
                {form.company_name} is ready to start screening candidates with AI.
              </p>
              <LinkButton href="/" variant="outline">Go to dashboard instead</LinkButton>
            </CardContent>
          </Card>
        )}
      </StepWizard>
    </AppContainer>
  );
}
