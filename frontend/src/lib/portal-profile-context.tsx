"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, CandidateProfile, RecruiterProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isCandidate, isRecruiter } from "@/lib/auth-utils";
import { getCachedOnboarding, setCachedOnboarding } from "@/lib/onboarding-cache";

interface PortalProfileContextValue {
  recruiterProfile: RecruiterProfile | null;
  candidateProfile: CandidateProfile | null;
  portalReady: boolean;
  profileError: string | null;
  refreshRecruiterProfile: () => Promise<RecruiterProfile | null>;
  refreshCandidateProfile: () => Promise<CandidateProfile | null>;
  setRecruiterProfileLocal: (profile: RecruiterProfile) => void;
  setCandidateProfileLocal: (profile: CandidateProfile) => void;
  recruiterOnboardingComplete: boolean | null;
  candidateOnboardingComplete: boolean | null;
}

const PortalProfileContext = createContext<PortalProfileContextValue | null>(null);

export function PortalProfileProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading, getIdToken } = useAuth();
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fetchedForRole = useRef<string | null>(null);

  const refreshRecruiterProfile = useCallback(async (): Promise<RecruiterProfile | null> => {
    const token = await getIdToken();
    if (!token || !user) return null;
    try {
      const rp = await api.getRecruiterProfile(token);
      setRecruiterProfile(rp);
      setCachedOnboarding(user.id, "recruiter", !!rp.onboarding_completed);
      setProfileError(null);
      return rp;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) return null;
      const message = err instanceof Error ? err.message : "Failed to load recruiter profile";
      setProfileError(message);
      return null;
    }
  }, [getIdToken, user]);

  const refreshCandidateProfile = useCallback(async (): Promise<CandidateProfile | null> => {
    const token = await getIdToken();
    if (!token || !user) return null;
    try {
      const cp = await api.getCandidateProfile(token);
      setCandidateProfile(cp);
      setCachedOnboarding(user.id, "candidate", !!cp.onboarding_completed);
      setProfileError(null);
      return cp;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) return null;
      const message = err instanceof Error ? err.message : "Failed to load candidate profile";
      setProfileError(message);
      return null;
    }
  }, [getIdToken, user]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRecruiterProfile(null);
      setCandidateProfile(null);
      setPortalReady(true);
      setProfileError(null);
      fetchedForRole.current = null;
      return;
    }

    if (!profile) return;

    const roleKey = `${user.id}:${profile.role}`;
    if (fetchedForRole.current === roleKey) return;

    let cancelled = false;
    fetchedForRole.current = roleKey;

    const load = async () => {
      setPortalReady(false);
      setProfileError(null);

      const recruiterCached = getCachedOnboarding(user.id, "recruiter");
      const candidateCached = getCachedOnboarding(user.id, "candidate");

      if (isRecruiter(profile, user)) {
        if (recruiterCached !== null) {
          setRecruiterProfile((prev) =>
            prev ?? ({ user_id: user.id, onboarding_completed: recruiterCached } as RecruiterProfile)
          );
        }
        await refreshRecruiterProfile();
      } else if (isCandidate(profile, user)) {
        if (candidateCached !== null) {
          setCandidateProfile((prev) =>
            prev ?? ({ user_id: user.id, onboarding_completed: candidateCached } as CandidateProfile)
          );
        }
        await refreshCandidateProfile();
      }

      if (!cancelled) setPortalReady(true);
    };

    load().catch(() => {
      if (!cancelled) {
        setProfileError("Failed to load profile");
        setPortalReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile, refreshRecruiterProfile, refreshCandidateProfile]);

  const setRecruiterProfileLocal = useCallback(
    (rp: RecruiterProfile) => {
      setRecruiterProfile(rp);
      if (user) setCachedOnboarding(user.id, "recruiter", !!rp.onboarding_completed);
    },
    [user]
  );

  const setCandidateProfileLocal = useCallback(
    (cp: CandidateProfile) => {
      setCandidateProfile(cp);
      if (user) setCachedOnboarding(user.id, "candidate", !!cp.onboarding_completed);
    },
    [user]
  );

  return (
    <PortalProfileContext.Provider
      value={{
        recruiterProfile,
        candidateProfile,
        portalReady,
        profileError,
        refreshRecruiterProfile,
        refreshCandidateProfile,
        setRecruiterProfileLocal,
        setCandidateProfileLocal,
        recruiterOnboardingComplete: recruiterProfile?.onboarding_completed ?? null,
        candidateOnboardingComplete: candidateProfile?.onboarding_completed ?? null,
      }}
    >
      {children}
    </PortalProfileContext.Provider>
  );
}

export function usePortalProfile() {
  const ctx = useContext(PortalProfileContext);
  if (!ctx) throw new Error("usePortalProfile must be used within PortalProfileProvider");
  return ctx;
}
