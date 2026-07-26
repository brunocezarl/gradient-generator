import { srgbTripletToLinear, linearTripletToSrgb, type RgbTriplet } from "@/lib/color"
import { linearToOklab, oklabToLinear } from "@/lib/oklch"
import { MAX_COLOR_STOPS } from "@/lib/shaders/organic-gradient"

// Color stops with positions.
//
// The gradient used to have exactly three colors pinned at 0, 0.5 and 1 — which
// forces the designer to accept the generator's distribution instead of
// composing their own. Here there are 2 to 8 stops, each with its own position.

export interface ColorStop {
  /** Color in sRGB 0-1 */
  color: RgbTriplet
  /** Position in 0-1 along the gradient */
  position: number
}

export const MIN_STOPS = 2
export const MAX_STOPS = MAX_COLOR_STOPS

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function evenlySpacedPositions(count: number): number[] {
  if (count <= 1) return [0]
  return Array.from({ length: count }, (_, index) => index / (count - 1))
}

/** Builds evenly spaced stops from a list of colors */
export function stopsFromColors(
  colors: readonly (readonly number[])[],
  positions?: readonly number[]
): ColorStop[] {
  const spaced = positions ?? evenlySpacedPositions(colors.length)
  return colors.map((color, index) => ({
    color: [clamp01(color[0] ?? 0), clamp01(color[1] ?? 0), clamp01(color[2] ?? 0)],
    position: clamp01(spaced[index] ?? index / Math.max(colors.length - 1, 1)),
  }))
}

/**
 * Validates and sorts stops coming from outside (localStorage, shared link,
 * library file). Always returns something renderable: the shader needs ascending
 * positions, and fewer than two stops is not a gradient.
 */
export function normalizeStops(input: unknown, fallback: ColorStop[]): ColorStop[] {
  if (!Array.isArray(input)) return fallback.map((stop) => ({ ...stop }))

  const valid = input
    .filter(
      (stop): stop is { color: number[]; position: unknown } =>
        !!stop &&
        typeof stop === "object" &&
        Array.isArray((stop as { color?: unknown }).color) &&
        (stop as { color: unknown[] }).color.length >= 3 &&
        (stop as { color: unknown[] }).color.slice(0, 3).every(isFiniteNumber)
    )
    .slice(0, MAX_STOPS)
    .map((stop, index, all) => ({
      color: [
        clamp01(stop.color[0]),
        clamp01(stop.color[1]),
        clamp01(stop.color[2]),
      ] as RgbTriplet,
      position: isFiniteNumber(stop.position)
        ? clamp01(stop.position)
        : index / Math.max(all.length - 1, 1),
    }))

  if (valid.length < MIN_STOPS) return fallback.map((stop) => ({ ...stop }))

  return sortStops(valid)
}

export function sortStops(stops: readonly ColorStop[]): ColorStop[] {
  return [...stops].sort((a, b) => a.position - b.position)
}

/** Interpolates in Oklab: the middle between two stops does not darken */
export function mixStopColors(a: RgbTriplet, b: RgbTriplet, t: number): RgbTriplet {
  const labA = linearToOklab(srgbTripletToLinear(a))
  const labB = linearToOklab(srgbTripletToLinear(b))
  const mixed = oklabToLinear([
    labA[0] + (labB[0] - labA[0]) * t,
    labA[1] + (labB[1] - labA[1]) * t,
    labA[2] + (labB[2] - labA[2]) * t,
  ])
  const srgb = linearTripletToSrgb(mixed)
  return [clamp01(srgb[0]), clamp01(srgb[1]), clamp01(srgb[2])]
}

/**
 * Adds a stop in the largest gap between existing stops, using the color that
 * was already there — the new stop does not change how the gradient looks, it
 * just gives control over that point.
 */
export function insertStop(stops: readonly ColorStop[]): ColorStop[] {
  if (stops.length >= MAX_STOPS) return stops.map((stop) => ({ ...stop }))
  const sorted = sortStops(stops)

  let gapIndex = 0
  let gapSize = -1
  for (let index = 0; index < sorted.length - 1; index++) {
    const size = sorted[index + 1].position - sorted[index].position
    if (size > gapSize) {
      gapSize = size
      gapIndex = index
    }
  }

  const before = sorted[gapIndex]
  const after = sorted[gapIndex + 1] ?? sorted[gapIndex]
  const position = (before.position + after.position) / 2
  const color =
    before === after ? [...before.color] : mixStopColors(before.color, after.color, 0.5)

  return sortStops([...sorted, { color: color as RgbTriplet, position }])
}

export function removeStopAt(stops: readonly ColorStop[], index: number): ColorStop[] {
  if (stops.length <= MIN_STOPS) return stops.map((stop) => ({ ...stop }))
  return stops.filter((_, i) => i !== index).map((stop) => ({ ...stop }))
}

export function updateStopColor(
  stops: readonly ColorStop[],
  index: number,
  color: RgbTriplet
): ColorStop[] {
  return stops.map((stop, i) =>
    i === index
      ? { ...stop, color: [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])] }
      : { ...stop }
  )
}

/**
 * Moves a stop. The list is not re-sorted during the drag: re-sorting mid-gesture
 * would make the slider jump to a different stop under the user's cursor.
 */
export function updateStopPosition(
  stops: readonly ColorStop[],
  index: number,
  position: number
): ColorStop[] {
  return stops.map((stop, i) =>
    i === index ? { ...stop, position: clamp01(position) } : { ...stop }
  )
}

export function cloneStops(stops: readonly ColorStop[]): ColorStop[] {
  return stops.map((stop) => ({ color: [...stop.color] as RgbTriplet, position: stop.position }))
}

// ─── Compatibility with the 3-color format ───────────────────────────────────

export interface LegacyColorScheme {
  color1?: number[]
  color2?: number[]
  color3?: number[]
  name?: string
}

/**
 * Converts the old format (color1/color2/color3) into stops at 0, 0.5 and 1 —
 * exactly the distribution the three-color shader used, so whatever the user
 * saved keeps looking the same.
 */
export function legacyColorsToStops(legacy: LegacyColorScheme | undefined): ColorStop[] | null {
  if (!legacy) return null
  const colors = [legacy.color1, legacy.color2, legacy.color3].filter(
    (color): color is number[] =>
      Array.isArray(color) && color.length >= 3 && color.slice(0, 3).every(isFiniteNumber)
  )
  if (colors.length < MIN_STOPS) return null
  return stopsFromColors(colors)
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

function toHex(channel: number): string {
  return Math.round(clamp01(channel) * 255)
    .toString(16)
    .padStart(2, "0")
}

export function stopToHex(stop: ColorStop): string {
  return `#${toHex(stop.color[0])}${toHex(stop.color[1])}${toHex(stop.color[2])}`
}

/**
 * CSS gradient equivalent to the stops. The interpolation space follows the
 * render: without `in oklab` the CSS would mix in sRGB and produce a different
 * middle than the canvas.
 */
export function stopsToCss(
  stops: readonly ColorStop[],
  blendSpace: "oklab" | "linear" = "oklab",
  angle = "135deg"
): string {
  const interpolation = blendSpace === "linear" ? " in srgb-linear" : " in oklab"
  const list = sortStops(stops)
    .map((stop) => `${stopToHex(stop)} ${(stop.position * 100).toFixed(1)}%`)
    .join(", ")
  return `linear-gradient(${angle}${interpolation}, ${list})`
}
