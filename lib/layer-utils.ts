"use client"

import type { CSSProperties } from "react"

// Uma camada do gradiente.
//
// A camada controla a *forma* (escala de ruído, fluxo, limiares) e a cor; o
// movimento (play/pause, velocidade, complexidade) e o acabamento (grão,
// vibrância, espaço de mistura) vêm do estado global, para que a composição
// inteira se mova junta e tenha o mesmo tratamento de cor.
export interface GradientLayer {
  id: string
  opacity: number
  blendMode: string
  visible: boolean
  colorScheme: string
  customColors?: {
    color1: number[]
    color2: number[]
    color3: number[]
  }
  isCustomMode: boolean
  noiseScale: number
  flowIntensity: number
  thresholdMin: number
  thresholdMax: number
  // Deslocamento no campo de ruído: sem isso, duas camadas com os mesmos
  // parâmetros desenham exatamente a mesma forma e a composição não soma nada
  seed: [number, number]
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
export function blendModeToCSS(mode: string): CSSProperties["mixBlendMode"] {
  const cssMap: Record<string, CSSProperties["mixBlendMode"]> = {
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

// Create a new layer with default settings.
// O seed padrão [0, 0] faz a primeira camada coincidir com a cena simples —
// ligar o modo multi-camadas não muda a imagem.
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

// Seed aleatório para uma nova camada, garantindo formas distintas
export function generateSeed(): [number, number] {
  return [Math.random() * 100, Math.random() * 100]
}
