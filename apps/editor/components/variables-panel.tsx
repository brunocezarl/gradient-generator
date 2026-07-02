"use client";

import type { Scene } from "@shadercanvas/scene-schema";

interface VariablesPanelProps {
  scene: Scene;
  onUpdateScene: (scene: Scene) => void;
}

/** Simple runtime variable editor for testing setVariable() behavior. */
export function VariablesPanel({ scene, onUpdateScene }: VariablesPanelProps) {
  const variables = scene.variables ?? {};
  const entries = Object.entries(variables);

  const updateVariable = (name: string, value: number) => {
    onUpdateScene({
      ...scene,
      variables: { ...variables, [name]: value },
    });
  };

  const addVariable = () => {
    const name = `var_${entries.length + 1}`;
    onUpdateScene({
      ...scene,
      variables: { ...variables, [name]: 0.5 },
    });
  };

  const removeVariable = (name: string) => {
    const next = { ...variables };
    delete next[name];
    onUpdateScene({ ...scene, variables: next });
  };

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Variables</h2>
        <button
          type="button"
          onClick={addVariable}
          className="rounded border border-zinc-700 px-2 py-1 text-xs hover:border-zinc-500"
        >
          + Add
        </button>
      </div>
      <p className="text-xs text-zinc-600">
        Variables drive uniforms by name, or use Variable bindings below for explicit targets.
      </p>

      {entries.length === 0 ? (
        <p className="text-xs text-zinc-600">No variables defined.</p>
      ) : (
        entries.map(([name, value]) => {
          const numeric = typeof value === "number" ? value : 0;
          return (
            <div key={name} className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-violet-300">{name}</span>
                <button
                  type="button"
                  onClick={() => removeVariable(name)}
                  className="text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
              {typeof value === "number" ? (
                <label className="block space-y-1 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Value</span>
                    <span>{numeric.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={numeric}
                    onChange={(event) => updateVariable(name, Number(event.target.value))}
                    className="w-full accent-violet-500"
                  />
                </label>
              ) : (
                <p className="text-xs text-zinc-500">Array values not editable in POC UI.</p>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
