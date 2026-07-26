import { describe, it, expect } from "vitest"
import {
  srgbToLinear,
  linearToSrgb,
  srgbTripletToLinear,
  linearTripletToSrgb,
} from "./color"

describe("srgbToLinear / linearToSrgb", () => {
  it("preserves the exact extremes", () => {
    expect(srgbToLinear(0)).toBe(0)
    expect(srgbToLinear(1)).toBeCloseTo(1, 10)
    expect(linearToSrgb(0)).toBe(0)
    expect(linearToSrgb(1)).toBeCloseTo(1, 10)
  })

  it("uses the linear segment below the curve's knee", () => {
    expect(srgbToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 10)
    expect(linearToSrgb(0.002)).toBeCloseTo(0.002 * 12.92, 10)
  })

  it("converts mid sRGB gray to the known linear value", () => {
    // 0.5 sRGB ≈ 0.2140 linear — exactly the difference that makes sRGB mixing
    // darken the middle of a gradient
    expect(srgbToLinear(0.5)).toBeCloseTo(0.2140, 4)
  })

  it("round-trips across the whole range (the picker HEX survives)", () => {
    for (let i = 0; i <= 255; i++) {
      const channel = i / 255
      const roundTripped = linearToSrgb(srgbToLinear(channel))
      // Volta ao mesmo byte depois de quantizar
      expect(Math.round(roundTripped * 255)).toBe(i)
    }
  })

  it("is monotonic", () => {
    let previous = -1
    for (let i = 0; i <= 100; i++) {
      const value = srgbToLinear(i / 100)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })

  it("clamps values outside 0-1", () => {
    expect(srgbToLinear(-0.5)).toBe(0)
    expect(srgbToLinear(2)).toBeCloseTo(1, 10)
    expect(linearToSrgb(-1)).toBe(0)
    expect(linearToSrgb(5)).toBeCloseTo(1, 10)
  })
})

describe("triplet conversion", () => {
  it("converts all three channels and round-trips", () => {
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

  it("treats missing channels as 0", () => {
    expect(srgbTripletToLinear([])).toEqual([0, 0, 0])
    expect(linearTripletToSrgb([0.5])).toEqual([linearToSrgb(0.5), 0, 0])
  })
})
