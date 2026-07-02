import { EFFECT_DEFINITIONS } from "./effects.js";
import type { EffectInstance } from "./types.js";

/** Create a new effect instance with catalog defaults for all uniforms. */
export function createEffectInstance(effectId: string, enabled = true): EffectInstance {
  const definition = EFFECT_DEFINITIONS[effectId];
  if (!definition) {
    throw new Error(`Unknown effect id "${effectId}"`);
  }

  const uniforms: Record<string, number | number[]> = {};
  for (const [key, meta] of Object.entries(definition.uniforms)) {
    uniforms[key] = Array.isArray(meta.default) ? [...meta.default] : meta.default;
  }

  return { id: effectId, enabled, uniforms };
}
