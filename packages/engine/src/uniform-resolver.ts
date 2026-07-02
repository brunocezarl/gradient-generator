import { EFFECT_DEFINITIONS } from "@shadercanvas/scene-schema";
import type { EffectInstance, InteractionSource, Layer, Scene } from "@shadercanvas/scene-schema";

/** Built-in runtime inputs passed to the uniform resolver each frame. */
export interface RuntimeInputs {
  time: number;
  /** Normalized pointer position in canvas space (0–1). */
  mouse: [number, number];
}

function getInteractionSourceValue(source: InteractionSource, runtime: RuntimeInputs): number {
  switch (source) {
    case "mouse.x":
      return runtime.mouse[0];
    case "mouse.y":
      return runtime.mouse[1];
    case "time":
      return runtime.time;
  }
}

function findExplicitBinding(
  scene: Scene,
  layerId: string,
  effectIndex: number,
  uniformName: string,
): string | null {
  const binding = scene.variableBindings?.find(
    (item) =>
      item.layerId === layerId &&
      item.effectIndex === effectIndex &&
      item.uniform === uniformName,
  );
  return binding?.variable ?? null;
}

function findInteraction(
  scene: Scene,
  layerId: string,
  effectIndex: number,
  uniformName: string,
) {
  return scene.interactions?.find(
    (item) =>
      item.layerId === layerId &&
      item.effectIndex === effectIndex &&
      item.uniform === uniformName &&
      item.enabled !== false,
  );
}

/** Resolve one uniform value with variables + interaction mappings applied. */
export function resolveUniformValue(
  scene: Scene,
  layer: Layer,
  effectIndex: number,
  effectInstance: EffectInstance,
  uniformName: string,
  defaultValue: number | number[],
  runtime: RuntimeInputs,
  variables: Record<string, number | number[]>,
): number | number[] {
  let value = effectInstance.uniforms[uniformName] ?? defaultValue;

  // Explicit binding takes priority over name matching.
  const boundVariable = findExplicitBinding(scene, layer.id, effectIndex, uniformName);
  if (boundVariable && variables[boundVariable] !== undefined) {
    value = variables[boundVariable];
  } else if (variables[uniformName] !== undefined) {
    // Fallback: variable name matches uniform name.
    value = variables[uniformName];
  }

  const interaction = findInteraction(scene, layer.id, effectIndex, uniformName);
  if (interaction && typeof value === "number") {
    const sourceValue = getInteractionSourceValue(interaction.source, runtime);
    const scale = interaction.scale ?? 1;
    const offset = interaction.offset ?? 0;
    value = value + sourceValue * scale + offset;
  }

  return value;
}

/** Resolve all uniforms for one effect instance (used by effect implementations). */
export function resolveEffectUniforms(
  scene: Scene,
  layer: Layer,
  effectIndex: number,
  effectInstance: EffectInstance,
  runtime: RuntimeInputs,
  variables: Record<string, number | number[]>,
): Record<string, number | number[]> {
  const definition = EFFECT_DEFINITIONS[effectInstance.id];
  if (!definition) return { ...effectInstance.uniforms };

  const resolved: Record<string, number | number[]> = {};
  for (const [key, meta] of Object.entries(definition.uniforms)) {
    resolved[key] = resolveUniformValue(
      scene,
      layer,
      effectIndex,
      effectInstance,
      key,
      meta.default,
      runtime,
      variables,
    );
  }
  return resolved;
}
