"use client";

import { useEffect } from "react";
import { getFirebaseAnalytics } from "@/lib/firebase";

/** Mount once in the app tree to enable Firebase Analytics. */
export function FirebaseAnalytics() {
  useEffect(() => {
    getFirebaseAnalytics().catch(() => {
      // Analytics blocked or unsupported — safe to ignore
    });
  }, []);
  return null;
}
