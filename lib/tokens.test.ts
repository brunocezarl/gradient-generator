import { describe, it, expect } from "vitest"
import { generateTokens, tokenFormatExtensions, tokenFormatLabels } from "./tokens"
import { stopsFromColors } from "./color-stops"

const stops = stopsFromColors([
  [0.9, 0.1, 0.1],
  [0.0, 0.0, 0.9],
])

const options = { stops, blendSpace: "oklab" as const, name: "Marca Principal" }

describe("tokens JSON", () => {
  it("gera design tokens com hex, posição e OKLCH", () => {
    const parsed = JSON.parse(generateTokens("json", options))
    const group = parsed["marca-principal"]

    expect(group["marca-principal-1"].$type).toBe("color")
    expect(group["marca-principal-1"].$value).toBe("#e61a1a")
    expect(group["marca-principal-1"].$extensions.position).toBe(0)
    expect(group["marca-principal-2"].$extensions.position).toBe(1)

    // OKLCH acompanha os tokens: é assim que a paleta pode ser reajustada sem
    // perder o matiz
    const oklch = group["marca-principal-1"].$extensions.oklch
    expect(oklch.l).toBeGreaterThan(0)
    expect(oklch.c).toBeGreaterThan(0)
    expect(oklch.h).toBeGreaterThanOrEqual(0)

    expect(group["marca-principal-css"].$value).toContain("in oklab")
  })

  it("é JSON válido para qualquer nome", () => {
    for (const name of ["", "Ação & Cor!", "gradient", "  espaços  "]) {
      expect(() => JSON.parse(generateTokens("json", { ...options, name }))).not.toThrow()
    }
  })
})

describe("tokens CSS", () => {
  const css = generateTokens("css", options)

  it("declara uma custom property por parada, mais posição e o gradiente", () => {
    expect(css).toContain("--marca-principal-1: #e61a1a;")
    expect(css).toContain("--marca-principal-2: #0000e6;")
    expect(css).toContain("--marca-principal-1-position: 0.0%;")
    expect(css).toContain("--marca-principal-2-position: 100.0%;")
    expect(css).toContain("--marca-principal: linear-gradient(")
  })

  it("abre e fecha o bloco :root", () => {
    expect(css.startsWith(":root {")).toBe(true)
    expect(css.trimEnd().endsWith("}")).toBe(true)
  })
})

describe("tokens Tailwind", () => {
  it("gera um trecho de config com as cores", () => {
    const config = generateTokens("tailwind", options)
    expect(config).toContain("module.exports")
    expect(config).toContain('"marca-principal-1": "#e61a1a"')
    expect(config).toContain("extend")
  })
})

describe("SVG", () => {
  const svg = generateTokens("svg", options)

  it("gera um linearGradient com as paradas nas posições", () => {
    expect(svg).toContain("<svg")
    expect(svg).toContain('<linearGradient id="marca-principal"')
    expect(svg).toContain('offset="0.0%" stop-color="#e61a1a"')
    expect(svg).toContain('offset="100.0%" stop-color="#0000e6"')
    expect(svg).toContain('fill="url(#marca-principal)"')
  })
})

describe("metadados dos formatos", () => {
  it("cada formato tem rótulo e extensão", () => {
    for (const format of Object.keys(tokenFormatLabels) as (keyof typeof tokenFormatLabels)[]) {
      expect(tokenFormatLabels[format]).toBeTruthy()
      expect(tokenFormatExtensions[format]).toMatch(/^[a-z]+$/)
    }
  })

  it("respeita o espaço de interpolação escolhido", () => {
    const linear = generateTokens("css", { ...options, blendSpace: "linear" })
    expect(linear).toContain("in srgb-linear")
  })
})
