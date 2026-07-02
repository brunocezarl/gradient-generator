/** Supported blend modes for Phase 0 compositing. */
export type BlendMode = "normal" | "screen" | "multiply";

/** Uniform value types exposed in the scene JSON and editor UI. */
export type UniformType = "float" | "vec2" | "vec3" | "color";

/** Metadata describing one shader uniform (used by editor sliders). */
export interface UniformMeta {
  name: string;
  type: UniformType;
  default: number | number[];
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

/** Catalog entry for a built-in effect (not a scene instance). */
export interface EffectDefinition {
  id: string;
  label: string;
  uniforms: Record<string, UniformMeta>;
}

/** One effect instance attached to a layer in scene JSON. */
export interface EffectInstance {
  id: string;
  enabled: boolean;
  uniforms: Record<string, number | number[]>;
}

/** Layer visibility, opacity, and compositing. */
export interface LayerTransform {
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
}

/** Optional spatial transform for image layers (normalized canvas space). */
export interface LayerSpatialTransform {
  /** Center position in 0–1 canvas coordinates. */
  position: [number, number];
  /** Uniform scale relative to cover-fit sizing. */
  scale: number;
  /** Rotation in degrees. */
  rotation: number;
}

/** Optional performance hints for future optimization passes. */
export interface LayerPerformance {
  quality?: "low" | "medium" | "high";
  frameSkip?: number;
}

/** Flat solid-color base layer. */
export interface SolidLayer {
  id: string;
  type: "solid";
  color: [number, number, number, number];
  transform: LayerTransform;
  effects: EffectInstance[];
  performance?: LayerPerformance;
}

/** Generative layer built from chained shader effects. */
export interface ShaderLayer {
  id: string;
  type: "shader";
  transform: LayerTransform;
  effects: EffectInstance[];
  performance?: LayerPerformance;
}

/** Bitmap layer loaded from a URL, blob URL, or data URL. */
export interface ImageLayer {
  id: string;
  type: "image";
  /** Image source — local blob/data URL or remote URL (POC: no CDN pipeline). */
  src: string;
  transform: LayerTransform & Partial<LayerSpatialTransform>;
  effects: EffectInstance[];
  performance?: LayerPerformance;
}

export type Layer = SolidLayer | ShaderLayer | ImageLayer;

/** Built-in runtime signals that can drive uniform values. */
export type InteractionSource = "mouse.x" | "mouse.y" | "time";

/** Maps a layer uniform to a mouse/time signal (additive modulation). */
export interface InteractionMapping {
  layerId: string;
  /** Index of the effect in the layer's effects array. */
  effectIndex: number;
  uniform: string;
  source: InteractionSource;
  /** Multiplier applied to the source before adding to the base uniform. */
  scale?: number;
  /** Constant offset added after scale * source. */
  offset?: number;
  enabled?: boolean;
}

/** Explicit binding from a named runtime variable to a specific uniform. */
export interface VariableBinding {
  variable: string;
  layerId: string;
  effectIndex: number;
  uniform: string;
}

/** Canvas output dimensions and optional clear color. */
export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor?: [number, number, number, number];
}

/** Top-level Scene JSON document (PRD model, Phase 0 subset). */
export interface Scene {
  version: string;
  canvas: CanvasConfig;
  layers: Layer[];
  /** Named variables that can be driven at runtime via the SDK. */
  variables?: Record<string, number | number[]>;
  /** Optional explicit variable → uniform bindings (overrides name matching). */
  variableBindings?: VariableBinding[];
  /** Optional mouse/time → uniform modulation rules. */
  interactions?: InteractionMapping[];
}
