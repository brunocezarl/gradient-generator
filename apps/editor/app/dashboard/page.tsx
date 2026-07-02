"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthHeader } from "@/components/auth-header";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from "@/lib/supabase/projects";
import { createDefaultScene } from "@/lib/default-scene";
import type { ProjectSummary } from "@/lib/supabase/database.types";

export default function DashboardPage() {
  const { user, loading, isConfigured } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [fetching, setFetching] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !user) return;

    setFetching(true);
    try {
      const rows = await listProjects(supabase);
      setProjects(rows);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void loadProjects();
  }, [user, loadProjects]);

  const handleCreate = async () => {
    const supabase = createClient();
    if (!supabase || !user) return;

    setCreating(true);
    try {
      const scene = createDefaultScene();
      const row = await createProject(supabase, user.id, scene, "Untitled project");
      router.push(`/editor?project=${row.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create project");
      setCreating(false);
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const next = prompt("Rename project:", currentName);
    if (!next || next === currentName) return;

    const supabase = createClient();
    if (!supabase) return;

    try {
      await renameProject(supabase, id, next.trim());
      await loadProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const supabase = createClient();
    if (!supabase) return;

    try {
      await deleteProject(supabase, id);
      await loadProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (!isConfigured) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-4 text-zinc-400">
          Supabase is not configured. Copy <code>.env.local.example</code> to{" "}
          <code>.env.local</code> and add your project credentials to use the cloud dashboard.
        </p>
        <Link href="/editor" className="mt-6 inline-block text-violet-400 hover:underline">
          Open editor (local mode)
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <p className="text-zinc-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Your projects</h1>
          <AuthHeader />
        </div>
        <p className="mt-6 text-zinc-400">
          Sign in to save scenes to the cloud and manage projects from here.
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-4 inline-block rounded-lg border border-violet-700/60 bg-violet-950/40 px-4 py-2 text-sm text-violet-200"
        >
          Sign in
        </Link>
        <p className="mt-8 text-sm text-zinc-500">
          Or continue in{" "}
          <Link href="/editor" className="text-violet-400 hover:underline">
            local editor mode
          </Link>{" "}
          without cloud save.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-400">Phase 2</p>
          <h1 className="text-2xl font-semibold">Your projects</h1>
        </div>
        <AuthHeader />
      </header>

      <button
        type="button"
        disabled={creating}
        onClick={() => void handleCreate()}
        className="mb-6 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
      >
        {creating ? "Creating…" : "+ New project"}
      </button>

      {fetching && projects.length === 0 ? (
        <p className="text-zinc-500">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 text-zinc-500">
          No projects yet. Create one to get started.
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3"
            >
              <div>
                <Link
                  href={`/editor?project=${project.id}`}
                  className="font-medium text-white hover:text-violet-300"
                >
                  {project.name}
                </Link>
                <p className="text-xs text-zinc-500">
                  Updated {new Date(project.updated_at).toLocaleString()}
                  {project.published_at && (
                    <span className="ml-2 text-sky-400">· Published</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleRename(project.id, project.name)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(project.id, project.name)}
                  className="rounded-lg border border-red-900/60 px-3 py-1.5 text-xs text-red-300 hover:border-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
