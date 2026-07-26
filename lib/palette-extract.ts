import { srgbToLinear, linearToSrgb, type RgbTriplet } from "@/lib/color"
import { linearToOklab, oklabToLinear } from "@/lib/oklch"

// Extração de paleta de uma imagem de referência.
//
// A clusterização acontece em Oklab, não em RGB: em RGB, distâncias iguais não
// correspondem a diferenças visuais iguais, e o resultado tende a agrupar tons
// que o olho vê como distintos (e separar os que vê como iguais).

export interface ExtractPaletteOptions {
  /** Quantidade de cores desejada */
  count?: number
  /** Iterações do k-means */
  iterations?: number
  /** Ignora pixels quase transparentes */
  alphaThreshold?: number
}

type Lab = [number, number, number]

function pixelToLab(r: number, g: number, b: number): Lab {
  return linearToOklab([
    srgbToLinear(r / 255),
    srgbToLinear(g / 255),
    srgbToLinear(b / 255),
  ]) as Lab
}

function labToSrgb(lab: Lab): RgbTriplet {
  const linear = oklabToLinear(lab)
  return [
    Math.min(Math.max(linearToSrgb(linear[0]), 0), 1),
    Math.min(Math.max(linearToSrgb(linear[1]), 0), 1),
    Math.min(Math.max(linearToSrgb(linear[2]), 0), 1),
  ]
}

function distance(a: Lab, b: Lab): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

/**
 * Cores dominantes de um buffer RGBA (como sai de `getImageData`).
 *
 * A inicialização é determinística — amostras ordenadas por luminosidade,
 * divididas em quantis — para que a mesma imagem sempre produza a mesma paleta.
 * K-means com centros aleatórios daria uma paleta diferente a cada clique.
 */
export function extractPalette(
  pixels: Uint8ClampedArray | number[],
  { count = 4, iterations = 12, alphaThreshold = 16 }: ExtractPaletteOptions = {}
): RgbTriplet[] {
  const target = Math.min(Math.max(Math.round(count), 1), 8)

  const samples: Lab[] = []
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < alphaThreshold) continue
    samples.push(pixelToLab(pixels[index], pixels[index + 1], pixels[index + 2]))
  }

  if (samples.length === 0) return []
  if (samples.length <= target) return samples.map(labToSrgb)

  const byLightness = [...samples].sort((a, b) => a[0] - b[0])
  let centroids: Lab[] = Array.from({ length: target }, (_, index) => {
    const position = Math.floor(((index + 0.5) / target) * (byLightness.length - 1))
    return [...byLightness[position]] as Lab
  })

  for (let iteration = 0; iteration < iterations; iteration++) {
    const sums: Lab[] = centroids.map(() => [0, 0, 0])
    const counts = new Array(target).fill(0)

    for (const sample of samples) {
      let best = 0
      let bestDistance = Number.POSITIVE_INFINITY
      for (let index = 0; index < centroids.length; index++) {
        const d = distance(sample, centroids[index])
        if (d < bestDistance) {
          bestDistance = d
          best = index
        }
      }
      sums[best][0] += sample[0]
      sums[best][1] += sample[1]
      sums[best][2] += sample[2]
      counts[best]++
    }

    let moved = 0
    const next: Lab[] = centroids.map((centroid, index) => {
      if (counts[index] === 0) return centroid
      const updated: Lab = [
        sums[index][0] / counts[index],
        sums[index][1] / counts[index],
        sums[index][2] / counts[index],
      ]
      moved += distance(centroid, updated)
      return updated
    })

    centroids = next
    // Convergiu: mais iterações não mudam a paleta
    if (moved < 1e-6) break
  }

  // Ordena por luminosidade: uma paleta clara→escura é o ponto de partida
  // natural para um gradiente
  return centroids
    .sort((a, b) => a[0] - b[0])
    .map(labToSrgb)
    .filter((color, index, all) => {
      // Descarta quase-duplicatas que sobram quando a imagem tem menos cores
      // distintas que o pedido
      if (index === 0) return true
      const previous = all[index - 1]
      return (
        Math.abs(color[0] - previous[0]) +
          Math.abs(color[1] - previous[1]) +
          Math.abs(color[2] - previous[2]) >
        0.02
      )
    })
}

/**
 * Reduz a imagem antes de amostrar: 96px de lado bastam para as cores
 * dominantes e mantêm a extração instantânea mesmo com uma foto de 4000px.
 */
export const PALETTE_SAMPLE_SIZE = 96

export async function extractPaletteFromImage(
  source: HTMLImageElement | ImageBitmap,
  options: ExtractPaletteOptions = {}
): Promise<RgbTriplet[]> {
  const width = "width" in source ? source.width : PALETTE_SAMPLE_SIZE
  const height = "height" in source ? source.height : PALETTE_SAMPLE_SIZE
  const scale = Math.min(PALETTE_SAMPLE_SIZE / Math.max(width, height), 1)

  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Não foi possível ler a imagem")

  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

  return extractPalette(data, options)
}
