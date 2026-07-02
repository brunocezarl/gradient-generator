"use client";

import { useMemo } from "react";
import {
  EFFECT_DEFINITIONS,
  type Scene,
  type VariableBinding,
} from "@shadercanvas/scene-schema";
import { getVariableBinding, setVariableBinding } from "@/lib/scene-helpers";

interface VariableBindingsPanelProps {
  scene: Scene;
  selectedLayerId: string | null;
  selectedEffectIndex: number;
  onUpdateScene: (scene: Scene) => void;
}

/** Bind scene variables to specific layer / effect / uniform targets. */
export function VariableBindingsPanel({
  scene,
  selectedLayerId,
  selectedEffectIndex,
  onUpdateScene,
}: VariableBindingsPanelProps) {
  const variableNames = Object.keys(scene.variables ?? {});
  const bindings = scene.variableBindings ?? [];

  const uniformOptions = useMemo(() => {
    if (!selectedLayerId) return [];
    const layer = scene.layers.find((item) => item.id === selectedLayerId);
    if (!layer) return [];

    const effect = layer.effects[selectedEffectIndex] ?? layer.effects[0];
    if (!effect) return [];

    const definition = EFFECT_DEFINITIONS[effect.id];
    if (!definition) return [];

    return Object.keys(definition.uniforms).map((uniform) => ({
      layerId: layer.id,
      effectIndex: selectedEffectIndex,
      uniform,
      label: definition.uniforms[uniform]?.label ?? uniform,
    }));
  }, [scene.layers, selectedLayerId, selectedEffectIndex]);

  const addBinding = () => {
    const target = uniformOptions[0];
    if (!target || variableNames.length === 0) return;

    const binding: VariableBinding = {
      variable: variableNames[0]!,
      layerId: target.layerId,
      effectIndex: target.effectIndex,
      uniform: target.uniform,
    };

    onUpdateScene(setVariableBinding(scene, binding, target));
  };

  const updateBinding = (index: number, next: Partial<VariableBinding>) => {
    const current = bindings[index];
    if (!current) return;

    const merged = { ...current, ...next };
    const withoutOld = bindings.filter((_, i) => i !== index);
    const deduped = withoutOld.filter(
      (item) =>
        !(
          item.layerId === merged.layerId &&
          item.effectIndex === merged.effectIndex &&
          item.uniform === merged.uniform
        ),
    );

    onUpdateScene({
      ...scene,
      variableBindings: [...deduped, merged],
    });
  };

  const removeBinding = (index: number) => {
    const current = bindings[index];
    if (!current) return;
    onUpdateScene(
      setVariableBinding(scene, null, {
        layerId: current.layerId,
        effectIndex: current.effectIndex,
        uniform: current.uniform,
      }),
    );
  };

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Variable bindings
        </h2>
        <button
          type="button"
          onClick={addBinding}
          disabled={variableNames.length === 0 || uniformOptions.length === 0}
          className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-zinc-500 disabled:opacity-40"
        >
          + Bind
        </button>
      </div>
      <p className="text-xs text-zinc-600">
        Explicit bindings override name matching. Pick a variable, layer target, and uniform.
      </p>

      {variableNames.length === 0 && (
        <p className="text-xs text-amber-500/80">Add a variable first (Variables panel).</p>
      )}

      {bindings.length === 0 ? (
        <p className="text-xs text-zinc-600">No bindings yet.</p>
      ) : (
        <ul className="space-y-2">
          {bindings.map((binding, index) => {
            const layer = scene.layers.find((item) => item.id === binding.layerId);
            const effect = layer?.effects[binding.effectIndex];
            const uniformLabel =
              effect && EFFECT_DEFINITIONS[effect.id]?.uniforms[binding.uniform]?.label;

            return (
              <li
                key={`${binding.layerId}-${binding.effectIndex}-${binding.uniform}-${index}`}
                className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-violet-300">{binding.variable}</span>
                  <button
                    type="button"
                    onClick={() => removeBinding(index)}
                    className="text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <label className="block space-y-1">
                  <span className="text-zinc-500">Variable</span>
                  <select
                    value={binding.variable}
                    onChange={(event) => updateBinding(index, { variable: event.target.value })}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                  >
                    {variableNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-zinc-500">Layer</span>
                  <select
                    value={binding.layerId}
                    onChange={(event) => updateBinding(index, { layerId: event.target.value })}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                  >
                    {scene.layers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-zinc-500">Effect #</span>
                    <select
                      value={binding.effectIndex}
                      onChange={(event) =>
                        updateBinding(index, { effectIndex: Number(event.target.value) })
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                    >
                      {(layer?.effects ?? []).map((item, effectIndex) => (
                        <option key={`${item.id}-${effectIndex}`} value={effectIndex}>
                          {effectIndex}: {EFFECT_DEFINITIONS[item.id]?.label ?? item.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-zinc-500">Uniform</span>
                    <select
                      value={binding.uniform}
                      onChange={(event) => updateBinding(index, { uniform: event.target.value })}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                    >
                      {layer &&
                        layer.effects[binding.effectIndex] &&
                        Object.keys(
                          EFFECT_DEFINITIONS[layer.effects[binding.effectIndex]!.id]?.uniforms ?? {},
                        ).map((uniform) => (
                          <option key={uniform} value={uniform}>
                            {EFFECT_DEFINITIONS[layer.effects[binding.effectIndex]!.id]?.uniforms[
                              uniform
                            ]?.label ?? uniform}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                {uniformLabel && (
                  <p className="text-[11px] text-zinc-600">
                    Current target: {layer?.id} → effect {binding.effectIndex} → {uniformLabel}
                  </p>
                )}

                {getVariableBinding(scene, binding.layerId, binding.effectIndex, binding.uniform)
                  ?.variable === binding.variable && (
                  <p className="text-[11px] text-emerald-500/80">Active binding</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
