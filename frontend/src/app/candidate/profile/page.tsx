"use client";

import { useEffect, useState } from "react";
import { api, CandidateProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/loading";
import { toast } from "sonner";
import { PageTransition } from "@/components/motion";

export default function ProfilePage() {
  const { profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skillsInput, setSkillsInput] = useState("");

  useEffect(() => {
    api.getCandidateProfile().then(setProfile).catch(console.error).finally(() => setLoading(false));
  }, []);

  const update = (key: keyof CandidateProfile, value: string | number | string[]) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
  };

  const addSkill = () => {
    const skill = skillsInput.trim();
    if (!skill || !profile) return;
    if (!profile.skills?.includes(skill)) {
      update("skills", [...(profile.skills || []), skill]);
    }
    setSkillsInput("");
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api.updateCandidateProfile(profile);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton rows={5} />;

  return (
    <PageTransition className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your profile pre-fills job applications</p>
      </div>

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
              <Input value={profile?.phone || ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={profile?.location || ""} onChange={(e) => update("location", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Education</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>College</Label>
            <Input value={profile?.college || ""} onChange={(e) => update("college", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Branch</Label>
              <Input value={profile?.branch || ""} onChange={(e) => update("branch", e.target.value)} />
            </div>
            <div>
              <Label>CGPA</Label>
              <Input type="number" step="0.01" value={profile?.cgpa ?? ""} onChange={(e) => update("cgpa", parseFloat(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Professional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>GitHub URL</Label>
            <Input value={profile?.github_url || ""} onChange={(e) => update("github_url", e.target.value)} />
          </div>
          <div>
            <Label>LinkedIn URL</Label>
            <Input value={profile?.linkedin_url || ""} onChange={(e) => update("linkedin_url", e.target.value)} />
          </div>
          <div>
            <Label>Best AI Project</Label>
            <Textarea value={profile?.best_ai_project || ""} onChange={(e) => update("best_ai_project", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Research Work</Label>
            <Textarea value={profile?.research_work || ""} onChange={(e) => update("research_work", e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Resume URL</Label>
            <Input value={profile?.resume_url || ""} onChange={(e) => update("resume_url", e.target.value)} />
          </div>
          <div>
            <Label>Skills</Label>
            <div className="flex gap-2">
              <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
              <Button type="button" variant="secondary" onClick={addSkill}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(profile?.skills || []).map((s) => (
                <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
    </PageTransition>
  );
}
