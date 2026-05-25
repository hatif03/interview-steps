"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AssessmentAssignment, RoundStats } from "@/lib/api";
import { TopNInput } from "./TopNInput";
import { RoundOutcomeBadge } from "./RoundOutcomeBadge";
import { Bell, Lock, RefreshCw, ArrowRight, XCircle } from "lucide-react";

function statusLabel(status: string) {
  if (status === "assigned") return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "graded") return "Graded";
  return status;
}

export function AssessmentRoundHub({
  assignments,
  stats,
  roundStatus,
  loading,
  onRemind,
  onCloseRound,
  onRerank,
  onAdvanceTopN,
  onAdvanceSelected,
  onRejectSelected,
}: {
  assignments: AssessmentAssignment[];
  stats: RoundStats;
  roundStatus: string;
  loading?: boolean;
  onRemind: (ids?: string[]) => void;
  onCloseRound: () => void;
  onRerank: () => void;
  onAdvanceTopN: (n: number) => void;
  onAdvanceSelected: (ids: string[]) => void;
  onRejectSelected: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState(3);

  const gradedPending = useMemo(
    () =>
      assignments.filter(
        (a) => a.status === "graded" && (a.result?.outcome === "pending" || !a.result?.outcome)
      ),
    [assignments]
  );

  if (assignments.length === 0) return null;

  const statItems = [
    { label: "Assigned", value: stats.total },
    { label: "Not started", value: stats.not_started },
    { label: "In progress", value: stats.in_progress },
    { label: "Graded", value: stats.graded ?? 0 },
    { label: "Awaiting review", value: stats.awaiting_decision },
    { label: "Advanced", value: stats.shortlisted },
    { label: "Rejected", value: stats.not_shortlisted },
  ];

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const incompleteIds = assignments
    .filter((a) => a.status === "assigned" || a.status === "in_progress")
    .map((a) => a.id);

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Manage round</p>
            <CardTitle className="text-base mt-0.5">Platform Assessment</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Track every candidate, send reminders, close the round, then advance top performers to the AI interview.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {roundStatus === "closed" && (
              <Badge variant="secondary" className="text-[10px]">
                <Lock className="h-3 w-3 mr-1" />Round closed
              </Badge>
            )}
            {stats.awaiting_decision > 0 && (
              <Badge variant="outline">{stats.awaiting_decision} need your decision</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {statItems.map((s) => (
            <Badge key={s.label} variant="outline" className="text-[10px] font-normal">
              {s.label}: <span className="font-semibold ml-1">{s.value}</span>
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Follow-up</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={loading || incompleteIds.length === 0}
              onClick={() => onRemind(selected.size ? [...selected] : undefined)}
            >
              <Bell className="h-3 w-3 mr-1" /> Send reminder
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                className="inline-flex items-center justify-center gap-1 rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-2 disabled:opacity-50"
                disabled={loading || roundStatus === "closed"}
              >
                <Lock className="h-3 w-3" /> Close round
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close assessment round?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Incomplete candidates will be marked not advanced. No further submissions will be accepted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onCloseRound}>Close round</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={onRerank}>
              <RefreshCw className="h-3 w-3 mr-1" /> Recompute rankings
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Move candidates forward</p>
          <div className="flex flex-wrap items-center gap-2">
            <TopNInput
              value={topN}
              onChange={setTopN}
              max={gradedPending.length || 1}
              disabled={loading || gradedPending.length === 0}
              onApply={() => onAdvanceTopN(topN)}
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={loading || gradedPending.length === 0}
              onClick={() => onAdvanceTopN(topN)}
            >
              <ArrowRight className="h-3 w-3 mr-1" /> Advance top N → AI Interview
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              disabled={loading || selected.size === 0}
              onClick={() => onAdvanceSelected([...selected])}
            >
              Advance selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive"
              disabled={loading || selected.size === 0}
              onClick={() => onRejectSelected([...selected])}
            >
              <XCircle className="h-3 w-3 mr-1" /> Reject selected
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Candidate</TableHead>
              <TableHead>Attempt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>MCQ</TableHead>
              <TableHead>DSA</TableHead>
              <TableHead>SQL</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => {
              const last = a.submitted_at || a.started_at || a.assigned_at;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{a.candidate?.name || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{a.candidate?.email}</div>
                  </TableCell>
                  <TableCell className="text-xs">{a.attempt_number}</TableCell>
                  <TableCell className="text-xs">{statusLabel(a.status)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {a.result ? `${Math.round(a.result.total_score)}/100` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.result?.section_scores?.mcq ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.result?.section_scores?.dsa ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.result?.section_scores?.sql ?? "—"}</TableCell>
                  <TableCell><RoundOutcomeBadge outcome={a.result?.outcome} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {last ? new Date(last).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
