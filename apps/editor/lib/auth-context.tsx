"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { uploadSceneAsset } from "@/lib/supabase/assets";

interface AuthContextValue {
  /** Whether Supabase env vars are configured. */
  isConfigured: boolean;
  /** Current session user, or null when signed out. */
  user: User | null;
  /** True while the initial session is loading. */
  loading: boolean;
  signOut: () => Promise<void>;
  /** Upload image to cloud storage when logged in; returns null if unavailable. */
  uploadAsset: (file: File) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(() => (configured ? createClient() : null), [configured]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const uploadAsset = useCallback(
    async (file: File): Promise<string | null> => {
      if (!supabase || !user) return null;
      try {
        return await uploadSceneAsset(supabase, user.id, file);
      } catch (error) {
        console.warn("Cloud asset upload failed, falling back to data URL:", error);
        return null;
      }
    },
    [supabase, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: configured,
      user,
      loading,
      signOut,
      uploadAsset,
    }),
    [configured, user, loading, signOut, uploadAsset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
