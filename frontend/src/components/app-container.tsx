"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { isCandidatePortalPath } from "@/lib/route-utils";

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "recruiter" | "candidate" | "narrow";
}

export function AppContainer({ children, className, size }: AppContainerProps) {
  const pathname = usePathname();
  const isCandidate = size === "candidate" || isCandidatePortalPath(pathname);
  const maxWidth = size === "narrow" ? "max-w-3xl" : isCandidate ? "max-w-4xl" : "max-w-7xl";

  return (
    <div className={cn("w-full mx-auto", maxWidth, className)}>
      {children}
    </div>
  );
}
