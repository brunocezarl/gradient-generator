import { describe, it, expect } from "vitest"
import {
  srgbToLinear,
  linearToSrgb,
  srgbTripletToLinear,
  linearTripletToSrgb,
} from "./color"

describe("srgbToLinear / linearToSrgb", () => {
  it("preserva os extremos exatos", () => {
    expect(srgbToLinear(0)).toBe(0)
    expect(srgbToLinear(1)).toBeCloseTo(1, 10)
    expect(linearToSrgb(0)).toBe(0)
    expect(linearToSrgb(1)).toBeCloseTo(1, 10)
  })

  it("usa o segmento linear abaixo do joelho da curva", () => {
    expect(srgbToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 10)
    expect(linearToSrgb(0.002)).toBeCloseTo(0.002 * 12.92, 10)
  })

  it("converte o cinza médio sRGB para o valor linear conhecido", () => {
    // 0.5 sRGB ≈ 0.2140 linear — é exatamente esta diferença que faz a
    // mistura em sRGB escurecer o meio do gradiente
    expect(srgbToLinear(0.5)).toBeCloseTo(0.2140, 4)
  })

  it("faz round-trip em toda a faixa (o HEX do picker sobrevive)", () => {
    for (let i = 0; i <= 255; i++) {
      const channel = i / 255
      const roundTripped = linearToSrgb(srgbToLinear(channel))
      // Volta ao mesmo byte depois de quantizar
      expect(Math.round(roundTripped * 255)).toBe(i)
    }
  })

  it("é monotônica", () => {
    let previous = -1
    for (let i = 0; i <= 100; i++) {
      const value = srgbToLinear(i / 100)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })

  it("satura valores fora de 0-1", () => {
    expect(srgbToLinear(-0.5)).toBe(0)
    expect(srgbToLinear(2)).toBeCloseTo(1, 10)
    expect(linearToSrgb(-1)).toBe(0)
    expect(linearToSrgb(5)).toBeCloseTo(1, 10)
  })
})

describe("conversão de triplas", () => {
  it("converte os três canais e faz round-trip", () => {
    const srgb = [0.9, 0.1, 0.35]
    const linear = srgbTripletToLinear(srgb)
    expect(linear[0]).toBeCloseTo(srgbToLinear(0.9), 10)
    expect(linear[1]).toBeCloseTo(srgbToLinear(0.1), 10)
    expect(linear[2]).toBeCloseTo(srgbToLinear(0.35), 10)

    const back = linearTripletToSrgb(linear)
    expect(back[0]).toBeCloseTo(0.9, 6)
    expect(back[1]).toBeCloseTo(0.1, 6)
    expect(back[2]).toBeCloseTo(0.35, 6)
  })

  it("trata canais ausentes como 0", () => {
    expect(srgbTripletToLinear([])).toEqual([0, 0, 0])
    expect(linearTripletToSrgb([0.5])).toEqual([linearToSrgb(0.5), 0, 0])
  })
})
