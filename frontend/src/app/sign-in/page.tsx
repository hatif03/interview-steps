"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const FEATURES = [
  "AI-powered resume screening at scale",
  "Pipeline kanban with stage tracking",
  "Mock voice interviews with instant feedback",
];

export default function RecruiterSignInPage() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, name, "recruiter");
        toast.success("Account created");
        router.push("/recruiter/onboarding");
      } else {
        await signIn(email, password);
        router.push("/");
      }
    } catch {
      toast.error(mode === "signup" ? "Sign up failed" : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      variant="recruiter"
      title="Hire smarter with AI"
      subtitle="Screen, rank, and interview candidates at scale."
      features={FEATURES}
    >
      <AuthCard
        title={mode === "signin" ? "Recruiter Sign In" : "Create Recruiter Account"}
        description={mode === "signin" ? "Welcome back — sign in to your workspace." : "Get started with your recruiter account."}
      >
        <GoogleSignInButton role="recruiter" onSuccess={() => router.push("/recruiter/onboarding")} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button type="button" className="text-primary font-medium hover:underline" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button type="button" className="text-primary font-medium hover:underline" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
