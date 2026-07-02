"use client";

import {
  EFFECT_DEFINITIONS,
  type EffectInstance,
  type Layer,
  type Scene,
  type UniformMeta,
} from "@shadercanvas/scene-schema";
import { EffectList } from "@/components/effect-list";
import { useAuth } from "@/lib/auth-context";
import { getInteractionMapping, readImageFileAsDataUrl, setInteractionMapping } from "@/lib/scene-helpers";

interface PropertyPanelProps {
  scene: Scene;
  selectedLayerId: string | null;
  selectedEffectIndex: number;
  onSelectEffect: (index: number) => void;
  onUpdateScene: (scene: Scene) => void;
}

/** Layer transform, effect uniforms, image controls, and interaction mappings. */
export function PropertyPanel({
  scene,
  selectedLayerId,
  selectedEffectIndex,
  onSelectEffect,
  onUpdateScene,
}: PropertyPanelProps) {
  const layer = scene.layers.find((item) => item.id === selectedLayerId);

  if (!layer) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-500">
        Select a layer to edit properties.
      </section>
    );
  }

  const updateLayer = (nextLayer: Layer) => {
    onUpdateScene({
      ...scene,
      layers: scene.layers.map((item) => (item.id === layer.id ? nextLayer : item)),
    });
  };

  const selectedEffect = layer.effects[selectedEffectIndex] ?? layer.effects[0];

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Properties</h2>

      <SliderField
        label="Opacity"
        value={layer.transform.opacity}
        min={0}
        max={1}
        step={0.01}
        onChange={(value) =>
          updateLayer({
            ...layer,
            transform: { ...layer.transform, opacity: value },
          })
        }
      />

      <SelectField
        label="Blend mode"
        value={layer.transform.blendMode}
        options={[
          { value: "normal", label: "Normal" },
          { value: "screen", label: "Screen" },
          { value: "multiply", label: "Multiply" },
        ]}
        onChange={(value) =>
          updateLayer({
            ...layer,
            transform: {
              ...layer.transform,
              blendMode: value as Layer["transform"]["blendMode"],
            },
          })
        }
      />

      {layer.type === "solid" && (
        <SliderField
          label="Solid alpha"
          value={layer.color[3] ?? 1}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) =>
            updateLayer({
              ...layer,
              color: [layer.color[0], layer.color[1], layer.color[2], value],
            })
          }
        />
      )}

      {layer.type === "image" && (
        <ImageLayerFields layer={layer} onChange={updateLayer} />
      )}

      <EffectList
        scene={scene}
        layer={layer}
        selectedEffectIndex={selectedEffectIndex}
        onSelectEffect={onSelectEffect}
        onUpdateScene={onUpdateScene}
      />

      {selectedEffect && (
        <EffectUniforms
          scene={scene}
          layerId={layer.id}
          effectIndex={selectedEffectIndex}
          effect={selectedEffect}
          onChange={(nextEffect) =>
            updateLayer({
              ...layer,
              effects: layer.effects.map((item, index) =>
                index === selectedEffectIndex ? nextEffect : item,
              ),
            })
          }
          onInteractionChange={(uniform, source, scale) =>
            onUpdateScene(
              setInteractionMapping(scene, layer.id, selectedEffectIndex, uniform, source, scale),
            )
          }
        />
      )}
    </section>
  );
}

function ImageLayerFields({
  layer,
  onChange,
}: {
  layer: Extract<Layer, { type: "image" }>;
  onChange: (layer: Layer) => void;
}) {
  const { uploadAsset } = useAuth();

  const uploadImage = async (file: File) => {
    // Try cloud storage first when signed in; fall back to inline data URL.
    const cloudUrl = await uploadAsset(file);
    if (cloudUrl) {
      onChange({ ...layer, src: cloudUrl });
      return;
    }
    const dataUrl = await readImageFileAsDataUrl(file);
    onChange({ ...layer, src: dataUrl });
  };

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Image</p>
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-300">Source URL</span>
        <input
          type="text"
          value={layer.src}
          placeholder="https://… or paste data URL"
          onChange={(event) => onChange({ ...layer, src: event.target.value })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs"
        />
      </label>
      <label className="inline-block cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs hover:border-zinc-500">
        Upload image
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadImage(file);
            event.target.value = "";
          }}
        />
      </label>

      <SliderField
        label="Position X"
        value={layer.transform.position?.[0] ?? 0.5}
        min={0}
        max={1}
        step={0.01}
        onChange={(value) =>
          onChange({
            ...layer,
            transform: {
              ...layer.transform,
              position: [value, layer.transform.position?.[1] ?? 0.5],
            },
          })
        }
      />
      <SliderField
        label="Position Y"
        value={layer.transform.position?.[1] ?? 0.5}
        min={0}
        max={1}
        step={0.01}
        onChange={(value) =>
          onChange({
            ...layer,
            transform: {
              ...layer.transform,
              position: [layer.transform.position?.[0] ?? 0.5, value],
            },
          })
        }
      />
      <SliderField
        label="Scale"
        value={layer.transform.scale ?? 1}
        min={0.1}
        max={2}
        step={0.01}
        onChange={(value) =>
          onChange({
            ...layer,
            transform: { ...layer.transform, scale: value },
          })
        }
      />
      <SliderField
        label="Rotation (deg)"
        value={layer.transform.rotation ?? 0}
        min={-180}
        max={180}
        step={1}
        onChange={(value) =>
          onChange({
            ...layer,
            transform: { ...layer.transform, rotation: value },
          })
        }
      />
    </div>
  );
}

function EffectUniforms({
  scene,
  layerId,
  effectIndex,
  effect,
  onChange,
  onInteractionChange,
}: {
  scene: Scene;
  layerId: string;
  effectIndex: number;
  effect: EffectInstance;
  onChange: (effect: EffectInstance) => void;
  onInteractionChange: (
    uniform: string,
    source: "mouse.x" | "mouse.y" | "time" | null,
    scale: number,
  ) => void;
}) {
  const definition = EFFECT_DEFINITIONS[effect.id];
  if (!definition) return null;

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {definition.label} uniforms
      </p>
      {Object.entries(definition.uniforms).map(([key, meta]) => (
        <UniformField
          key={key}
          meta={meta}
          value={
            (effect.uniforms[key] as number | number[] | undefined) ??
            meta.default
          }
          interaction={getInteractionMapping(scene, layerId, effectIndex, key)}
          onChange={(nextValue) =>
            onChange({
              ...effect,
              uniforms: { ...effect.uniforms, [key]: nextValue },
            })
          }
          onInteractionChange={(source, scale) => onInteractionChange(key, source, scale)}
        />
      ))}
    </div>
  );
}

function UniformField({
  meta,
  value,
  interaction,
  onChange,
  onInteractionChange,
}: {
  meta: UniformMeta;
  value: number | number[];
  interaction?: ReturnType<typeof getInteractionMapping>;
  onChange: (value: number | number[]) => void;
  onInteractionChange: (source: "mouse.x" | "mouse.y" | "time" | null, scale: number) => void;
}) {
  if (meta.type === "float" && typeof value === "number") {
    return (
      <div className="space-y-1">
        <SliderField
          label={meta.label ?? meta.name}
          value={value}
          min={meta.min ?? 0}
          max={meta.max ?? 1}
          step={meta.step ?? 0.01}
          onChange={onChange}
        />
        <InteractionControls
          interaction={interaction}
          onChange={onInteractionChange}
        />
      </div>
    );
  }

  if ((meta.type === "color" || meta.type === "vec3") && Array.isArray(value)) {
    const hex = rgbToHex(value[0], value[1], value[2]);
    return (
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-zinc-300">{meta.label ?? meta.name}</span>
        <input
          type="color"
          value={hex}
          onChange={(event) => {
            const rgb = hexToRgb(event.target.value);
            onChange([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]);
          }}
          className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
        />
      </label>
    );
  }

  return null;
}

function InteractionControls({
  interaction,
  onChange,
}: {
  interaction?: ReturnType<typeof getInteractionMapping>;
  onChange: (source: "mouse.x" | "mouse.y" | "time" | null, scale: number) => void;
}) {
  const source = interaction?.source ?? "";
  const scale = interaction?.scale ?? 1;

  return (
    <div className="flex flex-wrap items-center gap-2 pl-1 text-[11px] text-zinc-500">
      <span>React to</span>
      <select
        value={source}
        onChange={(event) => {
          const next = event.target.value as "mouse.x" | "mouse.y" | "time" | "";
          onChange(next || null, scale);
        }}
        className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5"
      >
        <option value="">None</option>
        <option value="mouse.x">Mouse X</option>
        <option value="mouse.y">Mouse Y</option>
        <option value="time">Time</option>
      </select>
      {source && (
        <>
          <span>×</span>
          <input
            type="number"
            step={0.1}
            value={scale}
            onChange={(event) =>
              onChange(source as "mouse.x" | "mouse.y" | "time", Number(event.target.value))
            }
            className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5"
          />
        </>
      )}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <div className="flex items-center justify-between text-zinc-300">
        <span>{label}</span>
        <span className="text-xs text-zinc-500">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-violet-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, channel * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}
