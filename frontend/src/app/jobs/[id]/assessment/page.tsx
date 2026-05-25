// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LinkButton } from "@/components/link-button";
import { api, type JobAssessment, type AssessmentQuestion } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { PageSkeleton } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2 } from "lucide-react";

export default function AssessmentBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const [assessment, setAssessment] = useState<JobAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [topicHints, setTopicHints] = useState("");
  const [config, setConfig] = useState({ mcq: 5, dsa: 2, sql: 1, passing_score: 60 });

  const load = async () => {
    try {
      const { assessment: a } = await api.getJobAssessment(jobId);
      if (a) {
        setAssessment(a);
        setConfig({ ...config, ...a.config });
      } else {
        const created = await api.createJobAssessment(jobId, {
          title: "Technical Assessment",
          duration_minutes: 60,
          config,
        });
        setAssessment(created.assessment);
      }
    } catch (e) {
      toast.error("Failed to load assessment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [jobId]);

  const saveConfig = async () => {
    if (!assessment) return;
    const updated = await api.updateAssessment(assessment.id, { config, duration_minutes: assessment.duration_minutes, title: assessment.title });
    setAssessment(updated.assessment);
    toast.success("Config saved");
  };

  const handleGenerate = async () => {
    if (!assessment) return;
    setGenerating(true);
    try {
      await saveConfig();
      const result = await api.generateAssessmentQuestions(assessment.id, topicHints || undefined);
      setAssessment(result.assessment);
      toast.success("Questions generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!assessment) return;
    if (!(assessment.questions?.length)) {
      toast.error("Add or generate questions first");
      return;
    }
    const updated = await api.updateAssessment(assessment.id, { status: "published" });
    setAssessment(updated.assessment);
    toast.success("Assessment published");
  };

  const addManualQuestion = async (type: "mcq" | "dsa" | "sql") => {
    if (!assessment) return;
    const base = {
      type,
      prompt: "New question — edit me",
      options: type === "mcq" ? ["Option A", "Option B", "Option C", "Option D"] : [],
      correct_answer: type === "mcq" ? { index: 0 } : type === "dsa" ? { test_cases: [{ input: "", expected_output: "" }] } : { expected_rows: [] },
      starter_code: type === "sql" ? "SELECT * FROM employees;" : "def solution():\n    pass",
      metadata: type === "sql" ? { schema: { tables: [] } } : { language: "python" },
    };
    const { question } = await api.addAssessmentQuestion(assessment.id, base);
    setAssessment({ ...assessment, questions: [...(assessment.questions || []), question] });
  };

  const updateQuestionLocal = async (q: AssessmentQuestion, patch: Partial<AssessmentQuestion>) => {
    const updated = await api.updateAssessmentQuestion(q.id, patch);
    setAssessment({
      ...assessment!,
      questions: (assessment!.questions || []).map((x) => (x.id === q.id ? updated.question : x)),
    });
  };

  const deleteQuestion = async (qid: string) => {
    await api.deleteAssessmentQuestion(qid);
    setAssessment({
      ...assessment!,
      questions: (assessment!.questions || []).filter((x) => x.id !== qid),
    });
  };

  if (loading) return <PageSkeleton rows={5} />;
  if (!assessment) return <p>Failed to load assessment</p>;

  return (
    <div className="space-y-6">
      <BackButton href={`/jobs/${jobId}`} label="Back to Job Workflow" />
      <PageHeader
        title="Platform Assessment Builder"
        description="Configure MCQ, DSA, and SQL questions for on-platform testing"
        badge={<Badge variant={assessment.status === "published" ? "default" : "secondary"}>{assessment.status}</Badge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePublish}>Publish</Button>
            <LinkButton href={`/jobs/${jobId}`}>Done</LinkButton>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Question counts</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-4 gap-4">
          {(["mcq", "dsa", "sql"] as const).map((k) => (
            <div key={k}>
              <Label className="text-xs uppercase">{k}</Label>
              <Input type="number" min={0} value={config[k]} onChange={(e) => setConfig({ ...config, [k]: Number(e.target.value) })} />
            </div>
          ))}
          <div>
            <Label className="text-xs">Passing score</Label>
            <Input type="number" min={0} max={100} value={config.passing_score} onChange={(e) => setConfig({ ...config, passing_score: Number(e.target.value) })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={saveConfig} variant="outline">Save config</Button>
        <Button onClick={handleGenerate} disabled={generating}>
          <Sparkles className="h-4 w-4 mr-2" />{generating ? "Generating..." : "Generate with AI"}
        </Button>
        <Input placeholder="Topic hints (optional)" value={topicHints} onChange={(e) => setTopicHints(e.target.value)} className="max-w-xs" />
        <Button variant="outline" size="sm" onClick={() => addManualQuestion("mcq")}><Plus className="h-3 w-3 mr-1" />MCQ</Button>
        <Button variant="outline" size="sm" onClick={() => addManualQuestion("dsa")}><Plus className="h-3 w-3 mr-1" />DSA</Button>
        <Button variant="outline" size="sm" onClick={() => addManualQuestion("sql")}><Plus className="h-3 w-3 mr-1" />SQL</Button>
      </div>

      <div className="space-y-4">
        {(assessment.questions || []).map((q, i) => (
          <Card key={q.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Q{i + 1} <Badge variant="outline" className="capitalize">{q.type}</Badge>
                <Badge variant="secondary" className="text-[10px]">{q.source}</Badge>
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={q.prompt}
                onChange={(e) => updateQuestionLocal(q, { prompt: e.target.value })}
                rows={3}
              />
              {q.type === "mcq" && (
                <div className="space-y-1">
                  {(q.options || []).map((opt, oi) => (
                    <Input
                      key={oi}
                      value={opt}
                      onChange={(e) => {
                        const opts = [...(q.options || [])];
                        opts[oi] = e.target.value;
                        updateQuestionLocal(q, { options: opts });
                      }}
                    />
                  ))}
                  <Label className="text-xs">Correct option index (0-based)</Label>
                  <Input
                    type="number"
                    value={(q.correct_answer as { index?: number })?.index ?? 0}
                    onChange={(e) => updateQuestionLocal(q, { correct_answer: { index: Number(e.target.value) } })}
                    className="w-24"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {(assessment.questions || []).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No questions yet. Generate with AI or add manually.</p>
        )}
      </div>
    </div>
  );
}
