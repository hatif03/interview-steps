"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun, LogOut, AlertCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { usePortalProfile } from "@/lib/portal-profile-context";
import { isRecruiter } from "@/lib/auth-utils";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
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
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function RecruiterShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    portalReady,
    profileError,
    recruiterOnboardingComplete,
    refreshRecruiterProfile,
  } = usePortalProfile();
  const redirected = useRef(false);

  const isRecruiterUser = isRecruiter(profile, user);

  useEffect(() => {
    if (loading || !portalReady || !user) return;
    if (pathname.startsWith("/recruiter/onboarding") || pathname === "/sign-in") return;

    if (!isRecruiterUser) {
      router.replace("/candidate");
      return;
    }

    if (recruiterOnboardingComplete === false && !redirected.current) {
      redirected.current = true;
      router.replace("/recruiter/onboarding");
    }
  }, [loading, portalReady, user, profile, pathname, router, recruiterOnboardingComplete, isRecruiterUser]);

  if (loading || !portalReady || (user && !isRecruiterUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  const initials = (profile?.name || user?.email || "R")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-muted/40">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <AppBreadcrumb />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted outline-none">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="size-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {profileError && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{profileError}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refreshRecruiterProfile()}>
              Retry
            </Button>
          </div>
        )}

        <main className="flex-1 p-6 md:p-8">
          <AppContainer size="recruiter">
            {loading || !portalReady ? (
              <div className="animate-pulse text-muted-foreground text-sm py-8">Loading workspace...</div>
            ) : (
              <PageTransition>{children}</PageTransition>
            )}
          </AppContainer>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
