"use client";

import type { Layer, Scene } from "@shadercanvas/scene-schema";
import { cn } from "@/lib/cn";
import { createImageLayer, createShaderLayer, createSolidLayer } from "@/lib/scene-helpers";

interface LayerListProps {
  scene: Scene;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onUpdateScene: (scene: Scene) => void;
}

/** Layer stack with visibility toggle and add-layer actions. */
export function LayerList({
  scene,
  selectedLayerId,
  onSelectLayer,
  onUpdateScene,
}: LayerListProps) {
  const toggleVisibility = (layerId: string) => {
    onUpdateScene({
      ...scene,
      layers: scene.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, transform: { ...layer.transform, visible: !layer.transform.visible } }
          : layer,
      ),
    });
  };

  const addLayer = (layer: Layer) => {
    onUpdateScene({ ...scene, layers: [...scene.layers, layer] });
    onSelectLayer(layer.id);
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Layers</h2>
        <span className="text-xs text-zinc-500">{scene.layers.length}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => addLayer(createShaderLayer())}
          className="rounded border border-zinc-700 px-2 py-1 text-[11px] hover:border-zinc-500"
        >
          + Shader
        </button>
        <button
          type="button"
          onClick={() => addLayer(createSolidLayer())}
          className="rounded border border-zinc-700 px-2 py-1 text-[11px] hover:border-zinc-500"
        >
          + Solid
        </button>
        <button
          type="button"
          onClick={() => addLayer(createImageLayer())}
          className="rounded border border-zinc-700 px-2 py-1 text-[11px] hover:border-zinc-500"
        >
          + Image
        </button>
      </div>

      <ul className="space-y-2">
        {scene.layers.map((layer, index) => (
          <li key={layer.id}>
            <button
              type="button"
              onClick={() => onSelectLayer(layer.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                selectedLayerId === layer.id
                  ? "border-violet-500/60 bg-violet-500/10"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700",
              )}
            >
              <div>
                <p className="font-medium">{layerLabel(layer)}</p>
                <p className="text-xs text-zinc-500">
                  {layer.effects.length} fx · {layer.transform.blendMode} ·{" "}
                  {Math.round(layer.transform.opacity * 100)}%
                </p>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleVisibility(layer.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleVisibility(layer.id);
                  }
                }}
                className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                {layer.transform.visible ? "Hide" : "Show"}
              </span>
            </button>
            <p className="mt-1 pl-1 text-[11px] text-zinc-600">#{index + 1}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function layerLabel(layer: Layer): string {
  if (layer.type === "solid") return `Solid · ${layer.id}`;
  if (layer.type === "image") return `Image · ${layer.id}`;
  return `Shader · ${layer.id}`;
}
