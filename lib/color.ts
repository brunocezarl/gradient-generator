// Conversions between sRGB and linear RGB.
//
// The values a user picks in the color picker (and sees as HEX) are sRGB — a
// space with a transfer curve, built for perception and for displays. Mixing
// color, on the other hand, is mixing light: it only behaves correctly in
// linear space. Interpolating two sRGB values directly darkens the middle of
// the gradient and produces the classic muddy band.
//
// Transfer curve: IEC 61966-2-1 (the same one CSS Color 4 uses).

// Space the color stops are interpolated in. Oklab is perceptually uniform (no
// dark middle between opposing hues); linear is the physically correct mixing
// of light.
export type ColorBlendSpace = "oklab" | "linear"

export const colorBlendSpaces: Record<ColorBlendSpace, string> = {
  oklab: "Oklab (perceptual)",
  linear: "Linear (light)",
}

export function srgbToLinear(channel: number): number {
  const c = Math.min(Math.max(channel, 0), 1)
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function linearToSrgb(channel: number): number {
  const c = Math.min(Math.max(channel, 0), 1)
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

export type RgbTriplet = [number, number, number]

// Accepts incomplete input: a color can arrive from a shared link or from an
// old localStorage entry. Black is a visible fallback rather than a crash.
export function srgbTripletToLinear(color: readonly number[] | undefined): RgbTriplet {
  return [
    srgbToLinear(color?.[0] ?? 0),
    srgbToLinear(color?.[1] ?? 0),
    srgbToLinear(color?.[2] ?? 0),
  ]
}

export function linearTripletToSrgb(color: readonly number[] | undefined): RgbTriplet {
  return [
    linearToSrgb(color?.[0] ?? 0),
    linearToSrgb(color?.[1] ?? 0),
    linearToSrgb(color?.[2] ?? 0),
  ]
}
