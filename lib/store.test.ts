// @vitest-environment happy-dom
// (o middleware zustand/persist exige window.localStorage; sem DOM ele se
// desabilita silenciosamente e a API useGradientStore.persist não existe)
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

describe("setThresholdMax", () => {
  it("mantém thresholdMax pelo menos 0.1 acima de thresholdMin", () => {
    useGradientStore.getState().setThresholdMin(0.5)
    advance(2000)
    useGradientStore.getState().setThresholdMax(0.2)

    const state = useGradientStore.getState()
    expect(state.thresholdMax).toBeCloseTo(0.6)
  })

  it("aceita valores acima do mínimo sem alteração", () => {
    useGradientStore.getState().setThresholdMax(0.9)
    expect(useGradientStore.getState().thresholdMax).toBe(0.9)
  })
})

describe("applyAnimationPreset", () => {
  it("aplica os parâmetros do preset e desativa o modo custom", () => {
    useGradientStore.getState().setCustomMode(true)
    advance(2000)
    useGradientStore.getState().applyAnimationPreset("energetic")

    const state = useGradientStore.getState()
    expect(state.speed).toBe(2.0)
    expect(state.complexity).toBe(5)
    expect(state.noiseScale).toBe(3.0)
    expect(state.colorScheme).toBe("neon")
    expect(state.isCustomMode).toBe(false)
  })

  it("registra um passo de histórico desfazível", () => {
    useGradientStore.getState().applyAnimationPreset("calm")
    expect(useGradientStore.getState().speed).toBe(0.5)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
  })

  it("é no-op para preset desconhecido", () => {
    const before = useGradientStore.getState()
    useGradientStore.getState().applyAnimationPreset("preset_falso")

    const after = useGradientStore.getState()
    expect(after.speed).toBe(before.speed)
    expect(after.past).toHaveLength(0)
  })
})

describe("saveCustomScheme", () => {
  it("salva uma cópia isolada das cores customizadas", () => {
    useGradientStore.getState().setCustomColor1([0.2, 0.3, 0.4])
    useGradientStore.getState().saveCustomScheme("Congelado")
    const savedKey = useGradientStore.getState().colorScheme

    // Editar as cores customizadas depois não pode alterar o esquema salvo
    advance(2000)
    useGradientStore.getState().setCustomColor1([0.9, 0.9, 0.9])

    const saved = useGradientStore.getState().colorSchemes[savedKey]
    expect(saved.color1).toEqual([0.2, 0.3, 0.4])
    expect(saved.name).toBe("Congelado")
  })
})

describe("persistência", () => {
  it("não persiste o histórico de undo/redo", () => {
    useGradientStore.getState().setSpeed(2.0)
    const { partialize } = useGradientStore.persist.getOptions()
    const persisted = partialize!(useGradientStore.getState()) as Record<string, unknown>

    expect(persisted).not.toHaveProperty("past")
    expect(persisted).not.toHaveProperty("future")
    expect(persisted).toHaveProperty("speed", 2.0)
    expect(persisted).toHaveProperty("layers")
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

  it("addLayer torna a nova camada ativa", () => {
    useGradientStore.getState().addLayer()
    const state = useGradientStore.getState()
    expect(state.layers).toHaveLength(2)
    expect(state.activeLayerId).toBe(state.layers[1].id)
  })

  it("remover a camada ativa move a seleção para uma camada restante", () => {
    useGradientStore.getState().addLayer()
    const active = useGradientStore.getState().activeLayerId
    useGradientStore.getState().removeLayer(active)

    const state = useGradientStore.getState()
    expect(state.layers).toHaveLength(1)
    expect(state.activeLayerId).toBe(state.layers[0].id)
    expect(state.activeLayerId).not.toBe(active)
  })

  it("remover uma camada inativa preserva a seleção", () => {
    useGradientStore.getState().addLayer()
    const [first, second] = useGradientStore.getState().layers
    useGradientStore.getState().setActiveLayer(second.id)
    useGradientStore.getState().removeLayer(first.id)

    expect(useGradientStore.getState().activeLayerId).toBe(second.id)
  })

  it("updateLayer altera apenas a camada alvo", () => {
    useGradientStore.getState().addLayer()
    const [first, second] = useGradientStore.getState().layers
    useGradientStore.getState().updateLayer(first.id, { opacity: 0.5, blendMode: "multiply" })

    const [updatedFirst, untouchedSecond] = useGradientStore.getState().layers
    expect(updatedFirst.opacity).toBe(0.5)
    expect(updatedFirst.blendMode).toBe("multiply")
    expect(untouchedSecond.opacity).toBe(second.opacity)
    expect(untouchedSecond.blendMode).toBe("normal")
  })

  it("moveLayer troca camadas adjacentes nas duas direções", () => {
    useGradientStore.getState().addLayer()
    const [a, b] = useGradientStore.getState().layers.map((l) => l.id)

    useGradientStore.getState().moveLayer(b, "up")
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([b, a])

    useGradientStore.getState().moveLayer(b, "down")
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([a, b])
  })

  it("moveLayer é no-op nas bordas e para id desconhecido", () => {
    useGradientStore.getState().addLayer()
    const ids = useGradientStore.getState().layers.map((l) => l.id)

    useGradientStore.getState().moveLayer(ids[0], "up")
    useGradientStore.getState().moveLayer(ids[1], "down")
    useGradientStore.getState().moveLayer("id_falso", "up")

    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual(ids)
  })
})
