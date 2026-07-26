import { describe, it, expect } from "vitest"
import {
  MAX_STOPS,
  MIN_STOPS,
  evenlySpacedPositions,
  insertStop,
  legacyColorsToStops,
  mixStopColors,
  normalizeStops,
  removeStopAt,
  sortStops,
  stopToHex,
  stopsFromColors,
  stopsToCss,
  updateStopColor,
  updateStopPosition,
  type ColorStop,
} from "./color-stops"

const stop = (r: number, g: number, b: number, position: number): ColorStop => ({
  color: [r, g, b],
  position,
})

describe("stopsFromColors", () => {
  it("distribui as paradas uniformemente", () => {
    const stops = stopsFromColors([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
    expect(stops.map((s) => s.position)).toEqual([0, 0.5, 1])
  })

  it("aceita posições explícitas e satura canais", () => {
    const stops = stopsFromColors([[2, -1, 0.5]], [0.3])
    expect(stops[0]).toEqual({ color: [1, 0, 0.5], position: 0.3 })
  })

  it("duas paradas ficam nos extremos", () => {
    expect(evenlySpacedPositions(2)).toEqual([0, 1])
    expect(evenlySpacedPositions(1)).toEqual([0])
  })
})

describe("normalizeStops", () => {
  const fallback = stopsFromColors([
    [1, 1, 1],
    [0, 0, 0],
  ])

  it("ordena por posição", () => {
    const normalized = normalizeStops(
      [stop(1, 0, 0, 0.8), stop(0, 1, 0, 0.1), stop(0, 0, 1, 0.5)],
      fallback
    )
    expect(normalized.map((s) => s.position)).toEqual([0.1, 0.5, 0.8])
  })

  it("satura posições e canais fora de 0-1", () => {
    const normalized = normalizeStops([stop(5, -2, 0.4, 9), stop(0, 0, 0, -3)], fallback)
    expect(normalized[0]).toEqual({ color: [0, 0, 0], position: 0 })
    expect(normalized[1]).toEqual({ color: [1, 0, 0.4], position: 1 })
  })

  it("descarta paradas inválidas e cai no fallback quando sobram poucas", () => {
    expect(normalizeStops([{ color: ["a", 0, 0], position: 0 }], fallback)).toEqual(fallback)
    expect(normalizeStops("lixo", fallback)).toEqual(fallback)
    expect(normalizeStops(undefined, fallback)).toEqual(fallback)
    expect(normalizeStops([], fallback)).toEqual(fallback)
  })

  it("limita ao máximo de paradas do shader", () => {
    const many = Array.from({ length: 20 }, (_, i) => stop(1, 0, 0, i / 19))
    expect(normalizeStops(many, fallback)).toHaveLength(MAX_STOPS)
  })

  it("preenche posição ausente distribuindo uniformemente", () => {
    const normalized = normalizeStops(
      [{ color: [1, 0, 0] }, { color: [0, 0, 1] }],
      fallback
    )
    expect(normalized.map((s) => s.position)).toEqual([0, 1])
  })

  it("não devolve a mesma referência do fallback (evita alias de estado)", () => {
    const normalized = normalizeStops("lixo", fallback)
    expect(normalized).not.toBe(fallback)
    expect(normalized[0]).not.toBe(fallback[0])
  })
})

describe("insertStop", () => {
  it("insere no maior intervalo com a cor que já estava ali", () => {
    const stops = [stop(1, 0, 0, 0), stop(0, 0, 1, 0.2), stop(0, 1, 0, 1)]
    const result = insertStop(stops)

    expect(result).toHaveLength(4)
    // Maior vão é 0.2 → 1
    expect(result[2].position).toBeCloseTo(0.6)
    // Cor interpolada entre azul e verde, não uma cor nova qualquer
    const [r, g, b] = result[2].color
    expect(b).toBeGreaterThan(0.1)
    expect(g).toBeGreaterThan(0.1)
    expect(r).toBeLessThan(0.6)
  })

  it("não passa do máximo de paradas", () => {
    const full = Array.from({ length: MAX_STOPS }, (_, i) => stop(1, 0, 0, i / (MAX_STOPS - 1)))
    expect(insertStop(full)).toHaveLength(MAX_STOPS)
  })

  it("devolve paradas ordenadas", () => {
    const result = insertStop([stop(1, 0, 0, 1), stop(0, 0, 1, 0)])
    expect(result.map((s) => s.position)).toEqual([0, 0.5, 1])
  })
})

describe("removeStopAt", () => {
  it("remove a parada indicada", () => {
    const stops = [stop(1, 0, 0, 0), stop(0, 1, 0, 0.5), stop(0, 0, 1, 1)]
    const result = removeStopAt(stops, 1)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.position)).toEqual([0, 1])
  })

  it("respeita o mínimo de paradas", () => {
    const stops = [stop(1, 0, 0, 0), stop(0, 0, 1, 1)]
    expect(removeStopAt(stops, 0)).toHaveLength(MIN_STOPS)
  })
})

describe("updateStop", () => {
  const stops = [stop(1, 0, 0, 0), stop(0, 0, 1, 1)]

  it("troca a cor sem mexer na posição", () => {
    const result = updateStopColor(stops, 1, [0, 1, 0])
    expect(result[1]).toEqual({ color: [0, 1, 0], position: 1 })
    expect(result[0]).toEqual(stops[0])
  })

  it("move a parada sem reordenar a lista", () => {
    // Reordenar no meio do arraste faria o slider pular de parada na mão do
    // usuário: a ordenação é responsabilidade do render
    const result = updateStopPosition(stops, 1, 0)
    expect(result.map((s) => s.position)).toEqual([0, 0])
    expect(result[1].color).toEqual([0, 0, 1])
  })

  it("satura valores fora da faixa", () => {
    expect(updateStopPosition(stops, 0, 5)[0].position).toBe(1)
    expect(updateStopColor(stops, 0, [-1, 2, 0.5])[0].color).toEqual([0, 1, 0.5])
  })
})

describe("mixStopColors", () => {
  it("nos extremos devolve as cores originais", () => {
    const a: [number, number, number] = [0.9, 0.1, 0.1]
    const b: [number, number, number] = [0.1, 0.2, 0.9]
    expect(mixStopColors(a, b, 0)[0]).toBeCloseTo(a[0], 4)
    expect(mixStopColors(a, b, 1)[2]).toBeCloseTo(b[2], 4)
  })

  it("o meio entre azul e amarelo não escurece (mistura em Oklab)", () => {
    const middle = mixStopColors([1, 0.9, 0], [0, 0.2, 1], 0.5)
    const luma = 0.2126 * middle[0] + 0.7152 * middle[1] + 0.0722 * middle[2]
    // A interpolação ingênua em sRGB daria algo bem mais escuro que ~0.35
    expect(luma).toBeGreaterThan(0.3)
  })
})

describe("legacyColorsToStops", () => {
  it("converte três cores em paradas 0 / 0.5 / 1", () => {
    const stops = legacyColorsToStops({
      color1: [1, 0, 0],
      color2: [0, 1, 0],
      color3: [0, 0, 1],
    })
    expect(stops).toEqual([
      { color: [1, 0, 0], position: 0 },
      { color: [0, 1, 0], position: 0.5 },
      { color: [0, 0, 1], position: 1 },
    ])
  })

  it("aceita duas cores (esquemas mais antigos)", () => {
    const stops = legacyColorsToStops({ color1: [1, 0, 0], color2: [0, 0, 1] })
    expect(stops).toEqual([
      { color: [1, 0, 0], position: 0 },
      { color: [0, 0, 1], position: 1 },
    ])
  })

  it("devolve null quando não há cores suficientes", () => {
    expect(legacyColorsToStops(undefined)).toBeNull()
    expect(legacyColorsToStops({})).toBeNull()
    expect(legacyColorsToStops({ color1: [1, 0, 0] })).toBeNull()
  })
})

describe("stopsToCss", () => {
  const stops = [stop(1, 0, 0, 0), stop(0, 0, 1, 0.5), stop(0, 1, 0, 1)]

  it("gera as paradas com posição e o espaço de interpolação do render", () => {
    expect(stopsToCss(stops, "oklab")).toBe(
      "linear-gradient(135deg in oklab, #ff0000 0.0%, #0000ff 50.0%, #00ff00 100.0%)"
    )
    expect(stopsToCss(stops, "linear")).toContain("in srgb-linear")
  })

  it("ordena as paradas na saída", () => {
    const css = stopsToCss([stop(0, 1, 0, 1), stop(1, 0, 0, 0)])
    expect(css.indexOf("#ff0000")).toBeLessThan(css.indexOf("#00ff00"))
  })

  it("stopToHex satura e formata com 2 dígitos por canal", () => {
    expect(stopToHex(stop(0, 0, 0, 0))).toBe("#000000")
    expect(stopToHex(stop(1, 1, 1, 0))).toBe("#ffffff")
    expect(stopToHex(stop(2, -1, 0.5, 0))).toBe("#ff0080")
  })
})

describe("sortStops", () => {
  it("não muta a lista original", () => {
    const stops = [stop(0, 0, 1, 1), stop(1, 0, 0, 0)]
    const sorted = sortStops(stops)
    expect(sorted[0].position).toBe(0)
    expect(stops[0].position).toBe(1)
  })
})
