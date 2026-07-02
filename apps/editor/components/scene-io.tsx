"use client";

import { useState } from "react";
import type { Scene } from "@shadercanvas/scene-schema";
import {
  formatSceneValidationErrors,
  validateScene,
} from "@shadercanvas/scene-schema";

interface SceneIoProps {
  scene: Scene;
  onLoadScene: (scene: Scene) => void;
  onExportPng?: (scale: number) => void;
}

/** Download/upload helpers for Scene JSON files. */
export function SceneIo({ scene, onLoadScene, onExportPng }: SceneIoProps) {
  const [exportScale, setExportScale] = useState(1);

  const downloadScene = () => {
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "shadercanvas-scene.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadScene = async (file: File) => {
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text) as unknown;
    } catch {
      alert(
        [
          "Couldn't read this file as JSON.",
          "",
          "Make sure you selected a .json file exported from ShaderCanvas",
          "(Save JSON button) or saved by a text editor with valid JSON syntax.",
        ].join("\n"),
      );
      return;
    }

    const result = validateScene(parsed);
    if (!result.valid) {
      alert(formatSceneValidationErrors(result, parsed));
      return;
    }
    onLoadScene(parsed as Scene);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadScene}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:border-zinc-500"
      >
        Save JSON
      </button>
      <label className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:border-zinc-500">
        Load JSON
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadScene(file);
            event.target.value = "";
          }}
        />
      </label>
      {onExportPng && (
        <div className="flex items-center gap-1.5">
          <select
            value={exportScale}
            onChange={(event) => setExportScale(Number(event.target.value))}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm"
            aria-label="PNG export scale"
          >
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={3}>3×</option>
          </select>
          <button
            type="button"
            onClick={() => onExportPng(exportScale)}
            className="rounded-lg border border-violet-700/60 bg-violet-950/40 px-3 py-2 text-sm text-violet-200 hover:border-violet-500"
          >
            Export PNG
          </button>
        </div>
      )}
    </div>
  );
}
