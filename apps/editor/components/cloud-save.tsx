"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scene } from "@shadercanvas/scene-schema";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { createProject, saveProject } from "@/lib/supabase/projects";

interface CloudSaveProps {
  scene: Scene;
  projectId: string | null;
  projectName: string;
  onProjectSaved: (id: string, name: string) => void;
}

/** Save current scene to Supabase — visible only when signed in. */
export function CloudSave({
  scene,
  projectId,
  projectName,
  onProjectSaved,
}: CloudSaveProps) {
  const { user, isConfigured } = useAuth();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneRef = useRef(scene);

  sceneRef.current = scene;

  const performSave = useCallback(
    async (silent = false) => {
      const supabase = createClient();
      if (!supabase || !user) return;

      setSaving(true);
      setError(null);

      try {
        if (projectId) {
          await saveProject(supabase, projectId, sceneRef.current, projectName);
          onProjectSaved(projectId, projectName);
        } else {
          const created = await createProject(
            supabase,
            user.id,
            sceneRef.current,
            projectName || "Untitled project",
          );
          onProjectSaved(created.id, created.name);
        }
        setLastSaved(new Date());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setError(message);
        if (!silent) alert(`Cloud save failed: ${message}`);
      } finally {
        setSaving(false);
      }
    },
    [user, projectId, projectName, onProjectSaved],
  );

  // Debounced auto-save every 30s after scene changes (when project exists).
  useEffect(() => {
    if (!user || !projectId) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void performSave(true);
    }, 30_000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [scene, user, projectId, performSave]);

  if (!isConfigured || !user) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={saving}
        onClick={() => void performSave(false)}
        className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : projectId ? "Save to cloud" : "Save new project"}
      </button>
      {lastSaved && (
        <span className="text-xs text-zinc-500">
          Saved {lastSaved.toLocaleTimeString()}
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
