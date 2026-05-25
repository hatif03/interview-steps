"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepWizard } from "@/components/onboarding/step-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/file-dropzone";
import { SkillSuggestions, SelectedSkills } from "@/components/skill-suggestions";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { usePortalProfile } from "@/lib/portal-profile-context";
import { mergeExtractedProfile, SUGGESTED_SKILLS } from "@/lib/resume-extract";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { AppContainer } from "@/components/app-container";
import { CheckCircle2, Sparkles } from "lucide-react";

const STEPS = [
  { id: "resume", title: "Resume", description: "Upload or link your resume — we'll pre-fill your profile" },
  { id: "about", title: "About You", description: "Basic contact information" },
  { id: "education", title: "Education", description: "Your academic background" },
  { id: "work", title: "Work & Links", description: "Professional profiles and projects" },
  { id: "done", title: "Ready", description: "Start applying to roles" },
];

type FormState = {
  phone: string;
  location: string;
  college: string;
  branch: string;
  graduation_year: string;
  cgpa: string;
  github_url: string;
  linkedin_url: string;
  best_ai_project: string;
  research_work: string;
  resume_url: string;
  resume_text: string;
  skills: string[];
};

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { setCandidateProfileLocal, refreshCandidateProfile } = usePortalProfile();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resumeStored, setResumeStored] = useState(false);
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  const [skillsInput, setSkillsInput] = useState("");
  const [form, setForm] = useState<FormState>({
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
    resume_text: "",
    skills: [],
  });

  const update = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !form.skills.includes(trimmed)) {
      setForm((f) => ({ ...f, skills: [...f.skills, trimmed] }));
    }
    setSkillsInput("");
  };

  const removeSkill = (skill: string) => {
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));
  };

  const toggleSkill = (skill: string) => {
    if (form.skills.includes(skill)) removeSkill(skill);
    else addSkill(skill);
  };

  const allSkillSuggestions = [...new Set([...SUGGESTED_SKILLS, ...skillSuggestions])];

  const hasResume = () => !!(form.resume_url.trim() || form.resume_text.trim());

  const canProceed = () => {
    if (step === 0) return hasResume();
    if (step === 1) return true;
    if (step === 2) return !!form.college.trim() && !!form.branch.trim();
    if (step === 3) return !!form.github_url.trim();
    return true;
  };

  const toPayload = (includeOnboarding = false) => {
    const payload: Record<string, unknown> = {};
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.location.trim()) payload.location = form.location.trim();
    if (form.college.trim()) payload.college = form.college.trim();
    if (form.branch.trim()) payload.branch = form.branch.trim();
    if (form.graduation_year) payload.graduation_year = parseInt(form.graduation_year);
    if (form.cgpa) payload.cgpa = parseFloat(form.cgpa);
    if (form.github_url.trim()) payload.github_url = form.github_url.trim();
    if (form.linkedin_url.trim()) payload.linkedin_url = form.linkedin_url.trim();
    if (form.skills.length) payload.skills = form.skills;
    if (form.best_ai_project.trim()) payload.best_ai_project = form.best_ai_project.trim();
    if (form.research_work.trim()) payload.research_work = form.research_work.trim();
    if (form.resume_url.trim()) payload.resume_url = form.resume_url.trim();
    if (form.resume_text.trim()) payload.resume_text = form.resume_text.trim();
    if (includeOnboarding) payload.onboarding_completed = true;
    return payload;
  };

  const saveDraft = async () => {
    try {
      const saved = await api.updateCandidateProfile(toPayload());
      setCandidateProfileLocal(saved);
    } catch {
      toast.error("Failed to save progress");
      throw new Error("draft save failed");
    }
  };

  const applyResumeResult = (result: Awaited<ReturnType<typeof api.uploadResume>>) => {
    setForm((prev) =>
      mergeExtractedProfile(
        {
          ...prev,
          resume_url: result.resume_url || prev.resume_url,
          resume_text: result.resume_text || prev.resume_text,
        },
        result.extracted,
        result.resume_text
      )
    );
    if (result.extracted.skills?.length) {
      setSkillSuggestions((prev) => [...new Set([...prev, ...result.extracted.skills!])]);
    }
    setResumeStored(true);
  };

  const uploadResumeFile = async (file: File) => {
    setUploading(true);
    setResumeStored(false);
    try {
      const result = await api.uploadResume(file);
      applyResumeResult(result);
      toast.success("Resume saved — click suggested skills to add them");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const extractFromUrl = async (url: string) => {
    const result = await api.extractResumeFromUrl(url);
    applyResumeResult(result);
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      if (step === 0) {
        if (!hasResume()) {
          toast.error("Upload a PDF or paste a resume link");
          return;
        }
        try {
          if (!form.resume_text && form.resume_url.trim() && !form.resume_url.includes("/storage/v1/object/public/resumes/")) {
            await extractFromUrl(form.resume_url.trim());
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to read resume link");
          return;
        }
        await saveDraft();
      } else {
        await saveDraft();
      }
      setStep((s) => s + 1);
    } catch {
      // toast already shown
    } finally {
      setLoading(false);
    }
  };

  const finish = async () => {
    setLoading(true);
    try {
      const saved = await api.updateCandidateProfile(toPayload(true));
      setCandidateProfileLocal(saved);
      await refreshCandidateProfile();
      toast.success("Profile complete!");
      router.push("/candidate");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || uploading;

  return (
    <AppContainer size="narrow">
      <PageHeader
        title="Complete your profile"
        description={`Hi ${profile?.name || "there"} — start with your resume and we'll help fill in the rest.`}
        className="mb-6"
      />
      <StepWizard
        steps={STEPS}
        currentStep={step}
        onNext={handleNext}
        onBack={() => setStep((s) => s - 1)}
        onFinish={finish}
        isLastStep={step === STEPS.length - 1}
        finishLabel="Go to dashboard"
        nextLabel="Continue"
        canProceed={canProceed()}
        loading={busy}
      >
        {step === 0 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <FileDropzone
                accept=".pdf,application/pdf"
                label="Drop your resume PDF here"
                hint="PDF is stored securely for recruiters to review during shortlisting"
                disabled={busy}
                onFile={(file) => void uploadResumeFile(file)}
                onClear={() => {
                  setResumeStored(false);
                  setForm((prev) => ({ ...prev, resume_url: "", resume_text: "" }));
                }}
              />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or paste a link</span>
                </div>
              </div>
              <div>
                <Label htmlFor="resume">Google Drive or PDF link</Label>
                <Input
                  id="resume"
                  value={form.resume_url}
                  onChange={(e) => {
                    update("resume_url", e.target.value);
                    setResumeStored(false);
                  }}
                  placeholder="https://drive.google.com/..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Drive links are fetched when you continue. Uploads are stored in Supabase immediately.
                </p>
              </div>
              {resumeStored && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                  <Sparkles className="size-4 shrink-0" />
                  Resume stored — review pre-filled fields in the next steps.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 1 && (
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

        {step === 2 && (
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

        {step === 3 && (
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
              <div className="space-y-3">
                <Label>Skills</Label>
                <SkillSuggestions
                  suggestions={allSkillSuggestions}
                  selected={form.skills}
                  onToggle={toggleSkill}
                />
                <div className="flex gap-2">
                  <Input
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="Add custom skill..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill(skillsInput))}
                  />
                  <Button type="button" variant="secondary" onClick={() => addSkill(skillsInput)}>
                    Add
                  </Button>
                </div>
                <SelectedSkills skills={form.skills} onRemove={removeSkill} />
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
    </AppContainer>
  );
}
