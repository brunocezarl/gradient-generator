import { linearToSrgb, srgbToLinear, type RgbTriplet } from "@/lib/color"

// Motor de cor em OKLCH.
//
// Oklab (Björn Ottosson) é perceptualmente uniforme: distâncias iguais no
// espaço correspondem a diferenças visuais parecidas. Em coordenadas
// cilíndricas (OKLCH) isso vira exatamente o vocabulário de quem escolhe cor —
// luminosidade, croma e matiz —, o que permite gerar harmonias e variações que
// se parecem intencionais em vez de sorteadas.

export interface Oklch {
  /** Luminosidade perceptual, 0 (preto) a 1 (branco) */
  l: number
  /** Croma (saturação perceptual). sRGB comporta ~0.37 no máximo */
  c: number
  /** Matiz em graus, 0-360 */
  h: number
}

// ─── Conversões ──────────────────────────────────────────────────────────────

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
  // Cinzas não têm matiz definido; 0 é uma escolha estável para round-trip
  const h = c < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

// Converte sem verificar gamut: o resultado pode ter canais fora de 0-1
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

// Reduz o croma até a cor caber no sRGB, preservando luminosidade e matiz.
//
// É o comportamento que um designer espera de um "clarear/saturar": a cor perde
// intensidade, não vira outra cor. Simplesmente saturar os canais RGB desloca o
// matiz — um vermelho muito saturado viraria laranja.
export function clampChromaToGamut(oklch: Oklch): Oklch {
  const l = Math.min(Math.max(oklch.l, 0), 1)
  const base = { ...oklch, l }

  if (isInSrgbGamut(oklchToLinear(base))) return base

  let low = 0
  let high = base.c
  // 20 passos levam a precisão bem abaixo de 1/255
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

/** Croma máximo que a dupla luminosidade/matiz comporta em sRGB */
export function maxChroma(l: number, h: number): number {
  return clampChromaToGamut({ l, c: 0.5, h }).c
}

// ─── Contraste (WCAG 2.1) ────────────────────────────────────────────────────

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

export type ContrastLevel = "AAA" | "AA" | "AA Large" | "Insuficiente"

// Limiares WCAG 2.1 para texto sobre o fundo
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return "AAA"
  if (ratio >= 4.5) return "AA"
  if (ratio >= 3) return "AA Large"
  return "Insuficiente"
}

// Pior caso de contraste ao longo de um gradiente: o texto precisa funcionar
// sobre *todas* as cores por onde passa, não sobre a média
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

// ─── Harmonias ───────────────────────────────────────────────────────────────

export type HarmonyKind =
  | "analogous"
  | "complementary"
  | "splitComplementary"
  | "triadic"
  | "monochromatic"

export const harmonyLabels: Record<HarmonyKind, string> = {
  analogous: "Análoga",
  complementary: "Complementar",
  splitComplementary: "Complementar dividida",
  triadic: "Tríade",
  monochromatic: "Monocromática",
}

// Deslocamentos de matiz por harmonia, em graus
const HARMONY_HUE_OFFSETS: Record<HarmonyKind, number[]> = {
  analogous: [0, 30, -30, 60, -60, 90, -90, 120],
  complementary: [0, 180, 20, 200, -20, 160, 40, 220],
  splitComplementary: [0, 150, 210, 30, 180, -30, 120, 240],
  triadic: [0, 120, 240, 60, 180, 300, 30, 210],
  monochromatic: [0, 0, 0, 0, 0, 0, 0, 0],
}

export interface HarmonyOptions {
  count: number
  /** Variação de luminosidade entre as paradas (0 = todas iguais) */
  lightnessSpread?: number
  /** Variação de croma entre as paradas */
  chromaSpread?: number
}

// Gera uma paleta derivada de uma cor base mantendo a relação de matiz da
// harmonia escolhida. A luminosidade varia de propósito: uma paleta com todas
// as paradas na mesma luminosidade some no gradiente.
export function generateHarmony(
  base: Oklch,
  kind: HarmonyKind,
  { count, lightnessSpread = 0.22, chromaSpread = 0.04 }: HarmonyOptions
): Oklch[] {
  const stops = Math.min(Math.max(Math.round(count), 2), 8)
  const offsets = HARMONY_HUE_OFFSETS[kind] ?? HARMONY_HUE_OFFSETS.analogous

  return Array.from({ length: stops }, (_, index) => {
    // Distribui a luminosidade em torno da base, alternando acima e abaixo
    const t = stops === 1 ? 0 : index / (stops - 1) - 0.5
    const l = Math.min(Math.max(base.l + t * lightnessSpread * 2, 0.12), 0.95)
    const c = Math.max(base.c + (index % 2 === 0 ? chromaSpread : -chromaSpread), 0.01)
    const h = (base.h + offsets[index % offsets.length] + 360) % 360
    return clampChromaToGamut({ l, c, h })
  })
}

// ─── Sorteio estético ────────────────────────────────────────────────────────

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

// Paleta aleatória mas plausível.
//
// Sortear R, G e B independentemente (o que o randomizador fazia) cai quase
// sempre em cores dessaturadas e sem relação entre si — visualmente, lama. Aqui
// o sorteio acontece nos eixos que importam: um matiz base, uma harmonia, e
// faixas de luminosidade e croma que costumam funcionar.
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
