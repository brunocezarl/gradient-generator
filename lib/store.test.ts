import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useGradientStore, resolveActiveColors } from "@/lib/store"

// Snapshot do estado inicial para restaurar entre testes
const initialState = useGradientStore.getState()

let now = 0

beforeEach(() => {
  // Controlar Date.now para testar a coalescência de histórico de forma
  // determinística (e isolar o estado de coalescência entre testes)
  now = 1_000_000
  vi.spyOn(Date, "now").mockImplementation(() => now)

  useGradientStore.setState(
    {
      ...initialState,
      customColors: { ...initialState.customColors },
      colorSchemes: { ...initialState.colorSchemes },
      layers: [...initialState.layers],
      past: [],
      future: [],
    },
    true
  )
  // Garantir que a próxima edição não seja coalescida com a de um teste anterior
  useGradientStore.getState().pushHistory()
  useGradientStore.setState({ past: [], future: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const advance = (ms: number) => {
  now += ms
}

describe("resetToDefaults", () => {
  it("restaura os parâmetros padrão", () => {
    const store = useGradientStore.getState()
    store.setSpeed(2.5)
    store.setComplexity(8)
    store.setFlowIntensity(0.9)

    useGradientStore.getState().resetToDefaults()

    const state = useGradientStore.getState()
    expect(state.speed).toBe(1.0)
    expect(state.complexity).toBe(3)
    expect(state.flowIntensity).toBe(0.3)
  })

  it("preserva esquemas de cores salvos pelo usuário", () => {
    useGradientStore.getState().saveCustomScheme("Meu Esquema")
    const savedKey = useGradientStore.getState().colorScheme
    expect(savedKey).toMatch(/^custom_/)

    useGradientStore.getState().resetToDefaults()

    const state = useGradientStore.getState()
    expect(state.colorSchemes[savedKey]).toBeDefined()
    expect(state.colorSchemes[savedKey].name).toBe("Meu Esquema")
    expect(state.colorScheme).toBe("redBlue")
  })

  it("preserva as camadas e o modo multi-camadas", () => {
    useGradientStore.getState().setMultiLayerMode(true)
    useGradientStore.getState().addLayer()
    const layersBefore = useGradientStore.getState().layers

    useGradientStore.getState().resetToDefaults()

    const state = useGradientStore.getState()
    expect(state.multiLayerMode).toBe(true)
    expect(state.layers).toEqual(layersBefore)
  })
})

describe("undo/redo com coalescência", () => {
  it("agrupa edições contínuas do mesmo controle em um único passo", () => {
    const store = useGradientStore.getState()
    store.setSpeed(1.1)
    advance(100)
    useGradientStore.getState().setSpeed(1.2)
    advance(100)
    useGradientStore.getState().setSpeed(1.3)

    expect(useGradientStore.getState().past).toHaveLength(1)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
  })

  it("cria um novo passo após a janela de coalescência", () => {
    useGradientStore.getState().setSpeed(1.5)
    advance(2000)
    useGradientStore.getState().setSpeed(2.0)

    expect(useGradientStore.getState().past).toHaveLength(2)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.5)
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
  })

  it("cria passos separados para controles diferentes", () => {
    useGradientStore.getState().setSpeed(1.5)
    advance(100)
    useGradientStore.getState().setComplexity(7)

    expect(useGradientStore.getState().past).toHaveLength(2)
  })

  it("redo refaz o que foi desfeito", () => {
    useGradientStore.getState().setSpeed(2.0)
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)

    useGradientStore.getState().redo()
    expect(useGradientStore.getState().speed).toBe(2.0)
  })

  it("undo sem histórico é um no-op", () => {
    const before = useGradientStore.getState().speed
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(before)
  })

  it("limita o histórico a 50 estados", () => {
    for (let i = 0; i < 60; i++) {
      advance(2000)
      useGradientStore.getState().setSpeed(1 + (i % 9) / 10)
    }
    expect(useGradientStore.getState().past.length).toBeLessThanOrEqual(50)
  })
})

describe("importSettings", () => {
  it("aplica configurações válidas com clamping", () => {
    useGradientStore.getState().importSettings({
      speed: 99,
      complexity: -5,
      noiseScale: 0.001,
      colorScheme: "neon",
      isCustomMode: false,
      customColors: { color1: [0.1, 0.2, 0.3], color2: [0.4, 0.5, 0.6] },
    })

    const state = useGradientStore.getState()
    expect(state.speed).toBe(3.0)
    expect(state.complexity).toBe(1)
    expect(state.noiseScale).toBe(0.5)
    expect(state.colorScheme).toBe("neon")
  })

  it("usa fallback para esquema de cores desconhecido", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "esquema_que_nao_existe",
      isCustomMode: false,
      customColors: { color1: [0, 0, 0], color2: [1, 1, 1] },
    })

    expect(useGradientStore.getState().colorScheme).toBe("redBlue")
  })

  it("valida e limita as cores customizadas; usa fallback para color3 ausente", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: true,
      customColors: { color1: [5, -1, 0.5], color2: [0.1, 0.2, 0.3] },
    })

    const { customColors } = useGradientStore.getState()
    expect(customColors.color1).toEqual([1, 0, 0.5])
    expect(customColors.color2).toEqual([0.1, 0.2, 0.3])
    expect(customColors.color3).toEqual([0.5, 0.0, 0.5])
  })

  it("rejeita cores malformadas", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: true,
      // @ts-expect-error — simula payload externo inválido
      customColors: { color1: "vermelho", color2: [0.1] },
    })

    const { customColors } = useGradientStore.getState()
    expect(customColors.color1).toEqual([0.9, 0.1, 0.1])
    expect(customColors.color2).toEqual([0.0, 0.0, 0.9])
  })
})

describe("resolveActiveColors", () => {
  it("retorna as cores customizadas em modo custom", () => {
    const state = useGradientStore.getState()
    expect(resolveActiveColors({ ...state, isCustomMode: true })).toBe(state.customColors)
  })

  it("resolve o esquema nomeado", () => {
    const state = useGradientStore.getState()
    expect(resolveActiveColors({ ...state, isCustomMode: false, colorScheme: "neon" })).toBe(
      state.colorSchemes.neon
    )
  })

  it("usa fallback para esquema inexistente", () => {
    const state = useGradientStore.getState()
    const resolved = resolveActiveColors({
      ...state,
      isCustomMode: false,
      colorScheme: "nao_existe",
    })
    expect(resolved).toBe(state.colorSchemes.redBlue)
  })
})

describe("randomize", () => {
  it("gera valores dentro dos limites dos controles", () => {
    for (let i = 0; i < 20; i++) {
      advance(2000)
      useGradientStore.getState().randomize()
      const state = useGradientStore.getState()
      expect(state.speed).toBeGreaterThanOrEqual(0.1)
      expect(state.speed).toBeLessThanOrEqual(3.0)
      expect(state.complexity).toBeGreaterThanOrEqual(1)
      expect(state.complexity).toBeLessThanOrEqual(10)
      expect(state.thresholdMax).toBeGreaterThan(state.thresholdMin)
      expect(state.isCustomMode).toBe(true)
    }
  })
})

describe("camadas", () => {
  it("não remove a última camada", () => {
    const state = useGradientStore.getState()
    expect(state.layers).toHaveLength(1)
    state.removeLayer(state.layers[0].id)
    expect(useGradientStore.getState().layers).toHaveLength(1)
  })

  it("reorderLayers ignora ids desconhecidos", () => {
    useGradientStore.getState().addLayer()
    const ids = useGradientStore.getState().layers.map((l) => l.id)
    useGradientStore.getState().reorderLayers([ids[1], "id_falso", ids[0]])

    const reordered = useGradientStore.getState().layers.map((l) => l.id)
    expect(reordered).toEqual([ids[1], ids[0]])
  })
})
