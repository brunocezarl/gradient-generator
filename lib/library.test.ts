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
  blendSpace: "oklab",
  seed: [1, 2],
  loopDuration: 6,
}

const preset: GradientPreset = {
  id: "preset_1",
  name: "Marca",
  createdAt: 1,
  snapshot,
}

const schemes: Record<string, ColorScheme> = {
  meu: { stops: stopsFromColors([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]), name: "Meu" },
}

describe("serializeLibrary", () => {
  it("gera um arquivo identificável e legível", () => {
    const parsed = JSON.parse(serializeLibrary([preset], schemes))
    expect(parsed.format).toBe(LIBRARY_FORMAT)
    expect(parsed.version).toBe(1)
    expect(parsed.presets).toHaveLength(1)
    expect(parsed.colorSchemes.meu.name).toBe("Meu")
    expect(typeof parsed.exportedAt).toBe("string")
  })

  it("faz round-trip com parseLibrary", () => {
    const { presets, colorSchemes } = parseLibrary(serializeLibrary([preset], schemes))
    expect(presets).toHaveLength(1)
    expect((presets[0] as GradientPreset).name).toBe("Marca")
    expect(Object.keys(colorSchemes)).toEqual(["meu"])
  })
})

describe("parseLibrary", () => {
  it("rejeita JSON inválido", () => {
    expect(() => parseLibrary("{nao json")).toThrow(/não é JSON/)
  })

  it("rejeita arquivos de outra origem", () => {
    expect(() => parseLibrary(JSON.stringify({ presets: [] }))).toThrow(/não é uma biblioteca/)
    expect(() => parseLibrary(JSON.stringify({ format: "outra-coisa" }))).toThrow(
      /não é uma biblioteca/
    )
  })

  it("rejeita versão futura em vez de importar errado", () => {
    expect(() =>
      parseLibrary(JSON.stringify({ format: LIBRARY_FORMAT, version: 99, presets: [preset] }))
    ).toThrow(/versão mais nova/)
  })

  it("rejeita arquivo sem conteúdo aproveitável", () => {
    expect(() =>
      parseLibrary(JSON.stringify({ format: LIBRARY_FORMAT, version: 1, presets: [] }))
    ).toThrow(/sem presets/)
  })

  it("descarta presets malformados mas aproveita o resto", () => {
    const file = {
      format: LIBRARY_FORMAT,
      version: 1,
      presets: [preset, { name: "sem snapshot" }, null, 42],
      colorSchemes: schemes,
    }
    const { presets } = parseLibrary(JSON.stringify(file))
    expect(presets).toHaveLength(1)
  })

  it("aceita arquivo só com esquemas de cor", () => {
    const file = { format: LIBRARY_FORMAT, version: 1, colorSchemes: schemes }
    const { presets, colorSchemes } = parseLibrary(JSON.stringify(file))
    expect(presets).toHaveLength(0)
    expect(Object.keys(colorSchemes)).toEqual(["meu"])
  })
})
