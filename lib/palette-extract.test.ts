import { describe, it, expect } from "vitest"
import { extractPalette } from "./palette-extract"

// Builds an RGBA buffer from a repeated list of colors
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
  it("finds the dominant colors of a simple image", () => {
    const palette = extractPalette(
      pixels([
        [230, 30, 30],
        [30, 40, 220],
      ]),
      { count: 2 }
    )

    expect(palette).toHaveLength(2)
    // Sorted by lightness: the dark blue comes before the red
    const [darker, lighter] = palette
    expect(darker[2]).toBeGreaterThan(darker[0])
    expect(lighter[0]).toBeGreaterThan(lighter[2])
  })

  it("lands each center close to the source color", () => {
    const palette = extractPalette(pixels([[200, 60, 20]]), { count: 1 })
    expect(palette).toHaveLength(1)
    expect(palette[0][0]).toBeCloseTo(200 / 255, 1)
    expect(palette[0][1]).toBeCloseTo(60 / 255, 1)
    expect(palette[0][2]).toBeCloseTo(20 / 255, 1)
  })

  it("is deterministic: the same image gives the same palette", () => {
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

  it("ignores transparent pixels", () => {
    const data = new Uint8ClampedArray([
      // vermelho opaco
      230, 30, 30, 255,
      // fully transparent green — must not enter the palette
      0, 255, 0, 0,
    ])
    const palette = extractPalette(data, { count: 1 })
    expect(palette).toHaveLength(1)
    expect(palette[0][1]).toBeLessThan(0.4)
  })

  it("returns no more colors than requested, and no near-duplicates", () => {
    const palette = extractPalette(
      pixels([
        [100, 100, 100],
        [101, 100, 100],
        [100, 101, 100],
      ]),
      { count: 6 }
    )
    expect(palette.length).toBeLessThanOrEqual(6)
    // Three nearly identical grays collapse
    expect(palette.length).toBeLessThanOrEqual(2)
  })

  it("clamps the count at 8 (the shader's stop limit)", () => {
    const many: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [
      (i * 8) % 256,
      (i * 17) % 256,
      (i * 29) % 256,
    ])
    expect(extractPalette(pixels(many, 3), { count: 20 }).length).toBeLessThanOrEqual(8)
  })

  it("returns an empty list for an empty buffer", () => {
    expect(extractPalette(new Uint8ClampedArray(), { count: 3 })).toEqual([])
    expect(extractPalette(new Uint8ClampedArray([0, 0, 0, 0]), { count: 3 })).toEqual([])
  })

  it("returns the samples themselves when there are fewer pixels than requested colors", () => {
    const palette = extractPalette(new Uint8ClampedArray([255, 0, 0, 255]), { count: 4 })
    expect(palette).toHaveLength(1)
    expect(palette[0][0]).toBeCloseTo(1, 2)
  })

  it("every color stays inside 0-1", () => {
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
