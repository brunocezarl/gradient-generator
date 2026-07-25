"use client"

import { GradientStore } from "@/lib/store"
import type { GradientLayer } from "@/lib/layer-utils"

// Camada compartilhável: uma GradientLayer sem o id (ids são regenerados na
// importação para não colidir com camadas existentes no cliente de destino)
export type ShareableLayer = Omit<GradientLayer, "id">

// Define the shape of shareable data
export interface ShareableGradient {
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: string
  isCustomMode: boolean
  customColors: {
    color1: number[]
    color2: number[]
    color3?: number[]
  }
  // Parâmetros avançados (v2) — opcionais para compatibilidade com links antigos
  flowIntensity?: number
  grainAmount?: number
  grainScale?: number
  thresholdMin?: number
  thresholdMax?: number
  // Multi-camadas (v2)
  multiLayerMode?: boolean
  layers?: ShareableLayer[]
  // Cor e forma (v3): sem o seed, abrir um link reproduzia as cores e o ritmo
  // mas desenhava outra forma
  vibrance?: number
  blendSpace?: string
  seed?: [number, number]
}

// ─── Codificação compacta ─────────────────────────────────────────────────────
// O formato v2 usa chaves curtas + base64url em vez de JSON puro na query
// string, produzindo URLs bem mais curtas e fáceis de colar em chats.
// O formato v1 (?gradient=<JSON url-encoded>) continua suportado na leitura.

const round3 = (n: number) => Math.round(n * 1000) / 1000
const roundColor = (c: number[]) => c.slice(0, 3).map(round3)

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

type PackedLayer = {
  o: number // opacity
  b: string // blendMode
  h: 0 | 1 // visible (hidden flag invertido)
  cs: string // colorScheme
  cm: 0 | 1 // isCustomMode
  k1?: number[] // customColors.color1
  k2?: number[] // customColors.color2
  k3?: number[] // customColors.color3
  n: number // noiseScale
  f: number // flowIntensity
  tn: number // thresholdMin
  tx: number // thresholdMax
  sd?: number[] // seed
}

type PackedGradient = {
  v: 2 | 3
  s: number // speed
  c: number // complexity
  n: number // noiseScale
  cs: string // colorScheme
  cm: 0 | 1 // isCustomMode
  k1: number[] // customColors.color1
  k2: number[]
  k3: number[]
  f?: number // flowIntensity
  ga?: number // grainAmount
  gs?: number // grainScale
  tn?: number // thresholdMin
  tx?: number // thresholdMax
  ml?: 0 | 1 // multiLayerMode
  ly?: PackedLayer[]
  vb?: number // vibrance
  bs?: string // blendSpace
  sd?: number[] // seed
}

function pack(data: ShareableGradient): PackedGradient {
  const packed: PackedGradient = {
    v: 3,
    s: round3(data.speed),
    c: data.complexity,
    n: round3(data.noiseScale),
    cs: data.colorScheme,
    cm: data.isCustomMode ? 1 : 0,
    k1: roundColor(data.customColors.color1),
    k2: roundColor(data.customColors.color2),
    k3: roundColor(data.customColors.color3 ?? [0.5, 0.0, 0.5]),
  }

  if (data.flowIntensity !== undefined) packed.f = round3(data.flowIntensity)
  if (data.grainAmount !== undefined) packed.ga = round3(data.grainAmount)
  if (data.grainScale !== undefined) packed.gs = round3(data.grainScale)
  if (data.thresholdMin !== undefined) packed.tn = round3(data.thresholdMin)
  if (data.thresholdMax !== undefined) packed.tx = round3(data.thresholdMax)
  if (data.vibrance !== undefined) packed.vb = round3(data.vibrance)
  if (data.blendSpace !== undefined) packed.bs = data.blendSpace
  if (data.seed !== undefined) packed.sd = data.seed.map(round3)

  if (data.multiLayerMode && data.layers && data.layers.length > 0) {
    packed.ml = 1
    packed.ly = data.layers.map((layer) => {
      const pl: PackedLayer = {
        o: round3(layer.opacity),
        b: layer.blendMode,
        h: layer.visible ? 1 : 0,
        cs: layer.colorScheme,
        cm: layer.isCustomMode ? 1 : 0,
        n: round3(layer.noiseScale),
        f: round3(layer.flowIntensity),
        tn: round3(layer.thresholdMin),
        tx: round3(layer.thresholdMax),
      }
      if (layer.customColors) {
        pl.k1 = roundColor(layer.customColors.color1)
        pl.k2 = roundColor(layer.customColors.color2)
        pl.k3 = roundColor(layer.customColors.color3)
      }
      if (layer.seed) pl.sd = layer.seed.map(round3)
      return pl
    })
  }

  return packed
}

function unpack(packed: PackedGradient): ShareableGradient {
  const data: ShareableGradient = {
    speed: packed.s,
    complexity: packed.c,
    noiseScale: packed.n,
    colorScheme: packed.cs,
    isCustomMode: packed.cm === 1,
    customColors: {
      color1: packed.k1,
      color2: packed.k2,
      color3: packed.k3,
    },
  }

  if (packed.f !== undefined) data.flowIntensity = packed.f
  if (packed.ga !== undefined) data.grainAmount = packed.ga
  if (packed.gs !== undefined) data.grainScale = packed.gs
  if (packed.tn !== undefined) data.thresholdMin = packed.tn
  if (packed.tx !== undefined) data.thresholdMax = packed.tx
  if (packed.vb !== undefined) data.vibrance = packed.vb
  if (packed.bs !== undefined) data.blendSpace = packed.bs
  if (packed.sd !== undefined && packed.sd.length >= 2)
    data.seed = [packed.sd[0], packed.sd[1]]

  if (packed.ml === 1 && Array.isArray(packed.ly)) {
    data.multiLayerMode = true
    data.layers = packed.ly.map((pl) => ({
      opacity: pl.o,
      blendMode: pl.b,
      visible: pl.h === 1,
      colorScheme: pl.cs,
      isCustomMode: pl.cm === 1,
      customColors:
        pl.k1 && pl.k2
          ? { color1: pl.k1, color2: pl.k2, color3: pl.k3 ?? pl.k2 }
          : undefined,
      noiseScale: pl.n,
      flowIntensity: pl.f,
      thresholdMin: pl.tn,
      thresholdMax: pl.tx,
      seed:
        pl.sd && pl.sd.length >= 2 ? ([pl.sd[0], pl.sd[1]] as [number, number]) : [0, 0],
    }))
  }

  return data
}

// Create a shareable URL for the current gradient settings
export function createShareableURL(state: Partial<GradientStore>): string {
  // Extract only the properties we want to share
  // `??` em vez de `||`: valores numéricos legítimos como 0 não devem cair
  // no padrão (0 || 1.0 === 1.0 corromperia o compartilhamento)
  const shareableData: ShareableGradient = {
    speed: state.speed ?? 1.0,
    complexity: state.complexity ?? 3,
    noiseScale: state.noiseScale ?? 2.0,
    colorScheme: state.colorScheme || "redBlue",
    isCustomMode: state.isCustomMode ?? false,
    customColors: state.customColors ?? {
      color1: [0.9, 0.1, 0.1],
      color2: [0.0, 0.0, 0.9],
      color3: [0.5, 0.0, 0.5],
    },
    flowIntensity: state.flowIntensity ?? 0.3,
    grainAmount: state.grainAmount ?? 0.05,
    grainScale: state.grainScale ?? 500.0,
    thresholdMin: state.thresholdMin ?? 0.3,
    thresholdMax: state.thresholdMax ?? 0.7,
    vibrance: state.vibrance ?? 0,
    blendSpace: state.blendSpace ?? "oklab",
    seed: state.seed ?? [0, 0],
  }

  // Camadas só entram no link quando o modo multi-camadas está ativo — o
  // link fica mais curto no caso comum de camada única
  if (state.multiLayerMode && state.layers && state.layers.length > 0) {
    shareableData.multiLayerMode = true
    shareableData.layers = state.layers.map(({ id: _id, ...layer }) => layer)
  }

  const encodedData = toBase64Url(JSON.stringify(pack(shareableData)))

  return `${window.location.origin}${window.location.pathname}?g=${encodedData}`
}

// Parse a shareable URL to extract gradient settings.
// Suporta o formato v2 (?g=<base64url>) e o legado v1 (?gradient=<JSON>).
export function parseShareableURL(url: string): ShareableGradient | null {
  try {
    const urlObj = new URL(url)

    const compactData = urlObj.searchParams.get("g")
    if (compactData) {
      const packed = JSON.parse(fromBase64Url(compactData)) as PackedGradient
      return unpack(packed)
    }

    const legacyData = urlObj.searchParams.get("gradient")
    if (legacyData) {
      return JSON.parse(decodeURIComponent(legacyData)) as ShareableGradient
    }

    return null
  } catch (error) {
    console.error("Error parsing shareable URL:", error)
    return null
  }
}
