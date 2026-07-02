export { SCENE_VERSION } from "./version.js";
export { EFFECT_DEFINITIONS, BUILT_IN_EFFECT_IDS } from "./effects.js";
export { createEffectInstance } from "./scene-helpers.js";
export { validateScene } from "./validation.js";
export type { ValidationResult } from "./validation.js";
export {
  formatSceneValidationErrors,
  summarizeSceneValidationErrors,
} from "./format-validation-errors.js";
export type {
  BlendMode,
  CanvasConfig,
  EffectDefinition,
  EffectInstance,
  ImageLayer,
  InteractionMapping,
  InteractionSource,
  Layer,
  LayerPerformance,
  LayerSpatialTransform,
  LayerTransform,
  Scene,
  ShaderLayer,
  SolidLayer,
  UniformMeta,
  UniformType,
  VariableBinding,
} from "./types.js";
