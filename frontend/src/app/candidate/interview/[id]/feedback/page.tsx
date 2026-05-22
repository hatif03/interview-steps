"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, MockFeedback } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/loading";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMockFeedback(interviewId)
      .then(setFeedback)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [interviewId, feedbackIdParam]);

  if (loading) return <PageSkeleton rows={4} />;
  if (!feedback) return <p className="text-destructive">Feedback not found.</p>;

  const radarData = (feedback.category_scores || []).map((c) => ({
    category: c.name.replace(" and ", " & "),
    score: c.score,
    fullMark: 100,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Interview Feedback</h2>
          <p className="text-2xl font-bold text-primary mt-1">{feedback.total_score}/100</p>
        </div>
        <Link href={`/candidate/interview/${interviewId}`}>
          <Button variant="outline">Retake Interview</Button>
        </Link>
      </div>

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
