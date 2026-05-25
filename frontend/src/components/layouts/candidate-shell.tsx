"use client";

import { useEffect, useRef } from "react";
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
  AlertCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { usePortalProfile } from "@/lib/portal-profile-context";
import { isRecruiter } from "@/lib/auth-utils";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";
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
  const { user, profile, loading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    portalReady,
    profileError,
    candidateOnboardingComplete,
    refreshCandidateProfile,
  } = usePortalProfile();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || !portalReady || isPublic) return;

    if (!user) {
      router.push("/candidate/sign-in");
      return;
    }

    if (isRecruiter(profile, user)) {
      router.replace("/");
      return;
    }

    if (pathname.startsWith("/candidate/onboarding")) return;

    if (candidateOnboardingComplete === false && !redirected.current) {
      redirected.current = true;
      router.replace("/candidate/onboarding");
    }
  }, [loading, portalReady, user, profile, pathname, router, isPublic, candidateOnboardingComplete]);

  if (isPublic) return <>{children}</>;

  if (!user && !loading) return null;

  const initials = (profile?.name || user?.email || "C")
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
              <span className="font-semibold text-base">{APP_NAME}</span>
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

      {profileError && (
        <AppContainer size="candidate" className="px-4 sm:px-6 mt-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{profileError}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refreshCandidateProfile()}>
              Retry
            </Button>
          </div>
        </AppContainer>
      )}

      <main className="flex-1 py-8 pb-24 md:pb-10">
        <AppContainer size="candidate" className="px-4 sm:px-6">
          {loading || !portalReady ? (
            <div className="animate-pulse text-muted-foreground text-sm py-8">Loading...</div>
          ) : (
            <PageTransition>{children}</PageTransition>
          )}
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
