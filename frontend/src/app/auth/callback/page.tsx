"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PageSkeleton } from "@/components/loading";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { completeOAuthProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const role =
        (typeof window !== "undefined" &&
          (window.localStorage.getItem("auth_role") as "recruiter" | "candidate")) ||
        "candidate";

      try {
        await completeOAuthProfile(role);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("auth_role");
        }
        router.replace(role === "recruiter" ? "/" : "/candidate");
      } catch {
        setError("Sign-in could not be completed. Please try again.");
      }
    };
    run();
  }, [completeOAuthProfile, router]);

  if (error) {
    return <p className="text-destructive p-8">{error}</p>;
  }

  return <PageSkeleton rows={3} />;
}
