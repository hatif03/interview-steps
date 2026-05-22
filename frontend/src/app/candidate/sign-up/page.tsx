"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  "Build your candidate profile once",
  "Apply to multiple roles effortlessly",
  "Get AI-powered interview prep",
];

function SignUpForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/candidate/onboarding";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name, "candidate");
      toast.success("Account created!");
      router.push(redirect);
    } catch (err) {
      if (err instanceof EmailConfirmationRequiredError) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        router.push(`/candidate/sign-in?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create Candidate Account" description="Join the talent pool and start applying.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
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
            minLength={12}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>
        </div>
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground text-center">
        Already have an account?{" "}
        <Link
          href={`/candidate/sign-in?redirect=${encodeURIComponent(redirect)}`}
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function CandidateSignUpPage() {
  return (
    <AuthLayout
      variant="candidate"
      title="Join the talent pool"
      subtitle="Create your profile and apply to exciting roles."
      features={FEATURES}
    >
      <Suspense fallback={<div className="animate-pulse text-muted-foreground">Loading...</div>}>
        <SignUpForm />
      </Suspense>
    </AuthLayout>
  );
}
