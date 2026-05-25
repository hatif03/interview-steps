"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { PortalProfileProvider } from "@/lib/portal-profile-context";
import { PortalProvider } from "@/components/portal-provider";
import { RecruiterShell } from "@/components/layouts/recruiter-shell";
import { CandidateShell } from "@/components/layouts/candidate-shell";
import {
  isAuthEntryPath,
  isCandidatePortalPath,
  isRecruiterPortalPath,
} from "@/lib/route-utils";
import { isCandidate, isRecruiter, resolveRole } from "@/lib/auth-utils";

function PortalBootLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}

function PortalShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const isBare = isAuthEntryPath(pathname);
  const role = resolveRole(profile, user);

  useEffect(() => {
    if (loading || !user || !role || isBare) return;

    if (isCandidate(profile, user) && isRecruiterPortalPath(pathname)) {
      router.replace("/candidate");
      return;
    }

    if (isRecruiter(profile, user) && isCandidatePortalPath(pathname)) {
      router.replace("/");
    }
  }, [loading, user, profile, role, pathname, router, isBare]);

  if (isBare) return <>{children}</>;

  if (loading || (user && !role)) {
    return <PortalBootLoader />;
  }

  if (user && isCandidate(profile, user) && isRecruiterPortalPath(pathname)) {
    return <PortalBootLoader />;
  }

  if (user && isRecruiter(profile, user) && isCandidatePortalPath(pathname)) {
    return <PortalBootLoader />;
  }

  if (isCandidatePortalPath(pathname)) {
    return <CandidateShell>{children}</CandidateShell>;
  }

  return <RecruiterShell>{children}</RecruiterShell>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PortalProfileProvider>
        <PortalProvider>
          <PortalShellGate>{children}</PortalShellGate>
        </PortalProvider>
      </PortalProfileProvider>
    </AuthProvider>
  );
}
