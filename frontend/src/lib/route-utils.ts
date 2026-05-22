/** Recruiter candidate management lives at /candidates — not the candidate portal. */
export function isCandidatePortalPath(pathname: string): boolean {
  return pathname === "/candidate" || pathname.startsWith("/candidate/");
}

const RECRUITER_PREFIXES = ["/jobs", "/candidates", "/pipeline", "/settings", "/recruiter"];

/** Recruiter workspace routes (dashboard is `/` exactly). */
export function isRecruiterPortalPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return RECRUITER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAuthEntryPath(pathname: string): boolean {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/candidate/sign-in") ||
    pathname.startsWith("/candidate/sign-up") ||
    pathname.startsWith("/apply/")
  );
}
