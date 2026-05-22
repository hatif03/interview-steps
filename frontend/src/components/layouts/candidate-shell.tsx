"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Video,
  User,
  Moon,
  Sun,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageTransition } from "@/components/motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const navItems = [
  { href: "/candidate", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidate/applications", label: "Applications", icon: FileText },
  { href: "/candidate/interviews", label: "Interviews", icon: Video },
  { href: "/candidate/profile", label: "Profile", icon: User },
];

const PUBLIC_PATHS = ["/candidate/sign-in", "/candidate/sign-up"];

export function CandidateShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut, getIdToken } = useAuth();
  const { theme, setTheme } = useTheme();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (loading || isPublic) {
      setCheckingOnboarding(false);
      return;
    }
    if (!user) {
      router.push("/candidate/sign-in");
      return;
    }
    if (profile?.role === "recruiter") {
      router.replace("/");
      return;
    }
    if (pathname.startsWith("/candidate/onboarding")) {
      setCheckingOnboarding(false);
      return;
    }
    getIdToken().then(async (token) => {
      if (!token) {
        setCheckingOnboarding(false);
        return;
      }
      try {
        const cp = await api.getCandidateProfile(token);
        if (!cp.onboarding_completed) {
          router.replace("/candidate/onboarding");
        }
      } catch {
        router.replace("/candidate/onboarding");
      } finally {
        setCheckingOnboarding(false);
      }
    });
  }, [loading, user, profile, pathname, router, getIdToken, isPublic]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const initials = (profile?.name || user.email || "C")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="candidate-portal min-h-screen bg-gradient-to-br from-teal-50/30 to-background dark:from-teal-950/10 dark:to-background flex flex-col">
      <style jsx global>{`
        .candidate-portal {
          --primary: oklch(0.55 0.15 175);
          --primary-foreground: oklch(0.98 0.01 175);
          --ring: oklch(0.55 0.15 175);
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/candidate" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-sm">Career Portal</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/candidate"
                  ? pathname === "/candidate"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => (window.location.href = "/candidate/profile")}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24 md:pb-8">
        <PageTransition>{children}</PageTransition>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-50">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/candidate"
                ? pathname === "/candidate"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
