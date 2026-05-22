"use client";

import { usePathname } from "next/navigation";

export type PortalType = "recruiter" | "candidate" | "auth-recruiter" | "auth-candidate";

export function getPortalFromPath(pathname: string): PortalType {
  if (pathname.startsWith("/candidate/sign-in") || pathname.startsWith("/candidate/sign-up")) {
    return "auth-candidate";
  }
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/auth/callback")) {
    return "auth-recruiter";
  }
  if (pathname.startsWith("/apply/")) {
    return "auth-candidate";
  }
  if (pathname.startsWith("/candidate") || pathname.startsWith("/apply")) {
    return "candidate";
  }
  return "recruiter";
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const portal = getPortalFromPath(pathname);

  return (
    <div data-portal={portal} className="min-h-screen w-full">
      {children}
    </div>
  );
}
