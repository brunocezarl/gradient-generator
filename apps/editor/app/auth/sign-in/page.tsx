"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-4 text-sm text-zinc-400">
          Supabase env vars are missing. Add them to <code>.env.local</code> first.
        </p>
        <Link href="/editor" className="mt-4 inline-block text-violet-400 hover:underline">
          Back to editor
        </Link>
      </main>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    setMessage(null);

    try {
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email to confirm your account (if confirmation is enabled).");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Save projects to the cloud and publish shareable scenes.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          />
        </label>

        {message && (
          <p className={`text-sm ${message.includes("Check") ? "text-emerald-400" : "text-red-400"}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg border border-violet-700/60 bg-violet-950/40 py-2 text-sm text-violet-200 hover:border-violet-500 disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        {mode === "sign-in" ? (
          <>
            No account?{" "}
            <button
              type="button"
              onClick={() => setMode("sign-up")}
              className="text-violet-400 hover:underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("sign-in")}
              className="text-violet-400 hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>

      <Link href="/editor" className="mt-8 text-center text-sm text-zinc-500 hover:text-zinc-300">
        Continue without signing in
      </Link>
    </main>
  );
}
