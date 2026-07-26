import { describe, it, expect } from "vitest"
import { generateTokens, tokenFormatExtensions, tokenFormatLabels } from "./tokens"
import { stopsFromColors } from "./color-stops"

const stops = stopsFromColors([
  [0.9, 0.1, 0.1],
  [0.0, 0.0, 0.9],
])

const options = { stops, blendSpace: "oklab" as const, name: "Primary Brand" }

describe("JSON tokens", () => {
  it("produces design tokens with hex, position and OKLCH", () => {
    const parsed = JSON.parse(generateTokens("json", options))
    const group = parsed["primary-brand"]

    expect(group["primary-brand-1"].$type).toBe("color")
    expect(group["primary-brand-1"].$value).toBe("#e61a1a")
    expect(group["primary-brand-1"].$extensions.position).toBe(0)
    expect(group["primary-brand-2"].$extensions.position).toBe(1)

    // OKLCH ships with the tokens: that is how the palette can be re-tuned
    // without losing the hue
    const oklch = group["primary-brand-1"].$extensions.oklch
    expect(oklch.l).toBeGreaterThan(0)
    expect(oklch.c).toBeGreaterThan(0)
    expect(oklch.h).toBeGreaterThanOrEqual(0)

    expect(group["primary-brand-css"].$value).toContain("in oklab")
  })

  it("is valid JSON for any name", () => {
    for (const name of ["", "Action & Color!", "gradient", "  spaces  "]) {
      expect(() => JSON.parse(generateTokens("json", { ...options, name }))).not.toThrow()
    }
  })
})

describe("CSS tokens", () => {
  const css = generateTokens("css", options)

  it("declares one custom property per stop, plus position and the gradient", () => {
    expect(css).toContain("--primary-brand-1: #e61a1a;")
    expect(css).toContain("--primary-brand-2: #0000e6;")
    expect(css).toContain("--primary-brand-1-position: 0.0%;")
    expect(css).toContain("--primary-brand-2-position: 100.0%;")
    expect(css).toContain("--primary-brand: linear-gradient(")
  })

  it("opens and closes the :root block", () => {
    expect(css.startsWith(":root {")).toBe(true)
    expect(css.trimEnd().endsWith("}")).toBe(true)
  })
})

describe("Tailwind tokens", () => {
  it("produces a config snippet with the colors", () => {
    const config = generateTokens("tailwind", options)
    expect(config).toContain("module.exports")
    expect(config).toContain('"primary-brand-1": "#e61a1a"')
    expect(config).toContain("extend")
  })
})

describe("SVG", () => {
  const svg = generateTokens("svg", options)

  it("produces a linearGradient with the stops at their positions", () => {
    expect(svg).toContain("<svg")
    expect(svg).toContain('<linearGradient id="primary-brand"')
    expect(svg).toContain('offset="0.0%" stop-color="#e61a1a"')
    expect(svg).toContain('offset="100.0%" stop-color="#0000e6"')
    expect(svg).toContain('fill="url(#primary-brand)"')
  })
})

describe("format metadata", () => {
  it("every format has a label and an extension", () => {
    for (const format of Object.keys(tokenFormatLabels) as (keyof typeof tokenFormatLabels)[]) {
      expect(tokenFormatLabels[format]).toBeTruthy()
      expect(tokenFormatExtensions[format]).toMatch(/^[a-z]+$/)
    }
  })

  it("respects the chosen interpolation space", () => {
    const linear = generateTokens("css", { ...options, blendSpace: "linear" })
    expect(linear).toContain("in srgb-linear")
  })
})
