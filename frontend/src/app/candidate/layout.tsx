"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PageSkeleton } from "@/components/loading";
import { Button } from "@/components/ui/button";

const PUBLIC_PATHS = ["/candidate/sign-in", "/candidate/sign-up"];

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.push("/candidate/sign-in");
    }
  }, [user, loading, router, isPublic]);

  if (isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        {children}
      </div>
    );
  }

  if (loading) return <div className="p-8"><PageSkeleton rows={3} /></div>;
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mock Interview Portal</h1>
          <p className="text-sm text-muted-foreground">AI-powered voice interviews</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </header>
      {children}
    </div>
  );
}
