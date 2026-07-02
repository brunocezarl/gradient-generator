import { SCENE_VERSION } from "./version.js";
import type { ValidationResult } from "./validation.js";

/** Turn raw validator messages into designer-friendly explanations. */
function humanizeError(error: string, input: unknown): string {
  const scene = input && typeof input === "object" ? (input as Record<string, unknown>) : null;

  if (error === "version must be a string" || error.startsWith("version is required")) {
    const got = scene?.version;
    const gotType = got === null ? "null" : Array.isArray(got) ? "array" : typeof got;
    const gotPreview =
      got === undefined ? "missing" : JSON.stringify(got);
    return `version must be the text "${SCENE_VERSION}" (in quotes), not a number or other type. Found: ${gotPreview} (${gotType}).`;
  }

  if (error.startsWith("Unsupported scene version")) {
    return `${error}. Save a fresh scene from the editor to get the correct version string.`;
  }

  if (error === "Scene must be an object") {
    return "The JSON root must be an object { … }, not a bare array or plain value.";
  }

  if (error === "layers must be an array") {
    return "layers must be an array of layer objects, e.g. \"layers\": [ { \"id\": \"bg\", … } ].";
  }

  if (error === "layers must contain at least one layer") {
    return "Add at least one layer inside the layers array.";
  }

  if (error === "canvas must be an object") {
    return "canvas must be an object with width and height, e.g. \"canvas\": { \"width\": 1280, \"height\": 720 }.";
  }

  return error;
}

const EXPECTED_SHAPE = `Expected scene JSON shape (ShaderCanvas ${SCENE_VERSION}):

{
  "version": "${SCENE_VERSION}",
  "canvas": { "width": 1280, "height": 720 },
  "layers": [
    {
      "id": "my-layer",
      "type": "shader",
      "transform": { "opacity": 1, "blendMode": "normal", "visible": true },
      "effects": []
    }
  ]
}`;

/** Format validation failures for alerts / UI copy aimed at non-developers. */
export function formatSceneValidationErrors(
  result: ValidationResult,
  input?: unknown,
): string {
  if (result.valid) return "";

  const lines = [
    "Couldn't load this scene file.",
    "",
    "Problems found:",
    ...result.errors.map((err) => `• ${humanizeError(err, input)}`),
    "",
    EXPECTED_SHAPE,
    "",
    "Tip: use Save JSON in the editor to export a valid file, then edit that copy.",
  ];

  return lines.join("\n");
}

/** Shorter single-line summary for inline UI. */
export function summarizeSceneValidationErrors(
  result: ValidationResult,
  input?: unknown,
): string {
  if (result.valid) return "";
  const first = result.errors[0];
  if (!first) return "Invalid scene JSON.";
  return humanizeError(first, input);
}
