import { BUILT_IN_EFFECT_IDS, EFFECT_DEFINITIONS } from "./effects.js";
import { SCENE_VERSION } from "./version.js";
import type {
  BlendMode,
  CanvasConfig,
  EffectInstance,
  ImageLayer,
  InteractionMapping,
  Layer,
  Scene,
  VariableBinding,
} from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const BLEND_MODES: BlendMode[] = ["normal", "screen", "multiply"];
const INTERACTION_SOURCES = ["mouse.x", "mouse.y", "time"] as const;

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isColor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every((channel) => isNumber(channel))
  );
}

function validateCanvas(canvas: unknown, errors: string[]): canvas is CanvasConfig {
  if (!canvas || typeof canvas !== "object") {
    errors.push("canvas must be an object");
    return false;
  }

  const c = canvas as CanvasConfig;
  if (!isNumber(c.width) || c.width <= 0) {
    errors.push("canvas.width must be a positive number");
  }
  if (!isNumber(c.height) || c.height <= 0) {
    errors.push("canvas.height must be a positive number");
  }
  if (c.backgroundColor && !isColor(c.backgroundColor)) {
    errors.push("canvas.backgroundColor must be an RGBA array");
  }
  return errors.length === 0;
}

function validateEffect(effect: unknown, path: string, errors: string[]): void {
  if (!effect || typeof effect !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }

  const e = effect as EffectInstance;
  if (typeof e.id !== "string" || !BUILT_IN_EFFECT_IDS.includes(e.id)) {
    errors.push(`${path}.id must be a known effect (${BUILT_IN_EFFECT_IDS.join(", ")})`);
  }
  if (typeof e.enabled !== "boolean") {
    errors.push(`${path}.enabled must be a boolean`);
  }
  if (!e.uniforms || typeof e.uniforms !== "object") {
    errors.push(`${path}.uniforms must be an object`);
    return;
  }

  const definition = EFFECT_DEFINITIONS[e.id];
  if (!definition) return;

  for (const [key, meta] of Object.entries(definition.uniforms)) {
    const value = e.uniforms[key];
    if (value === undefined) continue;
    if (meta.type === "float" && !isNumber(value)) {
      errors.push(`${path}.uniforms.${key} must be a number`);
    }
    if ((meta.type === "color" || meta.type === "vec3") && !isColor(value)) {
      errors.push(`${path}.uniforms.${key} must be a color array`);
    }
  }
}

function validateSpatialTransform(layer: ImageLayer, path: string, errors: string[]): void {
  if (layer.transform.position !== undefined) {
    if (
      !Array.isArray(layer.transform.position) ||
      layer.transform.position.length !== 2 ||
      !layer.transform.position.every(isNumber)
    ) {
      errors.push(`${path}.transform.position must be [number, number]`);
    }
  }
  if (layer.transform.scale !== undefined && !isNumber(layer.transform.scale)) {
    errors.push(`${path}.transform.scale must be a number`);
  }
  if (layer.transform.rotation !== undefined && !isNumber(layer.transform.rotation)) {
    errors.push(`${path}.transform.rotation must be a number`);
  }
}

function validateLayer(layer: unknown, index: number, errors: string[]): layer is Layer {
  const path = `layers[${index}]`;
  if (!layer || typeof layer !== "object") {
    errors.push(`${path} must be an object`);
    return false;
  }

  const l = layer as Layer;
  if (typeof l.id !== "string" || l.id.length === 0) {
    errors.push(`${path}.id must be a non-empty string`);
  }
  if (l.type !== "solid" && l.type !== "shader" && l.type !== "image") {
    errors.push(`${path}.type must be "solid", "shader", or "image"`);
  }

  if (!l.transform || typeof l.transform !== "object") {
    errors.push(`${path}.transform is required`);
  } else {
    if (!isNumber(l.transform.opacity) || l.transform.opacity < 0 || l.transform.opacity > 1) {
      errors.push(`${path}.transform.opacity must be between 0 and 1`);
    }
    if (!BLEND_MODES.includes(l.transform.blendMode)) {
      errors.push(`${path}.transform.blendMode must be one of ${BLEND_MODES.join(", ")}`);
    }
    if (typeof l.transform.visible !== "boolean") {
      errors.push(`${path}.transform.visible must be a boolean`);
    }
  }

  if (l.type === "solid") {
    if (!isColor(l.color) || (l.color.length !== 4 && l.color.length !== 3)) {
      errors.push(`${path}.color must be an RGB or RGBA array`);
    }
  }

  if (l.type === "image") {
    if (typeof l.src !== "string" || l.src.length === 0) {
      errors.push(`${path}.src must be a non-empty string`);
    }
    validateSpatialTransform(l, path, errors);
  }

  if (!Array.isArray(l.effects)) {
    errors.push(`${path}.effects must be an array`);
  } else {
    l.effects.forEach((effect, effectIndex) => {
      validateEffect(effect, `${path}.effects[${effectIndex}]`, errors);
    });
  }

  return errors.length === 0;
}

function validateInteraction(mapping: unknown, index: number, errors: string[]): void {
  const path = `interactions[${index}]`;
  if (!mapping || typeof mapping !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }

  const m = mapping as InteractionMapping;
  if (typeof m.layerId !== "string") errors.push(`${path}.layerId must be a string`);
  if (!isNumber(m.effectIndex) || m.effectIndex < 0) {
    errors.push(`${path}.effectIndex must be a non-negative number`);
  }
  if (typeof m.uniform !== "string") errors.push(`${path}.uniform must be a string`);
  if (!INTERACTION_SOURCES.includes(m.source)) {
    errors.push(`${path}.source must be one of ${INTERACTION_SOURCES.join(", ")}`);
  }
}

function validateVariableBinding(binding: unknown, index: number, errors: string[]): void {
  const path = `variableBindings[${index}]`;
  if (!binding || typeof binding !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }

  const b = binding as VariableBinding;
  if (typeof b.variable !== "string") errors.push(`${path}.variable must be a string`);
  if (typeof b.layerId !== "string") errors.push(`${path}.layerId must be a string`);
  if (!isNumber(b.effectIndex) || b.effectIndex < 0) {
    errors.push(`${path}.effectIndex must be a non-negative number`);
  }
  if (typeof b.uniform !== "string") errors.push(`${path}.uniform must be a string`);
}

/** Basic structural validation for Scene JSON (Phase 0). */
export function validateScene(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Scene must be an object"] };
  }

  const scene = input as Scene;

  if (typeof scene.version !== "string") {
    errors.push(
      scene.version === undefined
        ? "version is required (use a quoted string, e.g. \"1.0.0\")"
        : "version must be a string",
    );
  } else if (scene.version !== SCENE_VERSION) {
    errors.push(`Unsupported scene version "${scene.version}" (expected ${SCENE_VERSION})`);
  }

  validateCanvas(scene.canvas, errors);

  if (!Array.isArray(scene.layers)) {
    errors.push("layers must be an array");
  } else if (scene.layers.length === 0) {
    errors.push("layers must contain at least one layer");
  } else {
    scene.layers.forEach((layer, index) => validateLayer(layer, index, errors));
  }

  if (scene.variables !== undefined) {
    if (typeof scene.variables !== "object" || scene.variables === null) {
      errors.push("variables must be an object when provided");
    }
  }

  if (scene.variableBindings !== undefined) {
    if (!Array.isArray(scene.variableBindings)) {
      errors.push("variableBindings must be an array when provided");
    } else {
      scene.variableBindings.forEach((binding, index) => validateVariableBinding(binding, index, errors));
    }
  }

  if (scene.interactions !== undefined) {
    if (!Array.isArray(scene.interactions)) {
      errors.push("interactions must be an array when provided");
    } else {
      scene.interactions.forEach((mapping, index) => validateInteraction(mapping, index, errors));
    }
  }

  return { valid: errors.length === 0, errors };
}
