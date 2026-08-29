import { describe, it, expect, beforeAll, vi } from "vitest"
import { createShareableURL, parseShareableURL } from "@/lib/share-utils"
import type { GradientLayer } from "@/lib/layer-utils"

beforeAll(() => {
  vi.stubGlobal("window", {
    location: { origin: "https://gradients.example", pathname: "/" },
  })
})

describe("createShareableURL / parseShareableURL", () => {
  it("carries a running effect through a link", () => {
    const url = createShareableURL({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      customStops: [
        { color: [1, 0, 0], position: 0 },
        { color: [0, 0, 1], position: 1 },
      ],
      effect: "bloom",
      bloomThreshold: 0.45,
      bloomIntensity: 1.3,
      bloomRadius: 2.2,
    })

    const parsed = parseShareableURL(url)
    expect(parsed!.effect).toBe("bloom")
    expect(parsed!.bloomThreshold).toBe(0.45)
    expect(parsed!.bloomIntensity).toBe(1.3)
    expect(parsed!.bloomRadius).toBe(2.2)
  })

  it("keeps the effect settings out of a link with no effect", () => {
    const withEffect = createShareableURL({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      customStops: [{ color: [1, 0, 0], position: 0 }],
      effect: "bloom",
      bloomThreshold: 0.45,
      bloomIntensity: 1.3,
      bloomRadius: 2.2,
    })
    const without = createShareableURL({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      customStops: [{ color: [1, 0, 0], position: 0 }],
      effect: "none",
      bloomThreshold: 0.45,
      bloomIntensity: 1.3,
      bloomRadius: 2.2,
    })

    // Three numbers nobody will read are three numbers of URL — a link to a
    // plain gradient should not carry the settings of a chain that is off
    expect(without.length).toBeLessThan(withEffect.length)
    expect(parseShareableURL(without)!.effect).toBeUndefined()
    expect(parseShareableURL(without)!.bloomIntensity).toBeUndefined()
  })

  it("carries the tone controls through a link", () => {
    const url = createShareableURL({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      customStops: [
        { color: [1, 0, 0], position: 0 },
        { color: [0, 0, 1], position: 1 },
      ],
      exposure: -0.75,
      brightness: 0.12,
      contrast: 1.4,
    })

    const parsed = parseShareableURL(url)
    expect(parsed!.exposure).toBe(-0.75)
    expect(parsed!.brightness).toBe(0.12)
    expect(parsed!.contrast).toBe(1.4)
  })

  it("leaves tone undefined on a link that predates it", () => {
    // A v1 link, hand-built the way an older release wrote them: no tone keys at
    // all. They have to come back absent rather than zeroed, because
    // importSettings only overrides what the link actually carries — a link from
    // before the controls existed must not silently reset the tone in the app.
    const legacy = encodeURIComponent(
      JSON.stringify({
        speed: 1,
        complexity: 3,
        noiseScale: 2,
        colorScheme: "redBlue",
        isCustomMode: false,
      })
    )

    const parsed = parseShareableURL(`https://gradients.example/?gradient=${legacy}`)
    expect(parsed).not.toBeNull()
    expect(parsed!.exposure).toBeUndefined()
    expect(parsed!.brightness).toBeUndefined()
    expect(parsed!.contrast).toBeUndefined()
  })

  it("round-trips the gradient parameters", () => {
    const url = createShareableURL({
      speed: 2.5,
      complexity: 7,
      noiseScale: 3.5,
      colorScheme: "neon",
      isCustomMode: true,
      customStops: [
        { color: [0.1, 0.2, 0.3], position: 0 },
        { color: [0.4, 0.5, 0.6], position: 0.4 },
        { color: [0.7, 0.8, 0.9], position: 1 },
      ],
    })

    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(2.5)
    expect(parsed!.complexity).toBe(7)
    expect(parsed!.noiseScale).toBe(3.5)
    expect(parsed!.colorScheme).toBe("neon")
    expect(parsed!.isCustomMode).toBe(true)
    // Stops travel with their positions, not just the color
    expect(parsed!.stops).toEqual([
      { color: [0.1, 0.2, 0.3], position: 0 },
      { color: [0.4, 0.5, 0.6], position: 0.4 },
      { color: [0.7, 0.8, 0.9], position: 1 },
    ])
  })

  it("round-trips the advanced parameters", () => {
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

  it("includes layers when multi-layer mode is on", () => {
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
        customStops: [
          { color: [1, 0, 0], position: 0 },
          { color: [0, 0, 1], position: 0.25 },
          { color: [0, 1, 0], position: 1 },
        ],
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
    // ids are not shared — they get regenerated on import
    expect(parsed!.layers![0]).not.toHaveProperty("id")
    expect(parsed!.layers![0].blendMode).toBe("screen")
    expect(parsed!.layers![0].opacity).toBe(0.8)
    expect(parsed!.layers![1].visible).toBe(false)
    expect(parsed!.layers![1].customStops).toEqual([
      { color: [1, 0, 0], position: 0 },
      { color: [0, 0, 1], position: 0.25 },
      { color: [0, 1, 0], position: 1 },
    ])
    // The seed travels in the link: the noise shape is reproduced, not just colors
    expect(parsed!.layers![0].seed).toEqual([12.5, 7.25])
  })

  it("omits layers when multi-layer mode is off", () => {
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

  it("uses defaults for missing fields", () => {
    const url = createShareableURL({})
    const parsed = parseShareableURL(url)
    expect(parsed).not.toBeNull()
    expect(parsed!.speed).toBe(1.0)
    expect(parsed!.complexity).toBe(2)
    expect(parsed!.noiseScale).toBe(0.6)
    expect(parsed!.grainScale).toBe(780)
    expect(parsed!.colorScheme).toBe("redBlue")
    expect(parsed!.stops!).toEqual([
      { color: [0.9, 0.1, 0.1], position: 0 },
      { color: [0.0, 0.0, 0.9], position: 0.5 },
      { color: [0.5, 0.0, 0.5], position: 1 },
    ])
    expect(parsed!.flowIntensity).toBe(0.3)
    expect(parsed!.thresholdMax).toBe(0.7)
  })

  it("preserves legitimate falsy values (0 does not become the default)", () => {
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

  it("produces compact URLs (base64url query, no raw JSON)", () => {
    const url = createShareableURL({})
    expect(url).toContain("?g=")
    expect(url).not.toContain("%7B") // "{" url-encoded do formato antigo
    // Compact enough to paste into a chat without breaking
    expect(url.length).toBeLessThan(400)
  })

  it("still reads the legacy format (?gradient=<url-encoded JSON>)", () => {
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
    expect(parsed!.customColors!.color1).toEqual([0.1, 0.2, 0.3])
    // v2 fields simply do not exist in older links
    expect(parsed!.flowIntensity).toBeUndefined()
  })

  it("returns null for a URL with no gradient parameter", () => {
    expect(parseShareableURL("https://gradients.example/")).toBeNull()
  })

  it("returns null for corrupted data", () => {
    expect(parseShareableURL("https://gradients.example/?gradient=%7Bnao-e-json")).toBeNull()
    expect(parseShareableURL("https://gradients.example/?g=!!!nao-e-base64!!!")).toBeNull()
  })
})
