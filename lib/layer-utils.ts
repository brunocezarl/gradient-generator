"use client"

import type { ColorStop } from "@/lib/color-stops"

// A gradient layer.
//
// A layer owns *shape* (noise scale, flow, thresholds) and color; motion
// (play/pause, speed, complexity) and finishing (grain, vibrance, blend space)
// come from global state, so the whole composition moves together and gets the
// same color treatment.
export interface GradientLayer {
  id: string
  opacity: number
  blendMode: string
  visible: boolean
  colorScheme: string
  customStops?: ColorStop[]
  isCustomMode: boolean
  noiseScale: number
  flowIntensity: number
  thresholdMin: number
  thresholdMax: number
  // Offset into the noise field: without it, two layers with the same
  // parameters draw the exact same shape and the composition adds nothing
  seed: [number, number]
}

// Available blend modes
export const blendModes = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  darken: "Darken",
  lighten: "Lighten",
  colorDodge: "Color Dodge",
  colorBurn: "Color Burn",
  hardLight: "Hard Light",
  softLight: "Soft Light",
  difference: "Difference",
  exclusion: "Exclusion",
}

// Create a new layer with default settings.
// The default seed [0, 0] makes the first layer match the single-layer scene —
// turning multi-layer mode on does not change the image.
export function createDefaultLayer(
  id: string,
  seed: [number, number] = [0, 0]
): GradientLayer {
  return {
    id,
    opacity: 1.0,
    blendMode: "normal",
    visible: true,
    colorScheme: "redBlue",
    isCustomMode: false,
    noiseScale: 2.0,
    flowIntensity: 0.3,
    thresholdMin: 0.3,
    thresholdMax: 0.7,
    seed,
  }
}

// Generate a unique ID for a new layer
export function generateLayerId(): string {
  return `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// Random seed for a new layer, so shapes stay distinct
export function generateSeed(): [number, number] {
  return [Math.random() * 100, Math.random() * 100]
}
