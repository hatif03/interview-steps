"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, CandidateProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { usePortalProfile } from "@/lib/portal-profile-context";
import {
  buildCandidateProfilePayload,
  formatOptionalNumber,
  parseOptionalFloat,
} from "@/lib/candidate-profile-form";
import { SUGGESTED_SKILLS } from "@/lib/resume-extract";
import { FileDropzone } from "@/components/file-dropzone";
import { SkillSuggestions, SelectedSkills } from "@/components/skill-suggestions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { PageTransition } from "@/components/motion";

export default function ProfilePage() {
  const { profile: authProfile } = useAuth();
  const { candidateProfile, portalReady, setCandidateProfileLocal } = usePortalProfile();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  const [skillsInput, setSkillsInput] = useState("");
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!candidateProfile) return;
    if (loadedForUser.current === candidateProfile.user_id) return;
    loadedForUser.current = candidateProfile.user_id;
    setProfile(candidateProfile);
  }, [candidateProfile]);

  const update = (key: keyof CandidateProfile, value: string | number | string[] | undefined) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed || !profile) return;
    if (!profile.skills?.includes(trimmed)) {
      update("skills", [...(profile.skills || []), trimmed]);
    }
    setSkillsInput("");
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    update("skills", (profile.skills || []).filter((s) => s !== skill));
  };

  const toggleSkill = (skill: string) => {
    if (profile?.skills?.includes(skill)) removeSkill(skill);
    else addSkill(skill);
  };

  const allSkillSuggestions = [...new Set([...SUGGESTED_SKILLS, ...skillSuggestions])];

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const saved = await api.updateCandidateProfile(buildCandidateProfilePayload(profile));
      setProfile(saved);
      setCandidateProfileLocal(saved);
      toast.success("Profile updated");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const applyResumeResult = (result: Awaited<ReturnType<typeof api.uploadResume>>) => {
    if (!profile) return;
    const next = {
      ...profile,
      resume_url: result.resume_url || profile.resume_url,
      resume_text: result.resume_text,
      phone: profile.phone || result.extracted.phone,
      location: profile.location || result.extracted.location,
      college: profile.college || result.extracted.college,
      branch: profile.branch || result.extracted.branch,
      graduation_year: profile.graduation_year ?? result.extracted.graduation_year,
      cgpa: profile.cgpa ?? result.extracted.cgpa,
      github_url: profile.github_url || result.extracted.github_url,
      linkedin_url: profile.linkedin_url || result.extracted.linkedin_url,
      best_ai_project: profile.best_ai_project || result.extracted.best_ai_project,
      research_work: profile.research_work || result.extracted.research_work,
    };
    setProfile(next);
    setCandidateProfileLocal(next);
    if (result.extracted.skills?.length) {
      setSkillSuggestions((prev) => [...new Set([...prev, ...result.extracted.skills!])]);
    }
  };

  const uploadResumeFile = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    try {
      const result = await api.uploadResume(file);
      applyResumeResult(result);
      toast.success("Resume saved — you can keep editing and save your profile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const extractFromLink = async () => {
    if (!profile?.resume_url?.trim()) {
      toast.error("Add a resume link first");
      return;
    }
    setUploading(true);
    try {
      const result = await api.extractResumeFromUrl(profile.resume_url);
      applyResumeResult(result);
      toast.success("Resume link processed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read resume link");
    } finally {
      setUploading(false);
    }
  };

  if (!portalReady || !profile) return <PageSkeleton rows={5} />;

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Profile" description="Your profile pre-fills job applications" />

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {authProfile?.name}</p>
          <p><span className="text-muted-foreground">Email:</span> {authProfile?.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Personal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={profile.phone || ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={profile.location || ""} onChange={(e) => update("location", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Education</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>College</Label>
            <Input value={profile.college || ""} onChange={(e) => update("college", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Branch</Label>
              <Input value={profile.branch || ""} onChange={(e) => update("branch", e.target.value)} />
            </div>
            <div>
              <Label>CGPA</Label>
              <Input
                type="number"
                step="0.01"
                value={formatOptionalNumber(profile.cgpa)}
                onChange={(e) => update("cgpa", parseOptionalFloat(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Professional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>GitHub URL</Label>
            <Input value={profile.github_url || ""} onChange={(e) => update("github_url", e.target.value)} />
          </div>
          <div>
            <Label>LinkedIn URL</Label>
            <Input value={profile.linkedin_url || ""} onChange={(e) => update("linkedin_url", e.target.value)} />
          </div>
          <div>
            <Label>Best AI Project</Label>
            <Textarea value={profile.best_ai_project || ""} onChange={(e) => update("best_ai_project", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Research Work</Label>
            <Textarea value={profile.research_work || ""} onChange={(e) => update("research_work", e.target.value)} rows={2} />
          </div>
          <div className="space-y-4">
            <FileDropzone
              accept=".pdf,application/pdf"
              label="Upload resume PDF"
              hint="Stored in Supabase for recruiter review"
              disabled={uploading || saving}
              onFile={(file) => void uploadResumeFile(file)}
            />
            <div>
              <Label>Resume URL</Label>
              <Input value={profile.resume_url || ""} onChange={(e) => update("resume_url", e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
            <Button type="button" variant="secondary" onClick={extractFromLink} disabled={uploading}>
              {uploading ? "Processing..." : "Process link"}
            </Button>
          </div>
          <div className="space-y-3">
            <Label>Skills</Label>
            <SkillSuggestions
              suggestions={allSkillSuggestions}
              selected={profile.skills || []}
              onToggle={toggleSkill}
            />
            <div className="flex gap-2">
              <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill(skillsInput))} />
              <Button type="button" variant="secondary" onClick={() => addSkill(skillsInput)}>Add</Button>
            </div>
            <SelectedSkills skills={profile.skills || []} onRemove={removeSkill} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save profile"}
      </Button>
    </PageTransition>
  );
}
