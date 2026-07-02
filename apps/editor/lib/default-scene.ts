import { SCENE_VERSION } from "@shadercanvas/scene-schema";
import type { Scene } from "@shadercanvas/scene-schema";

/** Starter scene shipped with the Phase 0 editor. */
export function createDefaultScene(): Scene {
  return {
    version: SCENE_VERSION,
    canvas: {
      width: 1280,
      height: 720,
      backgroundColor: [0.04, 0.04, 0.06, 1],
    },
    layers: [
      {
        id: "layer_shader_1",
        type: "shader",
        transform: { opacity: 1, blendMode: "normal", visible: true },
        effects: [
          {
            id: "noise_fill",
            enabled: true,
            uniforms: {
              complexity: 3,
              noiseScale: 2.2,
              flowIntensity: 0.3,
              thresholdMin: 0.28,
              thresholdMax: 0.72,
              color1: [0.92, 0.18, 0.34],
              color2: [0.12, 0.38, 0.92],
              color3: [0.52, 0.08, 0.72],
            },
          },
          {
            id: "grain",
            enabled: true,
            uniforms: { amount: 0.05, scale: 550 },
          },
        ],
      },
      {
        id: "layer_solid_1",
        type: "solid",
        color: [0.95, 0.4, 0.2, 0.15],
        transform: { opacity: 0.35, blendMode: "screen", visible: true },
        effects: [
          {
            id: "gradient",
            enabled: true,
            uniforms: {
              angle: 120,
              colorStart: [1, 0.5, 0.2],
              colorEnd: [0.2, 0.1, 0.5],
              mixInput: 0.4,
            },
          },
        ],
      },
    ],
    variables: {
      flowIntensity: 0.3,
    },
    interactions: [
      {
        layerId: "layer_shader_1",
        effectIndex: 0,
        uniform: "noiseScale",
        source: "mouse.x",
        scale: 2,
        enabled: true,
      },
    ],
  };
}
