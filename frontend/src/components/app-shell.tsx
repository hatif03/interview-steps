"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthProvider } from "@/lib/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCandidatePortal = pathname.startsWith("/candidate");

  if (isCandidatePortal) {
    return (
      <AuthProvider>
        <div className="min-h-screen bg-muted/30">{children}</div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen bg-muted/30">
        <div className="p-8">{children}</div>
      </main>
    </AuthProvider>
  );
}
