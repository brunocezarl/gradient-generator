import type { Scene } from "@shadercanvas/scene-schema";
import { loadScene, loadSceneFromUrl, SceneRenderer } from "@shadercanvas/engine";

export interface ShaderCanvasOptions {
  /** DOM element that will host the canvas (canvas is created automatically). */
  container: HTMLElement;
  /** Inline scene object. Provide either scene or sceneUrl. */
  scene?: Scene;
  /** Remote Scene JSON URL. Provide either scene or sceneUrl. */
  sceneUrl?: string;
  /** Start animation loop immediately (default: true). */
  autoplay?: boolean;
}

export interface ShaderCanvasInstance {
  play(): void;
  pause(): void;
  destroy(): void;
  resize(width?: number, height?: number): void;
  setVariable(name: string, value: number | number[]): void;
  getScene(): Scene;
}

/** Lightweight embed SDK for ShaderCanvas scenes. */
export const ShaderCanvas = {
  async create(options: ShaderCanvasOptions): Promise<ShaderCanvasInstance> {
    const { container, scene, sceneUrl, autoplay = true } = options;

    if (!scene && !sceneUrl) {
      throw new Error("ShaderCanvas.create requires scene or sceneUrl");
    }

    const resolvedScene = scene ?? (await loadSceneFromUrl(sceneUrl!));

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const renderer = new SceneRenderer({ canvas, scene: resolvedScene });

    if (!autoplay) {
      renderer.pause();
    }

    const resize = (width?: number, height?: number) => {
      const nextWidth = width ?? container.clientWidth;
      const nextHeight = height ?? container.clientHeight;
      renderer.resize(nextWidth, nextHeight);
    };

    resize();

    return {
      play: () => renderer.play(),
      pause: () => renderer.pause(),
      destroy: () => {
        renderer.dispose();
        canvas.remove();
      },
      resize,
      setVariable: (name, value) => renderer.setVariable(name, value),
      getScene: () => renderer.getScene(),
    };
  },
};

export { loadScene };
