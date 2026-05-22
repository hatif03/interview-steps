"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepWizard } from "@/components/onboarding/step-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

const STEPS = [
  { id: "about", title: "About You", description: "Basic contact information" },
  { id: "education", title: "Education", description: "Your academic background" },
  { id: "work", title: "Work & Links", description: "Professional profiles and projects" },
  { id: "resume", title: "Resume", description: "Link to your resume" },
  { id: "done", title: "Ready", description: "Start applying to roles" },
];

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [skillsInput, setSkillsInput] = useState("");
  const [form, setForm] = useState({
    phone: "",
    location: "",
    college: "",
    branch: "",
    graduation_year: "",
    cgpa: "",
    github_url: "",
    linkedin_url: "",
    best_ai_project: "",
    research_work: "",
    resume_url: "",
    skills: [] as string[],
  });

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const addSkill = () => {
    const skill = skillsInput.trim();
    if (skill && !form.skills.includes(skill)) {
      setForm((f) => ({ ...f, skills: [...f.skills, skill] }));
      setSkillsInput("");
    }
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return !!form.college && !!form.branch;
    if (step === 2) return !!form.github_url;
    if (step === 3) return !!form.resume_url;
    return true;
  };

  const finish = async () => {
    setLoading(true);
    try {
      await api.updateCandidateProfile({
        phone: form.phone || undefined,
        location: form.location || undefined,
        college: form.college,
        branch: form.branch,
        graduation_year: form.graduation_year ? parseInt(form.graduation_year) : undefined,
        cgpa: form.cgpa ? parseFloat(form.cgpa) : undefined,
        github_url: form.github_url,
        linkedin_url: form.linkedin_url || undefined,
        skills: form.skills,
        best_ai_project: form.best_ai_project || undefined,
        research_work: form.research_work || undefined,
        resume_url: form.resume_url,
        onboarding_completed: true,
      });
      toast.success("Profile complete!");
      router.push("/candidate");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Complete your profile</h1>
        <p className="text-sm text-muted-foreground">
          Hi {profile?.name || "there"} — recruiters use this to evaluate your applications.
        </p>
      </div>
      <StepWizard
        steps={STEPS}
        currentStep={step}
        onNext={() => setStep((s) => s + 1)}
        onBack={() => setStep((s) => s - 1)}
        onFinish={finish}
        isLastStep={step === STEPS.length - 1}
        finishLabel="Go to dashboard"
        canProceed={canProceed()}
        loading={loading}
      >
        {step === 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 555 0100" />
              </div>
              <div>
                <Label htmlFor="location">City / Country</Label>
                <Input id="location" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="San Francisco, US" />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="college">College / University *</Label>
                <Input id="college" value={form.college} onChange={(e) => update("college", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="branch">Branch / Major *</Label>
                <Input id="branch" value={form.branch} onChange={(e) => update("branch", e.target.value)} placeholder="Computer Science" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="grad_year">Graduation year</Label>
                  <Input id="grad_year" type="number" value={form.graduation_year} onChange={(e) => update("graduation_year", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cgpa">CGPA</Label>
                  <Input id="cgpa" type="number" step="0.01" value={form.cgpa} onChange={(e) => update("cgpa", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="github">GitHub URL *</Label>
                <Input id="github" value={form.github_url} onChange={(e) => update("github_url", e.target.value)} placeholder="https://github.com/you" />
              </div>
              <div>
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <Input id="linkedin" value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="project">Best AI Project</Label>
                <Textarea id="project" value={form.best_ai_project} onChange={(e) => update("best_ai_project", e.target.value)} rows={3} />
              </div>
              <div>
                <Label htmlFor="research">Research Work</Label>
                <Textarea id="research" value={form.research_work} onChange={(e) => update("research_work", e.target.value)} rows={3} />
              </div>
              <div>
                <Label>Skills</Label>
                <div className="flex gap-2">
                  <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Python, PyTorch..." onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
                  <Button type="button" variant="secondary" onClick={addSkill}>Add</Button>
                </div>
                {form.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.skills.map((s) => (
                      <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="resume">Resume URL (Google Drive link) *</Label>
                <Input id="resume" value={form.resume_url} onChange={(e) => update("resume_url", e.target.value)} placeholder="https://drive.google.com/..." />
                <p className="text-xs text-muted-foreground mt-1">Share a publicly accessible Google Drive link to your resume PDF.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">You're ready to apply!</h3>
              <p className="text-muted-foreground text-sm">Use job application links from recruiters to submit applications.</p>
            </CardContent>
          </Card>
        )}
      </StepWizard>
    </div>
  );
}
