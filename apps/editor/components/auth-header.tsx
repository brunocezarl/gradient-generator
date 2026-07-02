"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/** Header links for auth state — sign in/out and dashboard navigation. */
export function AuthHeader() {
  const { isConfigured, user, loading, signOut } = useAuth();

  if (!isConfigured) {
    return (
      <p className="text-xs text-zinc-500">
        Cloud features off — add Supabase env vars to enable.
      </p>
    );
  }

  if (loading) {
    return <p className="text-xs text-zinc-500">Checking session…</p>;
  }

  if (!user) {
    return (
      <Link
        href="/auth/sign-in"
        className="rounded-lg border border-violet-700/60 bg-violet-950/40 px-3 py-2 text-sm text-violet-200 hover:border-violet-500"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/dashboard"
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:border-zinc-500"
      >
        Dashboard
      </Link>
      <span className="hidden text-xs text-zinc-500 sm:inline">{user.email}</span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:border-zinc-500"
      >
        Sign out
      </button>
    </div>
  );
}
