"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, MockInterview } from "@/lib/api";
import { VoiceInterviewAgent } from "@/components/VoiceInterviewAgent";
import { PageSkeleton } from "@/components/loading";
import { Badge } from "@/components/ui/badge";
import { EliminationBanner } from "@/components/candidate/EliminationBanner";
import { LinkButton } from "@/components/link-button";

export default function TakeInterviewPage() {
  const params = useParams();
  const interviewId = params.id as string;
  const { user, profile } = useAuth();
  const [interview, setInterview] = useState<MockInterview | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMockInterview(interviewId)
      .then((iv) => {
        setInterview(iv);
        const fb = iv.feedback as MockInterview["feedback"] | undefined;
        if (fb && typeof fb === "object" && "id" in fb) {
          setFeedbackId(fb.id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) return <PageSkeleton rows={3} />;
  if (!interview) return <p className="text-destructive">Interview not found.</p>;

  const blocked = interview.is_eliminated || interview.outcome === "not_shortlisted" || interview.can_take === false;
  const hasFeedback = interview.feedback != null;
  const canTake = interview.can_take !== false && !blocked;

  if (blocked && hasFeedback) {
    return (
      <div className="space-y-4 max-w-lg mx-auto text-center">
        <EliminationBanner
          message="This application is closed. You can still review your AI interview feedback below."
          candidateId={interview.candidate_id}
        />
        <LinkButton href={`/candidate/interview/${interviewId}/feedback`}>View interview feedback</LinkButton>
        <LinkButton href={`/candidate/applications/${interview.candidate_id}`} variant="outline" className="w-full">
          Application timeline
        </LinkButton>
      </div>
    );
  }

  if (blocked && !hasFeedback) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">{interview.role}</h2>
            <Badge variant="secondary">Closed</Badge>
          </div>
        </div>
        <EliminationBanner
          message="This AI interview is no longer available. View your application timeline for feedback and recommendations."
          candidateId={interview.candidate_id}
        />
        <LinkButton href={`/candidate/applications/${interview.candidate_id}`} variant="outline" className="w-full">
          View application timeline
        </LinkButton>
      </div>
    );
  }

  if (hasFeedback) {
    return (
      <div className="space-y-4 max-w-lg mx-auto text-center">
        <p className="text-sm text-muted-foreground">You have already completed this interview.</p>
        <LinkButton href={`/candidate/interview/${interviewId}/feedback`}>View feedback</LinkButton>
      </div>
    );
  }

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
        canTake={canTake}
        blockedMessage="This interview is closed for your application."
      />
    </div>
  );
}
