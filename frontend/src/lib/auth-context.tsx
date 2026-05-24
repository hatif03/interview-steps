"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { api, ApiError, AppUser, setAuthTokenProvider } from "@/lib/api";
import { clearOnboardingCache } from "@/lib/onboarding-cache";
import { EmailConfirmationRequiredError } from "@/lib/auth-errors";
import { type UserRole } from "@/lib/auth-utils";

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: "recruiter" | "candidate") => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileFromUser(user: User): AppUser {
  const role = (user.user_metadata?.role as UserRole | undefined) || "candidate";
  return {
    id: user.id,
    email: user.email || "",
    name:
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email ||
      "",
    role,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Profile sync timed out")), ms)
    ),
  ]);
}

async function ensureBackendUser(user: User, token: string): Promise<AppUser> {
  try {
    return await withTimeout(api.getMe(token));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return profileFromUser(user);
    }
    const fallback = profileFromUser(user);
    try {
      await withTimeout(
        api.registerUser({
          uid: user.id,
          email: fallback.email,
          name: fallback.name,
          role: fallback.role,
        })
      );
      if (fallback.role === "candidate") {
        await withTimeout(api.linkCandidate(token));
      }
      return await withTimeout(api.getMe(token));
    } catch {
      return fallback;
    }
  }
}

async function loadProfile(user: User, token: string | null): Promise<AppUser | null> {
  if (!token) return profileFromUser(user);
  return ensureBackendUser(user, token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const syncSession = useCallback((session: Session | null) => {
    sessionRef.current = session;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        syncSession(session);
        const u = session?.user ?? null;
        setUser(u);
        userIdRef.current = u?.id ?? null;
        if (u) {
          setProfile(await loadProfile(u, session?.access_token ?? null));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session: Session | null) => {
      syncSession(session);
      const u = session?.user ?? null;
      if (!mounted) return;
      setUser(u);
      if (u) {
        if (event === "SIGNED_IN" || event === "USER_UPDATED" || u.id !== userIdRef.current) {
          setProfile(await loadProfile(u, session?.access_token ?? null));
        }
        userIdRef.current = u.id;
      } else {
        setProfile(null);
        userIdRef.current = null;
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user && data.session?.access_token) {
      syncSession(data.session);
      setProfile(await ensureBackendUser(data.user, data.session.access_token));
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: "recruiter" | "candidate"
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Sign up failed");
    if (!data.user.identities?.length) {
      throw new Error("An account with this email already exists. Try signing in instead.");
    }

    await api.registerUser({
      uid: data.user.id,
      email,
      name,
      role,
    });
    if (role === "candidate" && data.session?.access_token) {
      await api.linkCandidate(data.session.access_token);
    }

    if (!data.session) {
      await supabase.auth.signOut();
      throw new EmailConfirmationRequiredError();
    }

    syncSession(data.session);
    setProfile(await api.getMe(data.session.access_token));
  };

  const signOut = async () => {
    if (userIdRef.current) clearOnboardingCache(userIdRef.current);
    sessionRef.current = null;
    await supabase.auth.signOut();
  };

  const getIdToken = useCallback(async () => {
    const cached = sessionRef.current?.access_token;
    if (cached) return cached;

    const { data: sessionData } = await withTimeout(supabase.auth.getSession(), 5000);
    syncSession(sessionData.session);
    return sessionData.session?.access_token ?? null;
  }, [syncSession]);

  useEffect(() => {
    setAuthTokenProvider(getIdToken);
  }, [getIdToken]);

  const refreshProfile = useCallback(async () => {
    const session = sessionRef.current;
    const u = session?.user;
    const token = session?.access_token;
    if (u && token) {
      setProfile(await ensureBackendUser(u, token));
      return;
    }
    const { data: sessionData } = await withTimeout(supabase.auth.getSession(), 5000);
    syncSession(sessionData.session);
    const refreshedUser = sessionData.session?.user;
    const refreshedToken = sessionData.session?.access_token;
    if (refreshedUser && refreshedToken) {
      setProfile(await ensureBackendUser(refreshedUser, refreshedToken));
    }
  }, [syncSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        getIdToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
