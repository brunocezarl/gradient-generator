import { describe, it, expect, beforeAll, vi } from "vitest"
import { createShareableURL, parseShareableURL } from "@/lib/share-utils"

beforeAll(() => {
  vi.stubGlobal("window", {
    location: { origin: "https://gradients.example", pathname: "/" },
  })
})

describe("createShareableURL / parseShareableURL", () => {
  it("faz round-trip dos parâmetros do gradiente", () => {
    const url = createShareableURL({
      speed: 2.5,
      complexity: 7,
      noiseScale: 3.5,
      colorScheme: "neon",
      isCustomMode: true,
      customColors: {
        color1: [0.1, 0.2, 0.3],
        color2: [0.4, 0.5, 0.6],
        color3: [0.7, 0.8, 0.9],
      },
    })

    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(2.5)
    expect(parsed!.complexity).toBe(7)
    expect(parsed!.noiseScale).toBe(3.5)
    expect(parsed!.colorScheme).toBe("neon")
    expect(parsed!.isCustomMode).toBe(true)
    expect(parsed!.customColors.color3).toEqual([0.7, 0.8, 0.9])
  })

  it("usa valores padrão para campos ausentes", () => {
    const url = createShareableURL({})
    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(1.0)
    expect(parsed!.colorScheme).toBe("redBlue")
    expect(parsed!.customColors.color3).toEqual([0.5, 0.0, 0.5])
  })

  it("preserva valores falsy legítimos (0 não vira o padrão)", () => {
    const url = createShareableURL({
      speed: 0,
      complexity: 0,
      noiseScale: 0,
      isCustomMode: false,
    })

    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(0)
    expect(parsed!.complexity).toBe(0)
    expect(parsed!.noiseScale).toBe(0)
    expect(parsed!.isCustomMode).toBe(false)
  })

  it("retorna null para URL sem parâmetro de gradiente", () => {
    expect(parseShareableURL("https://gradients.example/")).toBeNull()
  })

  it("retorna null para dados corrompidos", () => {
    expect(parseShareableURL("https://gradients.example/?gradient=%7Bnao-e-json")).toBeNull()
  })
})
