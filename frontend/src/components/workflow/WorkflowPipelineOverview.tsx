"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PipelineStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "completed";
  detail?: string;
};

export function WorkflowPipelineOverview({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4 overflow-x-auto">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Hiring pipeline</p>
      <div className="flex items-start min-w-max gap-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-start">
            <div className="flex flex-col items-center w-28 sm:w-36 px-1">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2",
                  step.status === "completed" && "border-green-600 bg-green-600/10 text-green-700",
                  step.status === "active" && "border-primary bg-primary/10 text-primary",
                  step.status === "pending" && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {step.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : step.status === "active" ? (
                  <Loader2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <p className={cn("text-[11px] font-medium text-center mt-2 leading-tight", step.status === "active" && "text-primary")}>
                {step.label}
              </p>
              {step.detail && (
                <p className="text-[10px] text-muted-foreground text-center mt-0.5 leading-tight">{step.detail}</p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-6 sm:w-10 mt-[18px] shrink-0",
                  step.status === "completed" ? "bg-green-600/50" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
