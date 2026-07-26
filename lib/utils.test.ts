import { describe, it, expect } from "vitest"
import { cn, rgbToHex, hexToRgb, rgbToHsl, hslToRgb } from "@/lib/utils"

describe("cn", () => {
  it("mescla classes condicionais e resolve conflitos do Tailwind", () => {
    expect(cn("p-2", false && "hidden", "p-4")).toBe("p-4")
  })
})

describe("rgbToHex", () => {
  it("converts RGB components to hex", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000")
    expect(rgbToHex(0, 128, 255)).toBe("#0080ff")
    expect(rgbToHex(0, 0, 0)).toBe("#000000")
  })

  it("limita componentes fora do intervalo 0-255", () => {
    expect(rgbToHex(300, -5, 0)).toBe("#ff0000")
  })

  it("rounds fractional components", () => {
    expect(rgbToHex(127.6, 0.4, 255)).toBe("#8000ff")
  })
})

describe("hexToRgb", () => {
  it("converts hex with and without '#'", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0])
    expect(hexToRgb("0080ff")).toEqual([0, 128, 255])
  })

  it("accepts uppercase letters", () => {
    expect(hexToRgb("#FF00AA")).toEqual([255, 0, 170])
  })

  it("returns null for invalid input", () => {
    expect(hexToRgb("")).toBeNull()
    expect(hexToRgb("#fff")).toBeNull() // short form is not supported
    expect(hexToRgb("#gggggg")).toBeNull()
    expect(hexToRgb("vermelho")).toBeNull()
  })

  it("round-trips with rgbToHex", () => {
    for (const [r, g, b] of [
      [255, 0, 0],
      [0, 128, 255],
      [12, 200, 99],
    ] as const) {
      expect(hexToRgb(rgbToHex(r, g, b))).toEqual([r, g, b])
    }
  })
})

describe("rgbToHsl", () => {
  it("converts primary colors", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50])
    expect(rgbToHsl(0, 255, 0)).toEqual([120, 100, 50])
    expect(rgbToHsl(0, 0, 255)).toEqual([240, 100, 50])
  })

  it("treats grays as achromatic (zero saturation)", () => {
    expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 50])
    expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0])
    expect(rgbToHsl(255, 255, 255)).toEqual([0, 0, 100])
  })
})

describe("hslToRgb", () => {
  it("converts primary colors", () => {
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0])
    expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0])
    expect(hslToRgb(240, 100, 50)).toEqual([0, 0, 255])
  })

  it("returns gray for zero saturation", () => {
    expect(hslToRgb(180, 0, 50)).toEqual([128, 128, 128])
  })

  it("round-trips with rgbToHsl", () => {
    for (const rgb of [
      [255, 0, 0],
      [0, 128, 255],
      [90, 45, 200],
    ] as const) {
      const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
      const back = hslToRgb(h, s, l)
      // Rounding H/S/L introduces a small per-component error
      back.forEach((v, i) => expect(Math.abs(v - rgb[i])).toBeLessThanOrEqual(3))
    }
  })
})
