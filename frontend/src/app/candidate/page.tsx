"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, MockInterview } from "@/lib/api";
import { InterviewCard } from "@/components/InterviewCard";
import { PageSkeleton } from "@/components/loading";

export default function CandidateDashboardPage() {
  const { user, profile } = useAuth();
  const [interviews, setInterviews] = useState<MockInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .getUserMockInterviews(user.uid, user.email || undefined)
      .then((res) => setInterviews(res.interviews))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PageSkeleton rows={3} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Welcome{profile?.name ? `, ${profile.name}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">
          Your assigned mock interviews appear below. Use Chrome or Edge for voice interviews.
        </p>
      </div>

      {interviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No mock interviews assigned yet. Check back after your recruiter sends an invitation.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {interviews.map((iv) => (
            <InterviewCard key={iv.id} interview={iv} />
          ))}
        </div>
      )}
    </div>
  );
}
