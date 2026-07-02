"use client";

import { useState } from "react";
import {
  BUILT_IN_EFFECT_IDS,
  EFFECT_DEFINITIONS,
  createEffectInstance,
  type Layer,
  type Scene,
} from "@shadercanvas/scene-schema";
import { cn } from "@/lib/cn";
import {
  deleteEffectPreset,
  loadEffectPresets,
  saveEffectPreset,
  type EffectPreset,
} from "@/lib/effect-presets";
import { cloneEffects, reorderEffects } from "@/lib/scene-helpers";

interface EffectListProps {
  scene: Scene;
  layer: Layer;
  selectedEffectIndex: number;
  onSelectEffect: (index: number) => void;
  onUpdateScene: (scene: Scene) => void;
}

/** Add, remove, reorder, and select effects on the active layer. */
export function EffectList({
  scene,
  layer,
  selectedEffectIndex,
  onSelectEffect,
  onUpdateScene,
}: EffectListProps) {
  const [presets, setPresets] = useState<EffectPreset[]>(() => loadEffectPresets());
  const [presetName, setPresetName] = useState("");

  const updateLayerEffects = (effects: Layer["effects"]) => {
    onUpdateScene({
      ...scene,
      layers: scene.layers.map((item) =>
        item.id === layer.id ? { ...item, effects } : item,
      ),
    });
  };

  const addEffect = (effectId: string) => {
    const nextEffects = [...layer.effects, createEffectInstance(effectId)];
    updateLayerEffects(nextEffects);
    onSelectEffect(nextEffects.length - 1);
  };

  const removeEffect = (index: number) => {
    const nextEffects = layer.effects.filter((_, i) => i !== index);
    updateLayerEffects(nextEffects);
    onSelectEffect(Math.max(0, Math.min(selectedEffectIndex, nextEffects.length - 1)));
  };

  const moveEffect = (index: number, direction: -1 | 1) => {
    const nextLayer = reorderEffects(layer, index, index + direction);
    updateLayerEffects(nextLayer.effects);
    onSelectEffect(index + direction);
  };

  const savePreset = () => {
    if (layer.effects.length === 0) return;
    const preset = saveEffectPreset(presetName, layer.effects);
    setPresets((current) => [preset, ...current.filter((item) => item.id !== preset.id)]);
    setPresetName("");
  };

  const applyPreset = (preset: EffectPreset) => {
    updateLayerEffects(cloneEffects(preset.effects));
    onSelectEffect(0);
  };

  const removePreset = (id: string) => {
    deleteEffectPreset(id);
    setPresets((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Effects</p>
        <select
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            addEffect(value);
            event.target.value = "";
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
        >
          <option value="">+ Add effect</option>
          {BUILT_IN_EFFECT_IDS.map((id) => (
            <option key={id} value={id}>
              {EFFECT_DEFINITIONS[id]?.label ?? id}
            </option>
          ))}
        </select>
      </div>

      {layer.effects.length === 0 ? (
        <p className="text-xs text-zinc-600">No effects yet — add one above.</p>
      ) : (
        <ul className="space-y-1">
          {layer.effects.map((effect, index) => {
            const definition = EFFECT_DEFINITIONS[effect.id];
            return (
              <li
                key={`${effect.id}-${index}`}
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs",
                  selectedEffectIndex === index
                    ? "border-violet-500/60 bg-violet-500/10"
                    : "border-zinc-800 bg-zinc-900/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectEffect(index)}
                  className="min-w-0 flex-1 truncate text-left text-zinc-200"
                >
                  {definition?.label ?? effect.id}
                  {!effect.enabled && <span className="text-zinc-500"> (off)</span>}
                </button>
                <button
                  type="button"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => moveEffect(index, -1)}
                  className="rounded px-1 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={index === layer.effects.length - 1}
                  onClick={() => moveEffect(index, 1)}
                  className="rounded px-1 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="Toggle enabled"
                  onClick={() => {
                    const next = layer.effects.map((item, i) =>
                      i === index ? { ...item, enabled: !item.enabled } : item,
                    );
                    updateLayerEffects(next);
                  }}
                  className="rounded px-1 text-zinc-400 hover:bg-zinc-800"
                >
                  {effect.enabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => removeEffect(index)}
                  className="rounded px-1 text-red-400 hover:bg-zinc-800"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Effect presets</p>
        <div className="flex gap-1">
          <input
            type="text"
            value={presetName}
            placeholder="Preset name"
            onChange={(event) => setPresetName(event.target.value)}
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={savePreset}
            disabled={layer.effects.length === 0}
            className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-zinc-500 disabled:opacity-40"
          >
            Save stack
          </button>
        </div>
        {presets.length === 0 ? (
          <p className="text-xs text-zinc-600">Saved locally in this browser.</p>
        ) : (
          <ul className="space-y-1">
            {presets.map((preset) => (
              <li
                key={preset.id}
                className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-xs"
              >
                <span className="min-w-0 flex-1 truncate text-zinc-300">{preset.name}</span>
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded px-1 text-violet-300 hover:bg-zinc-800"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => removePreset(preset.id)}
                  className="rounded px-1 text-red-400 hover:bg-zinc-800"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
