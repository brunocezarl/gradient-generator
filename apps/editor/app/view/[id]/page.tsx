"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ShaderCanvas, type ShaderCanvasInstance } from "@shadercanvas/runtime-sdk";
import { createClient } from "@/lib/supabase/client";
import { getPublishedProject } from "@/lib/supabase/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Public read-only viewer for published scenes. */
export default function ViewPage() {
  const params = useParams<{ id: string }>();
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ShaderCanvasInstance | null>(null);
  const [status, setStatus] = useState("Loading scene…");
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    let cancelled = false;

    async function load() {
      if (!isSupabaseConfigured()) {
        setStatus("Supabase is not configured on this deployment.");
        return;
      }

      const supabase = createClient();
      if (!supabase) return;

      try {
        const row = await getPublishedProject(supabase, id);
        if (cancelled) return;

        if (!row) {
          setStatus("This scene is not published or does not exist.");
          return;
        }

        setProjectName(row.name);

        if (!hostRef.current) return;
        instanceRef.current?.destroy();
        instanceRef.current = await ShaderCanvas.create({
          container: hostRef.current,
          scene: row.scene_json,
          autoplay: true,
        });
        setStatus("");
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : "Failed to load scene");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [params.id]);

  useEffect(() => {
    const onResize = () => instanceRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0b0f]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {projectName && (
          <h1 className="mb-4 text-lg font-medium text-zinc-300">{projectName}</h1>
        )}
        <div
          ref={hostRef}
          className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black"
        />
        {status && <p className="mt-4 text-sm text-zinc-500">{status}</p>}
      </div>
    </main>
  );
}
