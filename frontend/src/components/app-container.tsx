"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "recruiter" | "candidate" | "narrow";
}

export function AppContainer({ children, className, size }: AppContainerProps) {
  const pathname = usePathname();
  const isCandidate = size === "candidate" || pathname.startsWith("/candidate");
  const maxWidth = size === "narrow" ? "max-w-3xl" : isCandidate ? "max-w-4xl" : "max-w-7xl";

  return (
    <div className={cn("w-full mx-auto", maxWidth, className)}>
      {children}
    </div>
  );
}
