import { describe, it, expect } from "vitest"
import { extractPalette } from "./palette-extract"

// Constrói um buffer RGBA a partir de uma lista de cores repetidas
function pixels(colors: [number, number, number][], repeat = 20): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * repeat * 4)
  let offset = 0
  for (let time = 0; time < repeat; time++) {
    for (const [r, g, b] of colors) {
      data[offset++] = r
      data[offset++] = g
      data[offset++] = b
      data[offset++] = 255
    }
  }
  return data
}

describe("extractPalette", () => {
  it("encontra as cores dominantes de uma imagem simples", () => {
    const palette = extractPalette(
      pixels([
        [230, 30, 30],
        [30, 40, 220],
      ]),
      { count: 2 }
    )

    expect(palette).toHaveLength(2)
    // Ordenada por luminosidade: o azul escuro vem antes do vermelho
    const [darker, lighter] = palette
    expect(darker[2]).toBeGreaterThan(darker[0])
    expect(lighter[0]).toBeGreaterThan(lighter[2])
  })

  it("aproxima cada centro da cor de origem", () => {
    const palette = extractPalette(pixels([[200, 60, 20]]), { count: 1 })
    expect(palette).toHaveLength(1)
    expect(palette[0][0]).toBeCloseTo(200 / 255, 1)
    expect(palette[0][1]).toBeCloseTo(60 / 255, 1)
    expect(palette[0][2]).toBeCloseTo(20 / 255, 1)
  })

  it("é determinística: a mesma imagem dá a mesma paleta", () => {
    const data = pixels([
      [10, 200, 120],
      [240, 220, 10],
      [40, 40, 45],
      [120, 90, 200],
    ])
    const first = extractPalette(data, { count: 4 })
    const second = extractPalette(data, { count: 4 })
    expect(first).toEqual(second)
  })

  it("ignora pixels transparentes", () => {
    const data = new Uint8ClampedArray([
      // vermelho opaco
      230, 30, 30, 255,
      // verde totalmente transparente — não deve entrar na paleta
      0, 255, 0, 0,
    ])
    const palette = extractPalette(data, { count: 1 })
    expect(palette).toHaveLength(1)
    expect(palette[0][1]).toBeLessThan(0.4)
  })

  it("não devolve mais cores que o pedido, nem quase-duplicatas", () => {
    const palette = extractPalette(
      pixels([
        [100, 100, 100],
        [101, 100, 100],
        [100, 101, 100],
      ]),
      { count: 6 }
    )
    expect(palette.length).toBeLessThanOrEqual(6)
    // Três tons de cinza quase idênticos colapsam
    expect(palette.length).toBeLessThanOrEqual(2)
  })

  it("satura a quantidade em 8 (limite de paradas do shader)", () => {
    const many: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [
      (i * 8) % 256,
      (i * 17) % 256,
      (i * 29) % 256,
    ])
    expect(extractPalette(pixels(many, 3), { count: 20 }).length).toBeLessThanOrEqual(8)
  })

  it("devolve lista vazia para um buffer vazio", () => {
    expect(extractPalette(new Uint8ClampedArray(), { count: 3 })).toEqual([])
    expect(extractPalette(new Uint8ClampedArray([0, 0, 0, 0]), { count: 3 })).toEqual([])
  })

  it("devolve as próprias amostras quando há menos pixels que cores pedidas", () => {
    const palette = extractPalette(new Uint8ClampedArray([255, 0, 0, 255]), { count: 4 })
    expect(palette).toHaveLength(1)
    expect(palette[0][0]).toBeCloseTo(1, 2)
  })

  it("todas as cores ficam dentro de 0-1", () => {
    const palette = extractPalette(
      pixels([
        [255, 255, 255],
        [0, 0, 0],
        [255, 0, 128],
      ]),
      { count: 3 }
    )
    for (const color of palette) {
      for (const channel of color) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
    }
  })
})
