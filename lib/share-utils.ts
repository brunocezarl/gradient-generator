"use client"

import { GradientStore } from "@/lib/store"
import type { GradientLayer } from "@/lib/layer-utils"
import { stopsFromColors, type ColorStop } from "@/lib/color-stops"

// Shareable layer: a GradientLayer without the id (ids are regenerated on import
// so they cannot collide with layers already in the destination client)
export type ShareableLayer = Omit<GradientLayer, "id">

// Define the shape of shareable data
export interface ShareableGradient {
  speed: number
  complexity: number
  noiseScale: number
  colorScheme: string
  isCustomMode: boolean
  // Three-color format (v1/v2), kept only for reading old links
  customColors?: {
    color1: number[]
    color2: number[]
    color3?: number[]
  }
  // Stops with positions (v3)
  stops?: ColorStop[]
  // Advanced parameters (v2) — optional, for compatibility with old links
  flowIntensity?: number
  grainAmount?: number
  grainScale?: number
  thresholdMin?: number
  thresholdMax?: number
  // Multi-layer (v2)
  multiLayerMode?: boolean
  layers?: ShareableLayer[]
  // Color and shape (v3): without the seed, opening a link reproduced the colors
  // and the rhythm but drew a different shape
  vibrance?: number
  // Tone (v3): exposure in stops, brightness and contrast on Oklab lightness
  exposure?: number
  brightness?: number
  contrast?: number
  // Post-processing (v3)
  effect?: string
  bloomThreshold?: number
  bloomIntensity?: number
  bloomRadius?: number
  blendSpace?: string
  seed?: [number, number]
  loopDuration?: number
}

// ─── Compact encoding ─────────────────────────────────────────────────────────
// The v2 format uses short keys + base64url instead of raw JSON in the query
// string, producing much shorter URLs that survive being pasted into chats.
// The v1 format (?gradient=<url-encoded JSON>) is still readable.

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
  h: 0 | 1 // visible (inverted hidden flag)
  cs: string // colorScheme
  cm: 0 | 1 // isCustomMode
  k1?: number[] // customColors.color1 (reading v2 links)
  k2?: number[]
  k3?: number[]
  st?: number[][] // stops: [r, g, b, position]
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
  k1?: number[] // customColors.color1 (reading v2 links)
  k2?: number[]
  k3?: number[]
  st?: number[][] // stops: [r, g, b, position]
  f?: number // flowIntensity
  ga?: number // grainAmount
  gs?: number // grainScale
  tn?: number // thresholdMin
  tx?: number // thresholdMax
  ml?: 0 | 1 // multiLayerMode
  ly?: PackedLayer[]
  vb?: number // vibrance
  ex?: number // exposure
  br?: number // brightness
  ct?: number // contrast
  ef?: string // effect
  bt?: number // bloomThreshold
  bi?: number // bloomIntensity
  brd?: number // bloomRadius
  bs?: string // blendSpace
  sd?: number[] // seed
  ld?: number // loopDuration
}

function pack(data: ShareableGradient): PackedGradient {
  const packed: PackedGradient = {
    v: 3,
    s: round3(data.speed),
    c: data.complexity,
    n: round3(data.noiseScale),
    cs: data.colorScheme,
    cm: data.isCustomMode ? 1 : 0,
    // Stops with positions. v2 and earlier carried k1/k2/k3 — reading still
    // accepts that format, writing no longer uses it.
    st: (data.stops ?? []).map((stop) => [...roundColor(stop.color), round3(stop.position)]),
  }

  if (data.flowIntensity !== undefined) packed.f = round3(data.flowIntensity)
  if (data.grainAmount !== undefined) packed.ga = round3(data.grainAmount)
  if (data.grainScale !== undefined) packed.gs = round3(data.grainScale)
  if (data.thresholdMin !== undefined) packed.tn = round3(data.thresholdMin)
  if (data.thresholdMax !== undefined) packed.tx = round3(data.thresholdMax)
  if (data.vibrance !== undefined) packed.vb = round3(data.vibrance)
  if (data.exposure !== undefined) packed.ex = round3(data.exposure)
  if (data.brightness !== undefined) packed.br = round3(data.brightness)
  if (data.contrast !== undefined) packed.ct = round3(data.contrast)
  // Only a chain that is actually on travels: a link to a plain gradient should
  // not carry three bloom numbers nobody will read
  if (data.effect !== undefined && data.effect !== "none") {
    packed.ef = data.effect
    if (data.bloomThreshold !== undefined) packed.bt = round3(data.bloomThreshold)
    if (data.bloomIntensity !== undefined) packed.bi = round3(data.bloomIntensity)
    if (data.bloomRadius !== undefined) packed.brd = round3(data.bloomRadius)
  }
  if (data.blendSpace !== undefined) packed.bs = data.blendSpace
  if (data.seed !== undefined) packed.sd = data.seed.map(round3)
  if (data.loopDuration !== undefined) packed.ld = round3(data.loopDuration)

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
      if (layer.customStops) {
        pl.st = layer.customStops.map((stop) => [
          ...roundColor(stop.color),
          round3(stop.position),
        ])
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
  }

  if (packed.st !== undefined) {
    data.stops = packed.st.map((stop) => ({
      color: [stop[0] ?? 0, stop[1] ?? 0, stop[2] ?? 0],
      position: stop[3] ?? 0,
    }))
  } else if (packed.k1 && packed.k2) {
    // v2 link: three colors without positions
    data.customColors = { color1: packed.k1, color2: packed.k2, color3: packed.k3 }
  }

  if (packed.f !== undefined) data.flowIntensity = packed.f
  if (packed.ga !== undefined) data.grainAmount = packed.ga
  if (packed.gs !== undefined) data.grainScale = packed.gs
  if (packed.tn !== undefined) data.thresholdMin = packed.tn
  if (packed.tx !== undefined) data.thresholdMax = packed.tx
  if (packed.vb !== undefined) data.vibrance = packed.vb
  if (packed.ex !== undefined) data.exposure = packed.ex
  if (packed.br !== undefined) data.brightness = packed.br
  if (packed.ct !== undefined) data.contrast = packed.ct
  if (packed.ef !== undefined) data.effect = packed.ef
  if (packed.bt !== undefined) data.bloomThreshold = packed.bt
  if (packed.bi !== undefined) data.bloomIntensity = packed.bi
  if (packed.brd !== undefined) data.bloomRadius = packed.brd
  if (packed.bs !== undefined) data.blendSpace = packed.bs
  if (packed.sd !== undefined && packed.sd.length >= 2)
    data.seed = [packed.sd[0], packed.sd[1]]
  if (packed.ld !== undefined) data.loopDuration = packed.ld

  if (packed.ml === 1 && Array.isArray(packed.ly)) {
    data.multiLayerMode = true
    data.layers = packed.ly.map((pl) => ({
      opacity: pl.o,
      blendMode: pl.b,
      visible: pl.h === 1,
      colorScheme: pl.cs,
      isCustomMode: pl.cm === 1,
      customStops: pl.st
        ? pl.st.map((stop) => ({
            color: [stop[0] ?? 0, stop[1] ?? 0, stop[2] ?? 0] as [number, number, number],
            position: stop[3] ?? 0,
          }))
        : pl.k1 && pl.k2
          ? stopsFromColors([pl.k1, pl.k2, pl.k3 ?? pl.k2])
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
  // Extract only the properties we want to share.
  // `??` rather than `||`: legitimate numeric values such as 0 must not fall
  // through to the default (0 || 1.0 === 1.0 would corrupt the share)
  const shareableData: ShareableGradient = {
    speed: state.speed ?? 1.0,
    complexity: state.complexity ?? 3,
    noiseScale: state.noiseScale ?? 2.0,
    colorScheme: state.colorScheme || "redBlue",
    isCustomMode: state.isCustomMode ?? false,
    stops: state.customStops ?? stopsFromColors([
      [0.9, 0.1, 0.1],
      [0.0, 0.0, 0.9],
      [0.5, 0.0, 0.5],
    ]),
    flowIntensity: state.flowIntensity ?? 0.3,
    grainAmount: state.grainAmount ?? 0.05,
    grainScale: state.grainScale ?? 500.0,
    thresholdMin: state.thresholdMin ?? 0.3,
    thresholdMax: state.thresholdMax ?? 0.7,
    vibrance: state.vibrance ?? 0,
    exposure: state.exposure ?? 0,
    brightness: state.brightness ?? 0,
    contrast: state.contrast ?? 1,
    effect: state.effect ?? "none",
    bloomThreshold: state.bloomThreshold ?? 0.8,
    bloomIntensity: state.bloomIntensity ?? 0.8,
    bloomRadius: state.bloomRadius ?? 1,
    blendSpace: state.blendSpace ?? "oklab",
    seed: state.seed ?? [0, 0],
    loopDuration: state.loopDuration ?? 0,
  }

  // Layers only go into the link when multi-layer mode is on — that
  // keeps the link shorter in the common single-layer case
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
