"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api, AppUser } from "@/lib/api";

const googleProvider = new GoogleAuthProvider();

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: "recruiter" | "candidate") => Promise<void>;
  signInWithGoogle: (role: "recruiter" | "candidate") => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureUserProfile(
  firebaseUser: User,
  role: "recruiter" | "candidate"
): Promise<AppUser> {
  const token = await firebaseUser.getIdToken();
  try {
    return await api.getMe(token);
  } catch {
    const email = firebaseUser.email || "";
    const name =
      firebaseUser.displayName || email.split("@")[0] || "User";
    await api.registerUser({
      uid: firebaseUser.uid,
      email,
      name,
      role,
    });
    if (role === "candidate") {
      await api.linkCandidate(token);
    }
    return { id: firebaseUser.uid, email, name, role };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const me = await api.getMe(token);
          setProfile(me);
        } catch {
          setProfile({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || firebaseUser.email || "",
            role: "candidate",
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: "recruiter" | "candidate"
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await api.registerUser({
      uid: cred.user.uid,
      email,
      name,
      role,
    });
    if (role === "candidate") {
      const token = await cred.user.getIdToken();
      await api.linkCandidate(token);
    }
  };

  const signInWithGoogle = async (role: "recruiter" | "candidate") => {
    const result = await signInWithPopup(auth, googleProvider);
    if (!result.user) return;
    const profileData = await ensureUserProfile(result.user, role);
    setProfile(profileData);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

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
        getIdToken,
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
