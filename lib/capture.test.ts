import { describe, it, expect } from "vitest"
import { cssBlendToComposite, clampToMaxSize, recommendBitrateMbps } from "./capture"

describe("cssBlendToComposite", () => {
  it("converte 'normal' para 'source-over'", () => {
    expect(cssBlendToComposite("normal")).toBe("source-over")
  })

  it("mantém blend modes suportados pelo canvas 2D", () => {
    expect(cssBlendToComposite("multiply")).toBe("multiply")
    expect(cssBlendToComposite("screen")).toBe("screen")
    expect(cssBlendToComposite("color-dodge")).toBe("color-dodge")
    expect(cssBlendToComposite("soft-light")).toBe("soft-light")
  })

  it("usa 'source-over' como fallback para valores desconhecidos ou vazios", () => {
    expect(cssBlendToComposite("plus-lighter")).toBe("source-over")
    expect(cssBlendToComposite("")).toBe("source-over")
    expect(cssBlendToComposite(undefined)).toBe("source-over")
  })
})

describe("clampToMaxSize", () => {
  it("não altera dimensões dentro do limite", () => {
    expect(clampToMaxSize(1920, 1080, 8192)).toEqual({ width: 1920, height: 1080 })
  })

  it("reduz preservando a proporção quando excede o limite", () => {
    const result = clampToMaxSize(20000, 10000, 8192)
    expect(result.width).toBe(8192)
    expect(result.height).toBe(4096)
  })

  it("limita pela maior dimensão (retrato)", () => {
    const result = clampToMaxSize(10000, 20000, 8192)
    expect(result.height).toBe(8192)
    expect(result.width).toBe(4096)
  })

  it("nunca retorna dimensões menores que 1", () => {
    const result = clampToMaxSize(1, 100000, 1024)
    expect(result.width).toBeGreaterThanOrEqual(1)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})

describe("recommendBitrateMbps", () => {
  it("recomenda mais bitrate para qualidade mais alta", () => {
    const low = recommendBitrateMbps(1920, 1080, 30, "low")
    const medium = recommendBitrateMbps(1920, 1080, 30, "medium")
    const high = recommendBitrateMbps(1920, 1080, 30, "high")
    expect(low).toBeLessThan(medium)
    expect(medium).toBeLessThan(high)
  })

  it("escala com resolução e FPS", () => {
    const fullHd30 = recommendBitrateMbps(1920, 1080, 30, "high")
    const fullHd60 = recommendBitrateMbps(1920, 1080, 60, "high")
    const fourK30 = recommendBitrateMbps(3840, 2160, 30, "high")
    expect(fullHd60).toBeGreaterThan(fullHd30)
    expect(fourK30).toBeGreaterThan(fullHd30)
  })

  it("respeita os limites de 2 a 50 Mbps", () => {
    expect(recommendBitrateMbps(320, 240, 15, "low")).toBeGreaterThanOrEqual(2)
    expect(recommendBitrateMbps(7680, 4320, 60, "high")).toBeLessThanOrEqual(50)
  })
})
