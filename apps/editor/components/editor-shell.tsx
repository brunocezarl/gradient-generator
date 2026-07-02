"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Scene } from "@shadercanvas/scene-schema";
import { validateScene } from "@shadercanvas/scene-schema";
import {
  CanvasPreview,
  type CanvasPreviewHandle,
} from "@/components/canvas-preview";
import { LayerList } from "@/components/layer-list";
import { PropertyPanel } from "@/components/property-panel";
import { SceneIo } from "@/components/scene-io";
import { VariableBindingsPanel } from "@/components/variable-bindings-panel";
import { VariablesPanel } from "@/components/variables-panel";
import { AuthHeader } from "@/components/auth-header";
import { CloudSave } from "@/components/cloud-save";
import { PublishDialog } from "@/components/publish-dialog";
import { downloadDataUrl } from "@/lib/capture-png";
import { createDefaultScene } from "@/lib/default-scene";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { getProject, renameProject } from "@/lib/supabase/projects";

export function EditorShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isConfigured } = useAuth();

  const projectIdParam = searchParams.get("project");
  const [projectId, setProjectId] = useState<string | null>(projectIdParam);
  const [projectName, setProjectName] = useState("Untitled project");
  const [isPublished, setIsPublished] = useState(false);
  const [loadingProject, setLoadingProject] = useState(Boolean(projectIdParam));

  const initialScene = useMemo(() => createDefaultScene(), []);
  const [scene, setScene] = useState<Scene>(initialScene);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    initialScene.layers[0]?.id ?? null,
  );
  const [selectedEffectIndex, setSelectedEffectIndex] = useState(0);
  const previewRef = useRef<CanvasPreviewHandle>(null);

  // Load cloud project when ?project=id is present.
  useEffect(() => {
    const id = searchParams.get("project");
    setProjectId(id);

    if (!id || !isConfigured) {
      setLoadingProject(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setLoadingProject(false);
      return;
    }

    setLoadingProject(true);
    void getProject(supabase, id)
      .then((row) => {
        if (!row) {
          alert("Project not found or you don't have access.");
          router.replace("/editor");
          return;
        }
        const result = validateScene(row.scene_json);
        if (!result.valid) {
          alert("This project's scene data is invalid.");
          return;
        }
        setScene(row.scene_json);
        setProjectName(row.name);
        setIsPublished(Boolean(row.published_at));
        setSelectedLayerId(row.scene_json.layers[0]?.id ?? null);
        setSelectedEffectIndex(0);
      })
      .catch((err) => {
        alert(err instanceof Error ? err.message : "Failed to load project");
      })
      .finally(() => setLoadingProject(false));
  }, [searchParams, isConfigured, router]);

  const handleProjectSaved = useCallback(
    (id: string, name: string) => {
      setProjectId(id);
      setProjectName(name);
      if (searchParams.get("project") !== id) {
        router.replace(`/editor?project=${id}`);
      }
    },
    [router, searchParams],
  );

  const handleSelectLayer = (layerId: string) => {
    setSelectedLayerId(layerId);
    setSelectedEffectIndex(0);
  };

  const exportPng = (scale: number) => {
    try {
      const dataUrl = previewRef.current?.capturePng(scale);
      if (!dataUrl) {
        alert("Preview is not ready yet — wait a moment and try again.");
        return;
      }
      const { width, height } = scene.canvas;
      downloadDataUrl(dataUrl, `shadercanvas-${width}x${height}@${scale}x.png`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to export PNG.");
    }
  };

  if (loadingProject) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
        <p className="text-zinc-400">Loading project…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-400">Phase 2</p>
          <h1 className="text-2xl font-semibold text-white">ShaderCanvas Studio</h1>
          {projectId ? (
            <input
              type="text"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              onBlur={() => {
                if (!projectId || !user) return;
                const supabase = createClient();
                if (!supabase) return;
                void renameProject(supabase, projectId, projectName);
              }}
              className="mt-1 w-full max-w-xs border-b border-transparent bg-transparent text-sm text-zinc-300 hover:border-zinc-700 focus:border-violet-500 focus:outline-none"
              aria-label="Project name"
            />
          ) : (
            <p className="mt-1 text-sm text-zinc-400">
              Layered WebGL scenes with effects, variables, and interactivity.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <AuthHeader />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SceneIo scene={scene} onLoadScene={setScene} onExportPng={exportPng} />
            <CloudSave
              scene={scene}
              projectId={projectId}
              projectName={projectName}
              onProjectSaved={handleProjectSaved}
            />
            <PublishDialog
              projectId={projectId}
              isPublished={isPublished}
              onPublishedChange={setIsPublished}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <CanvasPreview ref={previewRef} scene={scene} />

        <aside className="space-y-4">
          <LayerList
            scene={scene}
            selectedLayerId={selectedLayerId}
            onSelectLayer={handleSelectLayer}
            onUpdateScene={setScene}
          />
          <PropertyPanel
            scene={scene}
            selectedLayerId={selectedLayerId}
            selectedEffectIndex={selectedEffectIndex}
            onSelectEffect={setSelectedEffectIndex}
            onUpdateScene={setScene}
          />
          <VariablesPanel scene={scene} onUpdateScene={setScene} />
          <VariableBindingsPanel
            scene={scene}
            selectedLayerId={selectedLayerId}
            selectedEffectIndex={selectedEffectIndex}
            onUpdateScene={setScene}
          />
        </aside>
      </div>
    </main>
  );
}
