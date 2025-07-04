"use client"

// Define a gradient layer
export interface GradientLayer {
  id: string
  opacity: number
  blendMode: string
  visible: boolean
  colorScheme: string
  customColors?: {
    color1: number[]
    color2: number[]
  }
  isCustomMode: boolean
  noiseScale: number
  flowIntensity: number
  thresholdMin: number
  thresholdMax: number
}

// Available blend modes
export const blendModes = {
  normal: "Normal",
  multiply: "Multiplicar",
  screen: "Tela",
  overlay: "Sobreposição",
  darken: "Escurecer",
  lighten: "Clarear",
  colorDodge: "Subexposição de Cor",
  colorBurn: "Superexposição de Cor",
  hardLight: "Luz Forte",
  softLight: "Luz Suave",
  difference: "Diferença",
  exclusion: "Exclusão",
}

// Convert blend mode to CSS mix-blend-mode
export function blendModeToCSS(mode: string): string {
  const cssMap: Record<string, string> = {
    normal: "normal",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
    darken: "darken",
    lighten: "lighten",
    colorDodge: "color-dodge",
    colorBurn: "color-burn",
    hardLight: "hard-light",
    softLight: "soft-light",
    difference: "difference",
    exclusion: "exclusion",
  }
  
  return cssMap[mode] || "normal"
}

// Create a new layer with default settings
export function createDefaultLayer(id: string): GradientLayer {
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
  }
}

// Generate a unique ID for a new layer
export function generateLayerId(): string {
  return `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}
