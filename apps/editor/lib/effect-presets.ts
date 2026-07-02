import type { EffectInstance } from "@shadercanvas/scene-schema";

const STORAGE_KEY = "shadercanvas-effect-presets";

export interface EffectPreset {
  id: string;
  name: string;
  effects: EffectInstance[];
  savedAt: string;
}

/** Read saved effect stacks from localStorage (browser only). */
export function loadEffectPresets(): EffectPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EffectPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistPresets(presets: EffectPreset[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/** Save a named copy of the current layer effect stack. */
export function saveEffectPreset(name: string, effects: EffectInstance[]): EffectPreset {
  const preset: EffectPreset = {
    id: `preset_${Date.now()}`,
    name: name.trim() || "Untitled preset",
    effects: effects.map((effect) => ({
      ...effect,
      uniforms: { ...effect.uniforms },
    })),
    savedAt: new Date().toISOString(),
  };

  const presets = loadEffectPresets();
  presets.unshift(preset);
  persistPresets(presets);
  return preset;
}

export function deleteEffectPreset(id: string): void {
  persistPresets(loadEffectPresets().filter((item) => item.id !== id));
}
