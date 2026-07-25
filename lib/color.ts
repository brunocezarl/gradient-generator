// Conversões entre sRGB e RGB linear.
//
// Os valores que o usuário escolhe no color picker (e que aparecem como HEX)
// são sRGB — um espaço com curva de transferência, feito para percepção e
// para o display. Mistura de cor, por outro lado, é mistura de luz: só se
// comporta de forma correta em espaço linear. Misturar dois sRGB direto
// escurece o meio do gradiente e cria as faixas "lamacentas" clássicas.
//
// Curva de transferência: IEC 61966-2-1 (a mesma usada por CSS Color 4).

// Espaço em que as paradas de cor são interpoladas. Oklab é perceptualmente
// uniforme (não escurece o meio entre matizes opostos); linear é a mistura
// fisicamente correta de luz.
export type ColorBlendSpace = "oklab" | "linear"

export const colorBlendSpaces: Record<ColorBlendSpace, string> = {
  oklab: "Oklab (perceptual)",
  linear: "Linear (luz)",
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

// Aceita entrada incompleta: uma cor pode chegar de um link compartilhado ou de
// um localStorage antigo. Preto é um fallback visível, e não uma tela de erro.
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
