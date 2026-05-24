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
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/password";
import { authErrorMessage, EmailConfirmationRequiredError } from "@/lib/auth-errors";

const FEATURES = [
  "AI-powered resume screening at scale",
  "Pipeline kanban with stage tracking",
  "Automated AI voice interviews with instant feedback",
];

export default function RecruiterSignInPage() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      const passwordError = validatePassword(password);
      if (passwordError) {
        toast.error(passwordError);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }
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
    } catch (err) {
      if (err instanceof EmailConfirmationRequiredError) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        toast.error(authErrorMessage(err));
      }
      return;
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 12 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>
            )}
          </div>
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}
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
