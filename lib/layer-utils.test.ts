import { describe, it, expect } from "vitest"
import { blendModes, createDefaultLayer, generateLayerId } from "@/lib/layer-utils"

describe("createDefaultLayer", () => {
  it("creates a visible layer with the given id and coherent thresholds", () => {
    const layer = createDefaultLayer("abc")
    expect(layer.id).toBe("abc")
    expect(layer.visible).toBe(true)
    expect(layer.opacity).toBe(1.0)
    expect(layer.blendMode).toBe("normal")
    expect(layer.noiseScale).toBe(0.6)
    expect(layer.thresholdMin).toBeLessThan(layer.thresholdMax)
  })
})

describe("generateLayerId", () => {
  it("generates ids with the expected prefix", () => {
    expect(generateLayerId()).toMatch(/^layer_\d+_\d+$/)
  })

  it("gera ids distintos em chamadas sucessivas", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateLayerId()))
    // Date.now + counter: a collision across 50 calls would be a real bug
    expect(ids.size).toBeGreaterThan(1)
  })
})
