"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { api, AppUser, setAuthTokenProvider } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: "recruiter" | "candidate") => Promise<void>;
  signInWithGoogle: (role: "recruiter" | "candidate") => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  completeOAuthProfile: (role: "recruiter" | "candidate") => Promise<AppUser | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export async function ensureUserProfile(
  supabaseUser: User,
  role: "recruiter" | "candidate"
): Promise<AppUser> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("No session");

  try {
    return await api.getMe(token);
  } catch {
    const email = supabaseUser.email || "";
    const name =
      supabaseUser.user_metadata?.name ||
      supabaseUser.user_metadata?.full_name ||
      email.split("@")[0] ||
      "User";
    await api.registerUser({
      uid: supabaseUser.id,
      email,
      name,
      role,
    });
    if (role === "candidate") {
      await api.linkCandidate(token);
    }
    return { id: supabaseUser.id, email, name, role };
  }
}

async function loadProfile(user: User): Promise<AppUser | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;
  try {
    return await api.getMe(token);
  } catch {
    return {
      id: user.id,
      email: user.email || "",
      name:
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email ||
        "",
      role: "candidate",
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setProfile(await loadProfile(u));
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session: Session | null) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setProfile(await loadProfile(u));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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

    await api.registerUser({
      uid: data.user.id,
      email,
      name,
      role,
    });
    if (role === "candidate") {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) await api.linkCandidate(token);
    }
  };

  const signInWithGoogle = async (role: "recruiter" | "candidate") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("auth_role", role);
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  };

  const completeOAuthProfile = async (role: "recruiter" | "candidate") => {
    const { data: sessionData } = await supabase.auth.getSession();
    const u = sessionData.session?.user;
    if (!u) return null;
    const p = await ensureUserProfile(u, role);
    setProfile(p);
    return p;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const getIdToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    setAuthTokenProvider(getIdToken);
  }, [getIdToken]);

  const refreshProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const u = sessionData.session?.user;
    if (u) setProfile(await loadProfile(u));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        completeOAuthProfile,
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
