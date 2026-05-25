import type { User } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/api";

export type UserRole = "recruiter" | "candidate";

export function resolveRole(
  profile: AppUser | null | undefined,
  user: User | null | undefined
): UserRole | undefined {
  const fromProfile = profile?.role;
  if (fromProfile === "recruiter" || fromProfile === "candidate") {
    return fromProfile;
  }
  const fromMetadata = user?.user_metadata?.role;
  if (fromMetadata === "recruiter" || fromMetadata === "candidate") {
    return fromMetadata;
  }
  return undefined;
}

export function isRecruiter(
  profile: AppUser | null | undefined,
  user: User | null | undefined
): boolean {
  return resolveRole(profile, user) === "recruiter";
}

export function isCandidate(
  profile: AppUser | null | undefined,
  user: User | null | undefined
): boolean {
  return resolveRole(profile, user) === "candidate";
}
