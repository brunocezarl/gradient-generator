import { describe, it, expect } from "vitest"
import { LIBRARY_FORMAT, parseLibrary, serializeLibrary } from "./library"
import type { ColorScheme, GradientPreset, StateSnapshot } from "./store"
import { stopsFromColors } from "./color-stops"

const snapshot: StateSnapshot = {
  speed: 1,
  complexity: 3,
  noiseScale: 2,
  colorScheme: "redBlue",
  isCustomMode: true,
  customStops: stopsFromColors([
    [1, 0, 0],
    [0, 0, 1],
  ]),
  flowIntensity: 0.3,
  grainAmount: 0.05,
  grainScale: 500,
  thresholdMin: 0.3,
  thresholdMax: 0.7,
  vibrance: 0,
  exposure: 0,
  brightness: 0,
  contrast: 1,
  blendSpace: "oklab",
  seed: [1, 2],
  loopDuration: 6,
}

const preset: GradientPreset = {
  id: "preset_1",
  name: "Brand",
  createdAt: 1,
  snapshot,
}

const schemes: Record<string, ColorScheme> = {
  meu: { stops: stopsFromColors([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]), name: "Mine" },
}

describe("serializeLibrary", () => {
  it("produces an identifiable, readable file", () => {
    const parsed = JSON.parse(serializeLibrary([preset], schemes))
    expect(parsed.format).toBe(LIBRARY_FORMAT)
    expect(parsed.version).toBe(1)
    expect(parsed.presets).toHaveLength(1)
    expect(parsed.colorSchemes.meu.name).toBe("Mine")
    expect(typeof parsed.exportedAt).toBe("string")
  })

  it("round-trips through parseLibrary", () => {
    const { presets, colorSchemes } = parseLibrary(serializeLibrary([preset], schemes))
    expect(presets).toHaveLength(1)
    expect((presets[0] as GradientPreset).name).toBe("Brand")
    expect(Object.keys(colorSchemes)).toEqual(["meu"])
  })
})

describe("parseLibrary", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseLibrary("{not json")).toThrow(/not JSON/)
  })

  it("rejects files from another origin", () => {
    expect(() => parseLibrary(JSON.stringify({ presets: [] }))).toThrow(/not a Gradient Generator library/)
    expect(() => parseLibrary(JSON.stringify({ format: "outra-coisa" }))).toThrow(
      /not a Gradient Generator library/
    )
  })

  it("rejects a future version instead of importing it wrong", () => {
    expect(() =>
      parseLibrary(JSON.stringify({ format: LIBRARY_FORMAT, version: 99, presets: [preset] }))
    ).toThrow(/newer version/)
  })

  it("rejects a file with nothing usable", () => {
    expect(() =>
      parseLibrary(JSON.stringify({ format: LIBRARY_FORMAT, version: 1, presets: [] }))
    ).toThrow(/no presets/)
  })

  it("drops malformed presets but keeps the rest", () => {
    const file = {
      format: LIBRARY_FORMAT,
      version: 1,
      presets: [preset, { name: "no snapshot" }, null, 42],
      colorSchemes: schemes,
    }
    const { presets } = parseLibrary(JSON.stringify(file))
    expect(presets).toHaveLength(1)
  })

  it("accepts a file with color schemes only", () => {
    const file = { format: LIBRARY_FORMAT, version: 1, colorSchemes: schemes }
    const { presets, colorSchemes } = parseLibrary(JSON.stringify(file))
    expect(presets).toHaveLength(0)
    expect(Object.keys(colorSchemes)).toEqual(["meu"])
  })
})
