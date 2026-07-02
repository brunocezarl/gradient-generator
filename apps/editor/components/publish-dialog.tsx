"use client";

import { useState } from "react";
import { getAppBaseUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { publishProject } from "@/lib/supabase/projects";
import { useAuth } from "@/lib/auth-context";

interface PublishDialogProps {
  projectId: string | null;
  isPublished: boolean;
  onPublishedChange: (published: boolean) => void;
}

/** Publish a project and copy share/embed links. */
export function PublishDialog({
  projectId,
  isPublished,
  onPublishedChange,
}: PublishDialogProps) {
  const { user, isConfigured } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(isPublished);

  if (!isConfigured || !user || !projectId) return null;

  const baseUrl = getAppBaseUrl();
  const viewUrl = `${baseUrl}/view/${projectId}`;
  const sceneApiUrl = `${baseUrl}/api/scene/${projectId}`;

  const iframeSnippet = `<iframe src="${viewUrl}" width="1280" height="720" frameborder="0" allowfullscreen></iframe>`;

  const scriptSnippet = `<!-- ShaderCanvas embed (requires runtime SDK on your CDN) -->
<div id="shadercanvas-${projectId}"></div>
<script type="module">
  import { ShaderCanvas } from "YOUR_RUNTIME_SDK_URL";
  ShaderCanvas.create({
    container: document.getElementById("shadercanvas-${projectId}"),
    sceneUrl: "${sceneApiUrl}",
    autoplay: true,
  });
</script>`;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch {
      prompt("Copy this:", text);
    }
  };

  const togglePublish = async () => {
    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    try {
      const next = !published;
      await publishProject(supabase, projectId, next);
      setPublished(next);
      onPublishedChange(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-sky-700/60 bg-sky-950/40 px-3 py-2 text-sm text-sky-200 hover:border-sky-500"
      >
        {published ? "Published" : "Publish"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Publish & embed</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Published scenes are read-only and accessible via a public URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void togglePublish()}
              className={`mb-6 w-full rounded-lg px-4 py-2 text-sm font-medium ${
                published
                  ? "border border-amber-700/60 bg-amber-950/40 text-amber-200"
                  : "border border-emerald-700/60 bg-emerald-950/40 text-emerald-200"
              }`}
            >
              {busy
                ? "Updating…"
                : published
                  ? "Unpublish (make private)"
                  : "Publish now"}
            </button>

            {published && (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                    Share link
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={viewUrl}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void copyText(viewUrl)}
                      className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-zinc-500"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                    iframe embed
                  </p>
                  <textarea
                    readOnly
                    rows={3}
                    value={iframeSnippet}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void copyText(iframeSnippet)}
                    className="mt-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-zinc-500"
                  >
                    Copy iframe code
                  </button>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                    Script embed (runtime SDK)
                  </p>
                  <textarea
                    readOnly
                    rows={8}
                    value={scriptSnippet}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void copyText(scriptSnippet)}
                    className="mt-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs hover:border-zinc-500"
                  >
                    Copy script snippet
                  </button>
                  <p className="mt-2 text-xs text-zinc-500">
                    Replace YOUR_RUNTIME_SDK_URL with your hosted runtime bundle. Scene JSON
                    is served at the API URL above.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
