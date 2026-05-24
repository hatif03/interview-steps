"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, MockInterview } from "@/lib/api";
import { VoiceInterviewAgent } from "@/components/VoiceInterviewAgent";
import { PageSkeleton } from "@/components/loading";
import { Badge } from "@/components/ui/badge";

export default function TakeInterviewPage() {
  const params = useParams();
  const interviewId = params.id as string;
  const { user, profile } = useAuth();
  const [interview, setInterview] = useState<MockInterview | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMockInterview(interviewId),
      api.getMockFeedback(interviewId).catch(() => null),
    ])
      .then(([iv, fb]) => {
        setInterview(iv);
        if (fb) setFeedbackId(fb.id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) return <PageSkeleton rows={3} />;
  if (!interview) return <p className="text-destructive">Interview not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">{interview.role}</h2>
          <Badge>{interview.type}</Badge>
          <Badge variant="outline">{interview.level}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {interview.questions?.length || 0} questions · Enable camera & microphone, then click Start and speak clearly when prompted.
        </p>
      </div>

      <VoiceInterviewAgent
        interviewId={interviewId}
        userName={profile?.name || user?.email || "Candidate"}
        userId={user?.id}
        feedbackId={feedbackId}
      />
    </div>
  );
}
