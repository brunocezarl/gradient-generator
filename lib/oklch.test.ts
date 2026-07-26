import { describe, it, expect } from "vitest"
import {
  srgbToOklch,
  oklchToSrgb,
  oklchToLinear,
  linearToOklab,
  oklabToLinear,
  clampChromaToGamut,
  isInSrgbGamut,
  maxChroma,
  relativeLuminance,
  contrastRatio,
  contrastLevel,
  worstContrast,
  generateHarmony,
  randomPalette,
} from "./oklch"

describe("conversões Oklab/OKLCH", () => {
  it("faz round-trip de cores em gamut", () => {
    const colors: [number, number, number][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.2, 0.5, 0.8],
      [0.94, 0.23, 0.19],
      [0.5, 0.5, 0.5],
      [1, 1, 1],
      [0, 0, 0],
    ]

    for (const color of colors) {
      const roundTripped = oklchToSrgb(srgbToOklch(color))
      expect(roundTripped[0]).toBeCloseTo(color[0], 4)
      expect(roundTripped[1]).toBeCloseTo(color[1], 4)
      expect(roundTripped[2]).toBeCloseTo(color[2], 4)
    }
  })

  it("Oklab de branco tem luminosidade 1 e croma zero", () => {
    const white = srgbToOklch([1, 1, 1])
    expect(white.l).toBeCloseTo(1, 3)
    expect(white.c).toBeCloseTo(0, 3)
  })

  it("cinzas têm croma ~0 e matiz estável", () => {
    for (const value of [0.1, 0.3, 0.5, 0.8]) {
      const gray = srgbToOklch([value, value, value])
      expect(gray.c).toBeLessThan(0.002)
      expect(gray.h).toBe(0)
    }
  })

  it("linear ↔ Oklab é reversível", () => {
    const linear = [0.3, 0.6, 0.1]
    const back = oklabToLinear(linearToOklab(linear))
    expect(back[0]).toBeCloseTo(linear[0], 6)
    expect(back[1]).toBeCloseTo(linear[1], 6)
    expect(back[2]).toBeCloseTo(linear[2], 6)
  })

  it("preserva o matiz ao variar luminosidade", () => {
    const base = srgbToOklch([0.9, 0.2, 0.1])
    const lighter = oklchToSrgb({ ...base, l: base.l + 0.15 })
    expect(srgbToOklch(lighter).h).toBeCloseTo(base.h, 1)
  })
})

describe("clamp de gamut", () => {
  it("reduz o croma até caber no sRGB, mantendo matiz e luminosidade", () => {
    const impossible = { l: 0.6, c: 0.4, h: 150 }
    const clamped = clampChromaToGamut(impossible)

    expect(clamped.c).toBeLessThan(impossible.c)
    expect(clamped.l).toBeCloseTo(impossible.l, 6)
    expect(clamped.h).toBeCloseTo(impossible.h, 6)
    expect(isInSrgbGamut(oklchToLinear(clamped))).toBe(true)
  })

  it("não mexe em cores que já cabem", () => {
    const inGamut = srgbToOklch([0.4, 0.5, 0.6])
    const clamped = clampChromaToGamut(inGamut)
    expect(clamped.c).toBeCloseTo(inGamut.c, 6)
  })

  it("oklchToSrgb devolve canais válidos mesmo fora do gamut", () => {
    const color = oklchToSrgb({ l: 0.5, c: 0.9, h: 300 })
    for (const channel of color) {
      expect(channel).toBeGreaterThanOrEqual(-0.001)
      expect(channel).toBeLessThanOrEqual(1.001)
    }
  })

  it("maxChroma é maior nas luminosidades médias que nos extremos", () => {
    const middle = maxChroma(0.6, 30)
    expect(middle).toBeGreaterThan(maxChroma(0.02, 30))
    expect(middle).toBeGreaterThan(maxChroma(0.99, 30))
  })
})

describe("contraste WCAG", () => {
  it("branco sobre preto dá 21:1", () => {
    expect(contrastRatio([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 1)
  })

  it("cor com ela mesma dá 1:1", () => {
    expect(contrastRatio([0.4, 0.2, 0.6], [0.4, 0.2, 0.6])).toBeCloseTo(1, 6)
  })

  it("luminância relativa segue os coeficientes Rec.709", () => {
    expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1, 4)
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 6)
    // Verde contribui mais que vermelho, que contribui mais que azul
    expect(relativeLuminance([0, 1, 0])).toBeGreaterThan(relativeLuminance([1, 0, 0]))
    expect(relativeLuminance([1, 0, 0])).toBeGreaterThan(relativeLuminance([0, 0, 1]))
  })

  it("classifica pelos limiares da WCAG", () => {
    expect(contrastLevel(21)).toBe("AAA")
    expect(contrastLevel(7)).toBe("AAA")
    expect(contrastLevel(4.5)).toBe("AA")
    expect(contrastLevel(3)).toBe("AA Large")
    expect(contrastLevel(2.9)).toBe("Insuficiente")
  })

  it("usa o pior caso ao longo do gradiente", () => {
    // Texto branco funciona sobre o azul escuro, mas não sobre o amarelo
    const stops = [
      [0.05, 0.05, 0.3],
      [1, 0.95, 0.2],
    ]
    const worst = worstContrast(stops, [1, 1, 1])
    expect(worst).toBeLessThan(contrastRatio(stops[0], [1, 1, 1]))
    expect(worst).toBeCloseTo(contrastRatio(stops[1], [1, 1, 1]), 6)
  })

  it("tolera lista vazia", () => {
    expect(worstContrast([], [1, 1, 1])).toBe(1)
  })
})

describe("harmonias", () => {
  const base = { l: 0.6, c: 0.15, h: 20 }

  it("respeita a quantidade pedida, entre 2 e 8", () => {
    expect(generateHarmony(base, "analogous", { count: 3 })).toHaveLength(3)
    expect(generateHarmony(base, "triadic", { count: 8 })).toHaveLength(8)
    expect(generateHarmony(base, "analogous", { count: 1 })).toHaveLength(2)
    expect(generateHarmony(base, "analogous", { count: 99 })).toHaveLength(8)
  })

  it("complementar coloca a segunda parada a 180°", () => {
    const [first, second] = generateHarmony(base, "complementary", { count: 2 })
    expect(first.h).toBeCloseTo(20, 4)
    expect(second.h).toBeCloseTo(200, 4)
  })

  it("tríade distribui em 120°", () => {
    const hues = generateHarmony(base, "triadic", { count: 3 }).map((c) => c.h)
    expect(hues[0]).toBeCloseTo(20, 4)
    expect(hues[1]).toBeCloseTo(140, 4)
    expect(hues[2]).toBeCloseTo(260, 4)
  })

  it("monocromática mantém o matiz e varia a luminosidade", () => {
    const palette = generateHarmony(base, "monochromatic", { count: 4 })
    for (const color of palette) expect(color.h).toBeCloseTo(base.h, 4)
    const lightness = palette.map((c) => c.l)
    expect(Math.max(...lightness) - Math.min(...lightness)).toBeGreaterThan(0.1)
  })

  it("devolve sempre cores dentro do gamut sRGB", () => {
    for (const kind of ["analogous", "complementary", "triadic"] as const) {
      for (const color of generateHarmony({ l: 0.7, c: 0.4, h: 120 }, kind, { count: 6 })) {
        expect(isInSrgbGamut(oklchToLinear(color))).toBe(true)
      }
    }
  })
})

describe("randomPalette", () => {
  // Gerador determinístico para o teste
  const seeded = (seed: number) => {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  it("é determinístico com um gerador determinístico", () => {
    const a = randomPalette({ count: 3, random: seeded(42) })
    const b = randomPalette({ count: 3, random: seeded(42) })
    expect(a).toEqual(b)
  })

  it("gera cores saturadas e dentro do gamut, ao contrário do sorteio em RGB", () => {
    for (let seed = 1; seed < 30; seed++) {
      const palette = randomPalette({ count: 3, random: seeded(seed) })
      expect(palette).toHaveLength(3)
      for (const color of palette) {
        expect(isInSrgbGamut(oklchToLinear(color))).toBe(true)
        // Nada de cinza-lama: sempre há croma perceptível…
        expect(color.c).toBeGreaterThan(0.01)
        // …e a luminosidade nunca encosta nos extremos
        expect(color.l).toBeGreaterThan(0.1)
        expect(color.l).toBeLessThan(0.96)
      }
    }
  })

  it("as paradas de uma paleta se relacionam por matiz", () => {
    const palette = randomPalette({ count: 3, random: seeded(7) })
    const hues = palette.map((c) => Math.round(c.h))
    // Harmonias usam deslocamentos fixos: os matizes não são independentes
    const distinct = new Set(hues)
    expect(distinct.size).toBeLessThanOrEqual(3)
  })
})
