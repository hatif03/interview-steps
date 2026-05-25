"use client";

import { type ReactNode } from "react";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StepStatus, WorkflowStepState } from "@/lib/workflow-status";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<
  StepStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  pending: { label: "Pending", variant: "outline" },
  running: { label: "In progress", variant: "secondary", className: "animate-pulse" },
  completed: { label: "Completed", variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
  partial: { label: "Partial", variant: "secondary" },
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "partial") return <AlertCircle className="h-4 w-4 text-amber-600" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

interface WorkflowStepCardProps {
  title: ReactNode;
  description: string;
  step: WorkflowStepState;
  children: ReactNode;
  className?: string;
}

export function WorkflowStepCard({
  title,
  description,
  step,
  children,
  className,
}: WorkflowStepCardProps) {
  const badge = STATUS_BADGE[step.status];
  const showCompletedStyle = step.status === "completed";

  return (
    <Card
      className={cn(
        "transition-colors",
        showCompletedStyle && "border-emerald-500/30 bg-emerald-500/5",
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <StatusIcon status={step.status} />
            {title}
          </CardTitle>
          <Badge variant={badge.variant} className={cn("shrink-0 text-[10px]", badge.className)}>
            {badge.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{step.summary}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}
