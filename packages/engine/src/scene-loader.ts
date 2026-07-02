import type { Scene } from "@shadercanvas/scene-schema";
import { formatSceneValidationErrors, validateScene } from "@shadercanvas/scene-schema";

/** Parse and validate scene JSON from a string or object. */
export function loadScene(source: string | Scene): Scene {
  let scene: Scene;
  try {
    scene = typeof source === "string" ? (JSON.parse(source) as Scene) : source;
  } catch {
    throw new Error("Invalid JSON — could not parse scene file.");
  }

  const result = validateScene(scene);
  if (!result.valid) {
    throw new Error(formatSceneValidationErrors(result, scene));
  }
  return scene;
}

/** Fetch scene JSON from a URL (used by runtime SDK embed). */
export async function loadSceneFromUrl(url: string): Promise<Scene> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load scene from ${url}: ${response.statusText}`);
  }
  const json = (await response.json()) as Scene;
  return loadScene(json);
}
