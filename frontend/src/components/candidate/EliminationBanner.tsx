"use client";

import { AlertCircle } from "lucide-react";
import { LinkButton } from "@/components/link-button";

export function EliminationBanner({
  message,
  candidateId,
  className,
}: {
  message?: string | null;
  candidateId?: string;
  className?: string;
}) {
  const text =
    message ||
    "You were not advanced to the next stage. You can review your results and recommendations, but cannot start new assessments or interviews for this application.";

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 space-y-2 ${className || ""}`}>
      <div className="flex gap-2">
        <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Application closed for this role</p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90">{text}</p>
        </div>
      </div>
      {candidateId && (
        <LinkButton href={`/candidate/applications/${candidateId}`} size="sm" variant="outline" className="h-7 text-xs">
          View results & recommendations
        </LinkButton>
      )}
    </div>
  );
}
