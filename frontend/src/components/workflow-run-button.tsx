"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import type { WorkflowStepState } from "@/lib/workflow-status";

interface WorkflowRunButtonProps {
  step: WorkflowStepState;
  loading?: boolean;
  disabled?: boolean;
  onRun: () => void;
  label: string;
  loadingLabel?: string;
  rerunLabel?: string;
  rerunDescription?: string;
  className?: string;
  variant?: "default" | "outline";
  /** If true, never block on completed (e.g. upload more candidates) */
  skipCompletedGuard?: boolean;
}

export function WorkflowRunButton({
  step,
  loading,
  disabled,
  onRun,
  label,
  loadingLabel,
  rerunLabel = "Run again",
  rerunDescription = "This step was already completed. Running it again may reprocess all candidates and overwrite existing results.",
  className,
  variant = "default",
  skipCompletedGuard = false,
}: WorkflowRunButtonProps) {
  const [open, setOpen] = useState(false);
  const completedBlocked =
    !skipCompletedGuard && step.status === "completed" && !step.allowRun;

  if (completedBlocked) {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full",
            className,
            loading && "opacity-50 pointer-events-none"
          )}
        >
          {rerunLabel}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rerunLabel}?</AlertDialogTitle>
            <AlertDialogDescription>{rerunDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                onRun();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={disabled || loading || !step.allowRun}
      onClick={onRun}
    >
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
      {loading && loadingLabel ? loadingLabel : label}
    </Button>
  );
}

export function WorkflowFileUpload({
  step,
  loading,
  onFile,
  label,
  loadingLabel,
  accept = ".csv,.xlsx,.xls",
  skipCompletedGuard = false,
}: {
  step: WorkflowStepState;
  loading?: boolean;
  onFile: (file: File) => void;
  label: string;
  loadingLabel?: string;
  accept?: string;
  skipCompletedGuard?: boolean;
}) {
  const blocked = !skipCompletedGuard && step.status === "completed" && !step.allowRun;

  return (
    <label className={blocked ? "pointer-events-none opacity-50 cursor-not-allowed block" : "cursor-pointer block"}>
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={loading || blocked}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingLabel ?? label}
          </>
        ) : (
          label
        )}
      </div>
    </label>
  );
}
