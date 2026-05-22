"use client";

import { useEffect, useState } from "react";
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
import { api } from "@/lib/api";
import { AppContainer } from "@/components/app-container";
import { PageTransition } from "@/components/motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        if (!cp.onboarding_completed) router.replace("/candidate/onboarding");
      } catch {
        router.replace("/candidate/onboarding");
      } finally {
        setCheckingOnboarding(false);
      }
    });
  }, [loading, user, profile, pathname, router, getIdToken, isPublic]);

  if (isPublic) return <>{children}</>;

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <AppContainer size="candidate" className="px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between gap-4">
            <Link href="/candidate" className="flex items-center gap-2.5 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-base">Career Portal</span>
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
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
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
                className="size-9 rounded-full"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted outline-none">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{profile?.name}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/candidate/profile")}>Profile</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="size-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </AppContainer>
      </header>

      <main className="flex-1 py-8 pb-24 md:pb-10">
        <AppContainer size="candidate" className="px-4 sm:px-6">
          <PageTransition>{children}</PageTransition>
        </AppContainer>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur-md pb-safe">
        <div className="flex justify-around px-2 py-2">
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
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl min-w-[4.5rem] transition-colors",
                  isActive ? "text-primary bg-primary/10" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
