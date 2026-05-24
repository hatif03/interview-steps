"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export function isPendingOutcome(outcome?: string | null): boolean {
  return outcome === "pending" || outcome == null;
}

export function RoundOutcomeBadge({ outcome }: { outcome?: string | null }) {
  if (outcome === "shortlisted") {
    return (
      <Badge className="bg-green-600 text-[10px]">
        <CheckCircle2 className="h-3 w-3 mr-1" />Shortlisted
      </Badge>
    );
  }
  if (outcome === "not_shortlisted") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        <XCircle className="h-3 w-3 mr-1" />Not advanced
      </Badge>
    );
  }
  if (isPendingOutcome(outcome)) {
    return (
      <Badge variant="outline" className="text-[10px]">
        <Clock className="h-3 w-3 mr-1" />Needs review
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">—</Badge>;
}
