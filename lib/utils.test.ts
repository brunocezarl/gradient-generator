import { describe, it, expect } from "vitest"
import { cn, rgbToHex, hexToRgb, rgbToHsl, hslToRgb } from "@/lib/utils"

describe("cn", () => {
  it("mescla classes condicionais e resolve conflitos do Tailwind", () => {
    expect(cn("p-2", false && "hidden", "p-4")).toBe("p-4")
  })
})

describe("rgbToHex", () => {
  it("converte componentes RGB para hex", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000")
    expect(rgbToHex(0, 128, 255)).toBe("#0080ff")
    expect(rgbToHex(0, 0, 0)).toBe("#000000")
  })

  it("limita componentes fora do intervalo 0-255", () => {
    expect(rgbToHex(300, -5, 0)).toBe("#ff0000")
  })

  it("arredonda componentes fracionários", () => {
    expect(rgbToHex(127.6, 0.4, 255)).toBe("#8000ff")
  })
})

describe("hexToRgb", () => {
  it("converte hex com e sem '#'", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0])
    expect(hexToRgb("0080ff")).toEqual([0, 128, 255])
  })

  it("aceita letras maiúsculas", () => {
    expect(hexToRgb("#FF00AA")).toEqual([255, 0, 170])
  })

  it("retorna null para entradas inválidas", () => {
    expect(hexToRgb("")).toBeNull()
    expect(hexToRgb("#fff")).toBeNull() // forma curta não suportada
    expect(hexToRgb("#gggggg")).toBeNull()
    expect(hexToRgb("vermelho")).toBeNull()
  })

  it("faz round-trip com rgbToHex", () => {
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
  it("converte cores primárias", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50])
    expect(rgbToHsl(0, 255, 0)).toEqual([120, 100, 50])
    expect(rgbToHsl(0, 0, 255)).toEqual([240, 100, 50])
  })

  it("trata cinzas como acromáticos (saturação 0)", () => {
    expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 50])
    expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0])
    expect(rgbToHsl(255, 255, 255)).toEqual([0, 0, 100])
  })
})

describe("hslToRgb", () => {
  it("converte cores primárias", () => {
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0])
    expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0])
    expect(hslToRgb(240, 100, 50)).toEqual([0, 0, 255])
  })

  it("retorna cinza para saturação 0", () => {
    expect(hslToRgb(180, 0, 50)).toEqual([128, 128, 128])
  })

  it("faz round-trip com rgbToHsl", () => {
    for (const rgb of [
      [255, 0, 0],
      [0, 128, 255],
      [90, 45, 200],
    ] as const) {
      const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
      const back = hslToRgb(h, s, l)
      // Arredondamentos de H/S/L introduzem pequeno erro por componente
      back.forEach((v, i) => expect(Math.abs(v - rgb[i])).toBeLessThanOrEqual(3))
    }
  })
})
