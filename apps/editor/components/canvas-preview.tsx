"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Scene } from "@shadercanvas/scene-schema";
import { SceneRenderer } from "@shadercanvas/engine";

export interface CanvasPreviewHandle {
  /** Capture the current frame as a PNG data URL at scene resolution × scale. */
  capturePng: (scale?: number) => string;
}

interface CanvasPreviewProps {
  scene: Scene;
}

/** Live WebGL preview powered by @shadercanvas/engine. */
export const CanvasPreview = forwardRef<CanvasPreviewHandle, CanvasPreviewProps>(
  function CanvasPreview({ scene }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<SceneRenderer | null>(null);

    useImperativeHandle(ref, () => ({
      capturePng: (scale = 1) => {
        const renderer = rendererRef.current;
        if (!renderer) {
          throw new Error("Preview is not ready yet — wait for the canvas to load.");
        }
        return renderer.captureSnapshot(scale);
      },
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const canvas = document.createElement("canvas");
      canvas.className = "h-full w-full";
      host.replaceChildren(canvas);

      const renderer = new SceneRenderer({ canvas, scene });
      rendererRef.current = renderer;

      const resize = () => {
        renderer.resize(host.clientWidth, host.clientHeight);
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(host);

      return () => {
        observer.disconnect();
        renderer.dispose();
        rendererRef.current = null;
      };
    }, []);

    // Hot-update scene without rebuilding the WebGL context.
    useEffect(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.setScene(scene);
      for (const [name, value] of Object.entries(scene.variables ?? {})) {
        renderer.setVariable(name, value);
      }
    }, [scene]);

    return (
      <div
        ref={hostRef}
        className="aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black"
      />
    );
  },
);
