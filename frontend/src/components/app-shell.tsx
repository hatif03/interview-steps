"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";
import { PortalProvider } from "@/components/portal-provider";
import { RecruiterShell } from "@/components/layouts/recruiter-shell";
import { CandidateShell } from "@/components/layouts/candidate-shell";

const BARE_PATHS = ["/sign-in", "/auth/callback", "/apply"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isBare =
    BARE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/apply/");

  const isCandidatePortal = pathname.startsWith("/candidate");
  const isRecruiterOnboarding = pathname.startsWith("/recruiter");

  return (
    <AuthProvider>
      <PortalProvider>
        {isBare ? (
          children
        ) : isCandidatePortal ? (
          <CandidateShell>{children}</CandidateShell>
        ) : isRecruiterOnboarding ? (
          <RecruiterShell>{children}</RecruiterShell>
        ) : (
          <RecruiterShell>{children}</RecruiterShell>
        )}
      </PortalProvider>
    </AuthProvider>
  );
}
