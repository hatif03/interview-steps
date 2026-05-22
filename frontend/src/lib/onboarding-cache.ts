const PREFIX = "interview-steps:onboarding:";

export function getCachedOnboarding(userId: string, portal: "recruiter" | "candidate"): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${portal}:${userId}`);
    if (raw === null) return null;
    return raw === "true";
  } catch {
    return null;
  }
}

export function setCachedOnboarding(
  userId: string,
  portal: "recruiter" | "candidate",
  completed: boolean
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${PREFIX}${portal}:${userId}`, String(completed));
  } catch {
    // ignore quota errors
  }
}

export function clearOnboardingCache(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`${PREFIX}recruiter:${userId}`);
    sessionStorage.removeItem(`${PREFIX}candidate:${userId}`);
  } catch {
    // ignore
  }
}
