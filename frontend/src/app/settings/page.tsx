"use client";

import { useEffect, useState } from "react";
import { api, RecruiterProfile } from "@/lib/api";
import { usePortalProfile } from "@/lib/portal-profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSkeleton } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { PageTransition } from "@/components/motion";

export default function SettingsPage() {
  const { recruiterProfile, portalReady, refreshRecruiterProfile } = usePortalProfile();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recruiterProfile) setProfile(recruiterProfile);
  }, [recruiterProfile]);

  const update = (key: keyof RecruiterProfile, value: string | boolean) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api.updateRecruiterProfile(profile);
      await refreshRecruiterProfile();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!portalReady || !profile) return <PageSkeleton rows={4} />;

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Settings" description="Manage your company profile and preferences" />

      <Card>
        <CardHeader><CardTitle>Company Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company name</Label>
            <Input value={profile?.company_name || ""} onChange={(e) => update("company_name", e.target.value)} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={profile?.website || ""} onChange={(e) => update("website", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Input value={profile?.industry || ""} onChange={(e) => update("industry", e.target.value)} />
            </div>
            <div>
              <Label>Company size</Label>
              <Input value={profile?.company_size || ""} onChange={(e) => update("company_size", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Your job title</Label>
            <Input value={profile?.job_title || ""} onChange={(e) => update("job_title", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={profile?.email_notifications ?? true}
              onCheckedChange={(c) => update("email_notifications", !!c)}
            />
            <Label>Email notifications for pipeline updates</Label>
          </div>
          <div>
            <Label>Default scoring preset</Label>
            <Select value={profile?.default_scoring_preset || "balanced"} onValueChange={(v) => update("default_scoring_preset", v ?? "balanced")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
    </PageTransition>
  );
}
