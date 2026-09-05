import type { StateSnapshot } from "@/lib/store"
import { stopsFromColors } from "@/lib/color-stops"

// Complete looks: applying one never inherits an effect or layer from the last edit.
const base: StateSnapshot = {
  speed: 0.5, complexity: 2, noiseScale: 0.8, colorScheme: "redBlue",
  isCustomMode: true, customStops: [], flowIntensity: 0.3,
  grainAmount: 0.025, grainScale: 780, thresholdMin: 0.3, thresholdMax: 0.7,
  vibrance: 0, exposure: 0, brightness: 0, contrast: 1, effect: "none",
  bloomThreshold: 0.6, bloomIntensity: 0.8, bloomRadius: 1,
  asciiColumns: 80, asciiBackground: 0.12, asciiRampContrast: 2.5,
  blendSpace: "oklab", seed: [12, 28], loopDuration: 8,
  multiLayerMode: false, layers: [],
}

export const curatedPresets: { id: string; name: string; snapshot: StateSnapshot }[] = [
  { id: "look-tidal", name: "Tidal", snapshot: { ...base,
    customStops: stopsFromColors([[0.02, 0.12, 0.28], [0.06, 0.62, 0.64], [0.78, 0.94, 0.85]]),
    seed: [18, 42], flowIntensity: 0.45 } },
  { id: "look-ember", name: "Ember", snapshot: { ...base,
    customStops: stopsFromColors([[0.18, 0.02, 0.12], [0.95, 0.2, 0.08], [1, 0.77, 0.4]]),
    effect: "bloom", bloomIntensity: 0.45, seed: [64, 12] } },
  { id: "look-silk", name: "Silk", snapshot: { ...base,
    customStops: stopsFromColors([[0.28, 0.23, 0.48], [0.77, 0.65, 0.86], [0.98, 0.88, 0.79]]),
    speed: 0.25, noiseScale: 0.6, grainAmount: 0.015, seed: [8, 91] } },
  { id: "look-terminal", name: "Terminal", snapshot: { ...base,
    customStops: stopsFromColors([[0.01, 0.08, 0.05], [0.12, 0.68, 0.38], [0.8, 1, 0.58]]),
    effect: "ascii", asciiColumns: 100, complexity: 3, seed: [72, 31] } },
]
