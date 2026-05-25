"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, MockFeedback, MockInterview } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/loading";
import { EliminationBanner } from "@/components/candidate/EliminationBanner";
import { LinkButton } from "@/components/link-button";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export default function FeedbackPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const interviewId = params.id as string;
  const feedbackIdParam = searchParams.get("feedbackId");
  const [feedback, setFeedback] = useState<MockFeedback | null>(null);
  const [interview, setInterview] = useState<MockInterview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const iv = await api.getMockInterview(interviewId);
        setInterview(iv);
        const embedded = iv.feedback as MockFeedback | null | undefined;
        if (embedded && typeof embedded === "object" && "total_score" in embedded) {
          setFeedback(embedded);
          return;
        }
        const fb = await api.getMockFeedbackOptional(interviewId);
        setFeedback(fb);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [interviewId, feedbackIdParam]);

  if (loading) return <PageSkeleton rows={4} />;

  if (!feedback) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <h2 className="text-lg font-semibold">Feedback not ready yet</h2>
        <p className="text-sm text-muted-foreground">
          {interview?.is_eliminated
            ? "This application is closed. If you completed an interview, feedback may still be processing — check your application timeline."
            : "Complete your AI interview first. Feedback will appear here once the session is graded."}
        </p>
        {interview?.is_eliminated && interview.candidate_id && (
          <EliminationBanner candidateId={interview.candidate_id} />
        )}
        <div className="flex gap-2 flex-wrap">
          {!interview?.is_eliminated && interview?.can_take !== false && (
            <LinkButton href={`/candidate/interview/${interviewId}`}>Go to interview</LinkButton>
          )}
          {interview?.candidate_id && (
            <LinkButton href={`/candidate/applications/${interview.candidate_id}`} variant="outline">
              Application timeline
            </LinkButton>
          )}
          <Link href="/candidate">
            <Button variant="ghost">← Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const radarData = (feedback.category_scores || []).map((c) => ({
    category: c.name.replace(" and ", " & "),
    score: c.score,
    fullMark: 100,
  }));

  const canRetake = interview?.can_take !== false && !interview?.is_eliminated;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Interview Feedback</h2>
          <p className="text-2xl font-bold text-primary mt-1">{feedback.total_score}/100</p>
        </div>
        {canRetake && (
          <Link href={`/candidate/interview/${interviewId}`}>
            <Button variant="outline">Retake Interview</Button>
          </Link>
        )}
      </div>

      {interview?.is_eliminated && interview.candidate_id && (
        <EliminationBanner candidateId={interview.candidate_id} />
      )}

      {radarData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-green-700">Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {feedback.strengths?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-700">Areas for Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {feedback.areas_for_improvement?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{feedback.final_assessment}</p>
        </CardContent>
      </Card>

      {feedback.category_scores?.map((cat) => (
        <div key={cat.name} className="flex items-start gap-3 text-sm">
          <Badge variant="secondary">{cat.score}</Badge>
          <div>
            <p className="font-medium">{cat.name}</p>
            <p className="text-muted-foreground">{cat.comment}</p>
          </div>
        </div>
      ))}

      <Link href="/candidate">
        <Button variant="ghost">← Back to dashboard</Button>
      </Link>
    </div>
  );
}
