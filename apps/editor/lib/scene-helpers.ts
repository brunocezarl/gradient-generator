import {
  BUILT_IN_EFFECT_IDS,
  createEffectInstance,
  type EffectInstance,
  type ImageLayer,
  type Layer,
  type Scene,
  type ShaderLayer,
  type SolidLayer,
  type VariableBinding,
} from "@shadercanvas/scene-schema";

let layerCounter = 100;

/** Generate a unique layer id for newly added layers. */
export function createLayerId(prefix: string): string {
  layerCounter += 1;
  return `${prefix}_${layerCounter}`;
}

export function createShaderLayer(): ShaderLayer {
  return {
    id: createLayerId("layer_shader"),
    type: "shader",
    transform: { opacity: 1, blendMode: "normal", visible: true },
    effects: [createEffectInstance("noise_fill")],
  };
}

export function createSolidLayer(): SolidLayer {
  return {
    id: createLayerId("layer_solid"),
    type: "solid",
    color: [0.2, 0.2, 0.25, 1],
    transform: { opacity: 1, blendMode: "normal", visible: true },
    effects: [],
  };
}

export function createImageLayer(src = ""): ImageLayer {
  return {
    id: createLayerId("layer_image"),
    type: "image",
    src,
    transform: {
      opacity: 1,
      blendMode: "normal",
      visible: true,
      position: [0.5, 0.5],
      scale: 0.6,
      rotation: 0,
    },
    effects: [],
  };
}

/** Read a local image file as a data URL for POC asset storage. */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Upsert or remove an interaction mapping for one uniform. */
export function setInteractionMapping(
  scene: Scene,
  layerId: string,
  effectIndex: number,
  uniform: string,
  source: "mouse.x" | "mouse.y" | "time" | null,
  scale = 1,
): Scene {
  const interactions = [...(scene.interactions ?? [])].filter(
    (item) =>
      !(
        item.layerId === layerId &&
        item.effectIndex === effectIndex &&
        item.uniform === uniform
      ),
  );

  if (source) {
    interactions.push({
      layerId,
      effectIndex,
      uniform,
      source,
      scale,
      enabled: true,
    });
  }

  return { ...scene, interactions };
}

export function getInteractionMapping(
  scene: Scene,
  layerId: string,
  effectIndex: number,
  uniform: string,
) {
  return scene.interactions?.find(
    (item) =>
      item.layerId === layerId &&
      item.effectIndex === effectIndex &&
      item.uniform === uniform,
  );
}

export function reorderEffects(layer: Layer, fromIndex: number, toIndex: number): Layer {
  const effects = [...layer.effects];
  if (toIndex < 0 || toIndex >= effects.length) return layer;
  const [moved] = effects.splice(fromIndex, 1);
  if (!moved) return layer;
  effects.splice(toIndex, 0, moved);
  return { ...layer, effects };
}

/** Upsert or remove an explicit variable → uniform binding. */
export function setVariableBinding(
  scene: Scene,
  binding: VariableBinding | null,
  target: Pick<VariableBinding, "layerId" | "effectIndex" | "uniform">,
): Scene {
  const bindings = [...(scene.variableBindings ?? [])].filter(
    (item) =>
      !(
        item.layerId === target.layerId &&
        item.effectIndex === target.effectIndex &&
        item.uniform === target.uniform
      ),
  );

  if (binding) {
    bindings.push(binding);
  }

  return { ...scene, variableBindings: bindings.length > 0 ? bindings : undefined };
}

export function getVariableBinding(
  scene: Scene,
  layerId: string,
  effectIndex: number,
  uniform: string,
): VariableBinding | undefined {
  return scene.variableBindings?.find(
    (item) =>
      item.layerId === layerId &&
      item.effectIndex === effectIndex &&
      item.uniform === uniform,
  );
}

/** Deep-clone effect instances so presets don't share object references. */
export function cloneEffects(effects: EffectInstance[]): EffectInstance[] {
  return effects.map((effect) => ({
    ...effect,
    uniforms: { ...effect.uniforms },
  }));
}
