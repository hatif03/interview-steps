"use client";

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { StaggerItem } from "@/components/motion";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  href,
}: EmptyStateProps) {
  return (
    <StaggerItem>
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed bg-muted/30">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 ring-8 ring-primary/5">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{description}</p>
        {actionLabel && href && <LinkButton href={href}>{actionLabel}</LinkButton>}
        {actionLabel && onAction && !href && (
          <Button onClick={onAction}>{actionLabel}</Button>
        )}
      </div>
    </StaggerItem>
  );
}
