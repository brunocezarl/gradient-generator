import { linearToSrgb, srgbToLinear, type RgbTriplet } from "@/lib/color"

// OKLCH color engine.
//
// Oklab (Björn Ottosson) is perceptually uniform: equal distances in the space
// correspond to similar visual differences. In cylindrical coordinates (OKLCH)
// that becomes exactly the vocabulary of someone choosing color — lightness,
// chroma and hue — which is what lets us generate harmonies and variations that
// look intentional instead of drawn from a hat.

export interface Oklch {
  /** Perceptual lightness, 0 (black) to 1 (white) */
  l: number
  /** Chroma (perceptual saturation). sRGB tops out around 0.37 */
  c: number
  /** Hue in degrees, 0-360 */
  h: number
}

// ─── Conversions ─────────────────────────────────────────────────────────────

export function linearToOklab(rgb: readonly number[]): RgbTriplet {
  const [r, g, b] = [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0]

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function oklabToLinear(lab: readonly number[]): RgbTriplet {
  const [L, a, b] = [lab[0] ?? 0, lab[1] ?? 0, lab[2] ?? 0]

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function srgbToOklch(color: readonly number[]): Oklch {
  const [L, a, b] = linearToOklab([
    srgbToLinear(color[0] ?? 0),
    srgbToLinear(color[1] ?? 0),
    srgbToLinear(color[2] ?? 0),
  ])
  const c = Math.hypot(a, b)
  // Grays have no defined hue; 0 is a stable choice for round-tripping
  const h = c < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

// Converts without checking gamut: channels may land outside 0-1
export function oklchToLinear({ l, c, h }: Oklch): RgbTriplet {
  const radians = (h * Math.PI) / 180
  return oklabToLinear([l, c * Math.cos(radians), c * Math.sin(radians)])
}

const GAMUT_EPSILON = 1e-4

export function isInSrgbGamut(linear: readonly number[]): boolean {
  return linear.every(
    (channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON
  )
}

// Reduces chroma until the color fits in sRGB, preserving lightness and hue.
//
// This is what a designer expects from lighten/saturate: the color loses
// intensity, it does not become a different color. Clipping the RGB channels
// instead shifts the hue — an over-saturated red would drift toward orange.
export function clampChromaToGamut(oklch: Oklch): Oklch {
  const l = Math.min(Math.max(oklch.l, 0), 1)
  const base = { ...oklch, l }

  if (isInSrgbGamut(oklchToLinear(base))) return base

  let low = 0
  let high = base.c
  // 20 steps take precision well below 1/255
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2
    if (isInSrgbGamut(oklchToLinear({ ...base, c: mid }))) {
      low = mid
    } else {
      high = mid
    }
  }

  return { ...base, c: low }
}

export function oklchToSrgb(oklch: Oklch): RgbTriplet {
  const linear = oklchToLinear(clampChromaToGamut(oklch))
  return [linearToSrgb(linear[0]), linearToSrgb(linear[1]), linearToSrgb(linear[2])]
}

/** Maximum chroma this lightness/hue pair can hold in sRGB */
export function maxChroma(l: number, h: number): number {
  return clampChromaToGamut({ l, c: 0.5, h }).c
}

// ─── Contrast (WCAG 2.1) ─────────────────────────────────────────────────────

export function relativeLuminance(srgb: readonly number[]): number {
  const [r, g, b] = [
    srgbToLinear(srgb[0] ?? 0),
    srgbToLinear(srgb[1] ?? 0),
    srgbToLinear(srgb[2] ?? 0),
  ]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

export type ContrastLevel = "AAA" | "AA" | "AA Large" | "Fail"

// WCAG 2.1 thresholds for text over the background
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return "AAA"
  if (ratio >= 4.5) return "AA"
  if (ratio >= 3) return "AA Large"
  return "Fail"
}

// Worst-case contrast along a gradient: text has to work over *every* color it
// crosses, not over the average
export function worstContrast(
  colors: readonly number[][],
  text: readonly number[]
): number {
  if (colors.length === 0) return 1
  return colors.reduce(
    (worst, color) => Math.min(worst, contrastRatio(color, text)),
    Number.POSITIVE_INFINITY
  )
}

// ─── Harmonies ───────────────────────────────────────────────────────────────

export type HarmonyKind =
  | "analogous"
  | "complementary"
  | "splitComplementary"
  | "triadic"
  | "monochromatic"

export const harmonyLabels: Record<HarmonyKind, string> = {
  analogous: "Analogous",
  complementary: "Complementary",
  splitComplementary: "Split complementary",
  triadic: "Triadic",
  monochromatic: "Monochromatic",
}

// Hue offsets per harmony, in degrees
const HARMONY_HUE_OFFSETS: Record<HarmonyKind, number[]> = {
  analogous: [0, 30, -30, 60, -60, 90, -90, 120],
  complementary: [0, 180, 20, 200, -20, 160, 40, 220],
  splitComplementary: [0, 150, 210, 30, 180, -30, 120, 240],
  triadic: [0, 120, 240, 60, 180, 300, 30, 210],
  monochromatic: [0, 0, 0, 0, 0, 0, 0, 0],
}

export interface HarmonyOptions {
  count: number
  /** Lightness spread across the stops (0 = all the same) */
  lightnessSpread?: number
  /** Chroma spread across the stops */
  chromaSpread?: number
}

// Builds a palette derived from a base color, keeping the hue relationship of
// the chosen harmony. Lightness varies on purpose: a palette with every stop at
// the same lightness disappears into the gradient.
export function generateHarmony(
  base: Oklch,
  kind: HarmonyKind,
  { count, lightnessSpread = 0.22, chromaSpread = 0.04 }: HarmonyOptions
): Oklch[] {
  const stops = Math.min(Math.max(Math.round(count), 2), 8)
  const offsets = HARMONY_HUE_OFFSETS[kind] ?? HARMONY_HUE_OFFSETS.analogous

  return Array.from({ length: stops }, (_, index) => {
    // Spreads lightness around the base, alternating above and below
    const t = stops === 1 ? 0 : index / (stops - 1) - 0.5
    const l = Math.min(Math.max(base.l + t * lightnessSpread * 2, 0.12), 0.95)
    const c = Math.max(base.c + (index % 2 === 0 ? chromaSpread : -chromaSpread), 0.01)
    const h = (base.h + offsets[index % offsets.length] + 360) % 360
    return clampChromaToGamut({ l, c, h })
  })
}

// ─── Aesthetic randomization ─────────────────────────────────────────────────

const HARMONY_KINDS: HarmonyKind[] = [
  "analogous",
  "complementary",
  "splitComplementary",
  "triadic",
  "monochromatic",
]

export interface RandomPaletteOptions {
  count?: number
  random?: () => number
}

// Random but plausible palette.
//
// Drawing R, G and B independently (what the randomizer used to do) almost
// always lands on desaturated colors with no relationship to each other —
// visually, mud. Here the draw happens on the axes that matter: a base hue, a
// harmony, and lightness/chroma ranges that tend to work.
export function randomPalette({
  count = 3,
  random = Math.random,
}: RandomPaletteOptions = {}): Oklch[] {
  const kind = HARMONY_KINDS[Math.floor(random() * HARMONY_KINDS.length)]
  const hue = random() * 360
  const lightness = 0.45 + random() * 0.3
  const chromaCeiling = maxChroma(lightness, hue)
  const chroma = Math.min(0.08 + random() * 0.16, chromaCeiling)

  return generateHarmony({ l: lightness, c: chroma, h: hue }, kind, {
    count,
    lightnessSpread: 0.14 + random() * 0.2,
    chromaSpread: random() * 0.06,
  })
}
