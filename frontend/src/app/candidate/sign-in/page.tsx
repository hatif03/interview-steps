"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

function SignInForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/candidate";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      router.push(redirect);
    } catch {
      toast.error("Sign in failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Candidate Sign In</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleSignInButton role="candidate" onSuccess={() => router.push(redirect)} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center">
          No account?{" "}
          <Link href={`/candidate/sign-up?redirect=${encodeURIComponent(redirect)}`} className="text-primary underline">
            Sign up
          </Link>
        </p>
        <p className="text-xs text-muted-foreground text-center">
          <Link href="/sign-in" className="underline">I'm a recruiter</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function CandidateSignInPage() {
  return (
    <AuthLayout variant="candidate" title="Your career journey" subtitle="Apply to roles, track progress, and ace mock interviews.">
      <Suspense fallback={<div className="animate-pulse text-muted-foreground">Loading...</div>}>
        <SignInForm />
      </Suspense>
    </AuthLayout>
  );
}
