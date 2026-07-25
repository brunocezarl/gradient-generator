import { describe, it, expect, beforeAll, vi } from "vitest"
import { createShareableURL, parseShareableURL } from "@/lib/share-utils"
import type { GradientLayer } from "@/lib/layer-utils"

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

  it("faz round-trip dos parâmetros avançados", () => {
    const url = createShareableURL({
      speed: 1.0,
      flowIntensity: 0.75,
      grainAmount: 0.12,
      grainScale: 800,
      thresholdMin: 0.25,
      thresholdMax: 0.85,
    })

    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.flowIntensity).toBe(0.75)
    expect(parsed!.grainAmount).toBe(0.12)
    expect(parsed!.grainScale).toBe(800)
    expect(parsed!.thresholdMin).toBe(0.25)
    expect(parsed!.thresholdMax).toBe(0.85)
  })

  it("inclui camadas quando o modo multi-camadas está ativo", () => {
    const layers: GradientLayer[] = [
      {
        id: "layer_1",
        opacity: 0.8,
        blendMode: "screen",
        visible: true,
        colorScheme: "neon",
        isCustomMode: false,
        noiseScale: 1.5,
        flowIntensity: 0.4,
        thresholdMin: 0.2,
        thresholdMax: 0.8,
        seed: [12.5, 7.25],
      },
      {
        id: "layer_2",
        opacity: 0.5,
        blendMode: "overlay",
        visible: false,
        colorScheme: "redBlue",
        isCustomMode: true,
        customColors: { color1: [1, 0, 0], color2: [0, 0, 1], color3: [0, 1, 0] },
        noiseScale: 3.0,
        flowIntensity: 0.6,
        thresholdMin: 0.3,
        thresholdMax: 0.7,
        seed: [0, 0],
      },
    ]

    const url = createShareableURL({ multiLayerMode: true, layers })
    const parsed = parseShareableURL(url)

    expect(parsed).not.toBeNull()
    expect(parsed!.multiLayerMode).toBe(true)
    expect(parsed!.layers).toHaveLength(2)
    // ids não são compartilhados — são regenerados na importação
    expect(parsed!.layers![0]).not.toHaveProperty("id")
    expect(parsed!.layers![0].blendMode).toBe("screen")
    expect(parsed!.layers![0].opacity).toBe(0.8)
    expect(parsed!.layers![1].visible).toBe(false)
    expect(parsed!.layers![1].customColors).toEqual({
      color1: [1, 0, 0],
      color2: [0, 0, 1],
      color3: [0, 1, 0],
    })
    // O seed viaja no link: a forma do ruído é reproduzida, não só as cores
    expect(parsed!.layers![0].seed).toEqual([12.5, 7.25])
  })

  it("não inclui camadas quando o modo multi-camadas está inativo", () => {
    const url = createShareableURL({
      multiLayerMode: false,
      layers: [
        {
          id: "layer_1",
          opacity: 1,
          blendMode: "normal",
          visible: true,
          colorScheme: "redBlue",
          isCustomMode: false,
          noiseScale: 2,
          flowIntensity: 0.3,
          thresholdMin: 0.3,
          thresholdMax: 0.7,
          seed: [0, 0],
        },
      ],
    })

    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.multiLayerMode).toBeUndefined()
    expect(parsed!.layers).toBeUndefined()
  })

  it("usa valores padrão para campos ausentes", () => {
    const url = createShareableURL({})
    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(1.0)
    expect(parsed!.colorScheme).toBe("redBlue")
    expect(parsed!.customColors.color3).toEqual([0.5, 0.0, 0.5])
    expect(parsed!.flowIntensity).toBe(0.3)
    expect(parsed!.thresholdMax).toBe(0.7)
  })

  it("preserva valores falsy legítimos (0 não vira o padrão)", () => {
    const url = createShareableURL({
      speed: 0,
      complexity: 0,
      noiseScale: 0,
      isCustomMode: false,
      grainAmount: 0,
    })

    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(0)
    expect(parsed!.complexity).toBe(0)
    expect(parsed!.noiseScale).toBe(0)
    expect(parsed!.isCustomMode).toBe(false)
    expect(parsed!.grainAmount).toBe(0)
  })

  it("gera URLs compactas (query base64url, sem JSON cru)", () => {
    const url = createShareableURL({})
    expect(url).toContain("?g=")
    expect(url).not.toContain("%7B") // "{" url-encoded do formato antigo
    // Compacto o suficiente para colar em chats sem quebrar
    expect(url.length).toBeLessThan(400)
  })

  it("ainda lê o formato legado (?gradient=<JSON url-encoded>)", () => {
    const legacy = {
      speed: 1.5,
      complexity: 4,
      noiseScale: 2.5,
      colorScheme: "neon",
      isCustomMode: false,
      customColors: {
        color1: [0.1, 0.2, 0.3],
        color2: [0.4, 0.5, 0.6],
      },
    }
    const url = `https://gradients.example/?gradient=${encodeURIComponent(JSON.stringify(legacy))}`

    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(1.5)
    expect(parsed!.colorScheme).toBe("neon")
    expect(parsed!.customColors.color1).toEqual([0.1, 0.2, 0.3])
    // Campos v2 simplesmente não existem em links antigos
    expect(parsed!.flowIntensity).toBeUndefined()
  })

  it("retorna null para URL sem parâmetro de gradiente", () => {
    expect(parseShareableURL("https://gradients.example/")).toBeNull()
  })

  it("retorna null para dados corrompidos", () => {
    expect(parseShareableURL("https://gradients.example/?gradient=%7Bnao-e-json")).toBeNull()
    expect(parseShareableURL("https://gradients.example/?g=!!!nao-e-base64!!!")).toBeNull()
  })
})
