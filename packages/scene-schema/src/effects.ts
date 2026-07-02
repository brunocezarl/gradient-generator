import type { EffectDefinition } from "./types.js";

/** Built-in effect catalog for Phase 0 (uniform metadata for editor + engine). */
export const EFFECT_DEFINITIONS: Record<string, EffectDefinition> = {
  noise_fill: {
    id: "noise_fill",
    label: "Organic Noise Fill",
    uniforms: {
      complexity: {
        name: "complexity",
        type: "float",
        default: 2,
        min: 1,
        max: 6,
        step: 0.1,
        label: "Complexity",
      },
      noiseScale: {
        name: "noiseScale",
        type: "float",
        default: 2,
        min: 0.5,
        max: 8,
        step: 0.1,
        label: "Noise Scale",
      },
      flowIntensity: {
        name: "flowIntensity",
        type: "float",
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Flow Intensity",
      },
      thresholdMin: {
        name: "thresholdMin",
        type: "float",
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Threshold Min",
      },
      thresholdMax: {
        name: "thresholdMax",
        type: "float",
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Threshold Max",
      },
      color1: {
        name: "color1",
        type: "color",
        default: [0.9, 0.2, 0.3],
        label: "Color 1",
      },
      color2: {
        name: "color2",
        type: "color",
        default: [0.2, 0.4, 0.9],
        label: "Color 2",
      },
      color3: {
        name: "color3",
        type: "color",
        default: [0.5, 0.1, 0.6],
        label: "Color 3",
      },
    },
  },
  gradient: {
    id: "gradient",
    label: "Color Gradient",
    uniforms: {
      angle: {
        name: "angle",
        type: "float",
        default: 45,
        min: 0,
        max: 360,
        step: 1,
        label: "Angle (deg)",
      },
      colorStart: {
        name: "colorStart",
        type: "color",
        default: [0.1, 0.1, 0.2],
        label: "Start Color",
      },
      colorEnd: {
        name: "colorEnd",
        type: "color",
        default: [0.9, 0.5, 0.2],
        label: "End Color",
      },
      mixInput: {
        name: "mixInput",
        type: "float",
        default: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Blend With Input",
      },
    },
  },
  grain: {
    id: "grain",
    label: "Film Grain",
    uniforms: {
      amount: {
        name: "amount",
        type: "float",
        default: 0.08,
        min: 0,
        max: 0.5,
        step: 0.01,
        label: "Amount",
      },
      scale: {
        name: "scale",
        type: "float",
        default: 500,
        min: 50,
        max: 2000,
        step: 10,
        label: "Scale",
      },
    },
  },
};

export const BUILT_IN_EFFECT_IDS = Object.keys(EFFECT_DEFINITIONS);
