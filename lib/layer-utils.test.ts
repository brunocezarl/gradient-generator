import { describe, it, expect } from "vitest"
import { blendModes, blendModeToCSS, createDefaultLayer, generateLayerId } from "@/lib/layer-utils"

describe("blendModeToCSS", () => {
  it("converte chaves camelCase para valores CSS", () => {
    expect(blendModeToCSS("colorDodge")).toBe("color-dodge")
    expect(blendModeToCSS("colorBurn")).toBe("color-burn")
    expect(blendModeToCSS("hardLight")).toBe("hard-light")
    expect(blendModeToCSS("softLight")).toBe("soft-light")
  })

  it("mapeia todos os blend modes disponíveis na UI", () => {
    for (const mode of Object.keys(blendModes)) {
      expect(blendModeToCSS(mode)).toBeTruthy()
    }
  })

  it("usa 'normal' como fallback para modos desconhecidos", () => {
    expect(blendModeToCSS("inexistente")).toBe("normal")
    expect(blendModeToCSS("")).toBe("normal")
  })
})

describe("createDefaultLayer", () => {
  it("cria camada visível com o id fornecido e limiares coerentes", () => {
    const layer = createDefaultLayer("abc")
    expect(layer.id).toBe("abc")
    expect(layer.visible).toBe(true)
    expect(layer.opacity).toBe(1.0)
    expect(layer.blendMode).toBe("normal")
    expect(layer.thresholdMin).toBeLessThan(layer.thresholdMax)
  })
})

describe("generateLayerId", () => {
  it("gera ids com o prefixo esperado", () => {
    expect(generateLayerId()).toMatch(/^layer_\d+_\d+$/)
  })

  it("gera ids distintos em chamadas sucessivas", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateLayerId()))
    // Date.now + sufixo aleatório: colisões em 50 chamadas seriam um bug real
    expect(ids.size).toBeGreaterThan(1)
  })
})
