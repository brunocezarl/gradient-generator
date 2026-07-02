import type { BlendMode } from "@shadercanvas/scene-schema";

/** Blend mode IDs supported by the compositor shader. */
export const BLEND_MODE_INDEX: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
};
