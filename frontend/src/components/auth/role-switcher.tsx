"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const pathname = usePathname();
  const isCandidate = pathname.startsWith("/candidate/sign");

  return (
    <div className="inline-flex rounded-lg border bg-muted p-1 w-full max-w-xs">
      <Link
        href="/sign-in"
        className={cn(
          "flex-1 rounded-md px-3 py-2 text-sm font-medium text-center transition-colors",
          !isCandidate ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Recruiter
      </Link>
      <Link
        href="/candidate/sign-in"
        className={cn(
          "flex-1 rounded-md px-3 py-2 text-sm font-medium text-center transition-colors",
          isCandidate ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Candidate
      </Link>
    </div>
  );
}
