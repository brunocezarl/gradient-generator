// @vitest-environment happy-dom
// (o middleware zustand/persist exige window.localStorage; sem DOM ele se
// desabilita silenciosamente e a API useGradientStore.persist não existe)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  useGradientStore,
  resolveActiveColors,
  migratePersistedState,
  normalizePersistedState,
  PERSIST_VERSION,
} from "@/lib/store"

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

  it("aplica parâmetros avançados com clamping (links v2)", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      customColors: { color1: [0, 0, 0], color2: [1, 1, 1] },
      flowIntensity: 99,
      grainAmount: -1,
      grainScale: 700,
      thresholdMin: 0.5,
      thresholdMax: 0.2,
    })

    const state = useGradientStore.getState()
    expect(state.flowIntensity).toBe(1.0)
    expect(state.grainAmount).toBe(0)
    expect(state.grainScale).toBe(700)
    expect(state.thresholdMin).toBe(0.5)
    // thresholdMax é forçado a ficar acima de thresholdMin
    expect(state.thresholdMax).toBeCloseTo(0.6)
  })

  it("não altera parâmetros avançados ausentes (links v1)", () => {
    useGradientStore.getState().setFlowIntensity(0.8)
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      customColors: { color1: [0, 0, 0], color2: [1, 1, 1] },
    })

    expect(useGradientStore.getState().flowIntensity).toBe(0.8)
  })

  it("importa camadas com ids regenerados e blend mode validado", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      customColors: { color1: [0, 0, 0], color2: [1, 1, 1] },
      multiLayerMode: true,
      layers: [
        {
          opacity: 5,
          blendMode: "modo_invalido",
          visible: true,
          colorScheme: "esquema_que_nao_existe",
          isCustomMode: false,
          noiseScale: 1.5,
          flowIntensity: 0.4,
          thresholdMin: 0.2,
          thresholdMax: 0.8,
          seed: [0, 0],
        },
        {
          opacity: 0.5,
          blendMode: "screen",
          visible: false,
          colorScheme: "neon",
          isCustomMode: true,
          customColors: { color1: [1, 0, 0], color2: [0, 0, 1], color3: [0, 1, 0] },
          noiseScale: 3,
          flowIntensity: 0.6,
          thresholdMin: 0.3,
          thresholdMax: 0.7,
          seed: [3, 4],
        },
      ],
    })

    const state = useGradientStore.getState()
    expect(state.multiLayerMode).toBe(true)
    expect(state.layers).toHaveLength(2)
    expect(state.layers[0].opacity).toBe(1) // clampado
    expect(state.layers[0].blendMode).toBe("normal") // fallback
    expect(state.layers[0].colorScheme).toBe("redBlue") // fallback
    expect(state.layers[1].blendMode).toBe("screen")
    expect(state.layers[1].visible).toBe(false)
    expect(state.layers[0].id).not.toBe(state.layers[1].id)
    expect(state.activeLayerId).toBe(state.layers[0].id)
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

describe("presets completos", () => {
  it("salva uma cópia congelada do estado atual", () => {
    useGradientStore.getState().setSpeed(2.2)
    advance(2000)
    useGradientStore.getState().setFlowIntensity(0.7)
    useGradientStore.getState().saveCurrentPreset("Meu Visual")

    // Edições posteriores não podem alterar o preset salvo
    advance(2000)
    useGradientStore.getState().setSpeed(0.5)

    const [preset] = useGradientStore.getState().savedPresets
    expect(preset.name).toBe("Meu Visual")
    expect(preset.snapshot.speed).toBe(2.2)
    expect(preset.snapshot.flowIntensity).toBe(0.7)
  })

  it("applyPreset restaura todos os parâmetros e é desfazível", () => {
    useGradientStore.getState().setSpeed(2.2)
    advance(2000)
    useGradientStore.getState().setGrainAmount(0.15)
    useGradientStore.getState().saveCurrentPreset("Salvo")
    const presetId = useGradientStore.getState().savedPresets[0].id

    advance(2000)
    useGradientStore.getState().resetToDefaults()
    expect(useGradientStore.getState().speed).toBe(1.0)

    useGradientStore.getState().applyPreset(presetId)
    expect(useGradientStore.getState().speed).toBe(2.2)
    expect(useGradientStore.getState().grainAmount).toBe(0.15)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
  })

  it("applyPreset é no-op para id desconhecido", () => {
    const before = useGradientStore.getState().speed
    useGradientStore.getState().applyPreset("preset_falso")
    expect(useGradientStore.getState().speed).toBe(before)
  })

  it("deletePreset remove apenas o preset alvo", () => {
    useGradientStore.getState().saveCurrentPreset("A")
    advance(2000)
    useGradientStore.getState().saveCurrentPreset("B")

    const presets = useGradientStore.getState().savedPresets
    expect(presets).toHaveLength(2)

    useGradientStore.getState().deletePreset(presets[0].id)
    const remaining = useGradientStore.getState().savedPresets
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(presets[1].id)
  })
})

describe("histórico do randomizador", () => {
  it("guarda cada sorteio no histórico (mais recente primeiro)", () => {
    advance(2000)
    useGradientStore.getState().randomize()
    const firstSpeed = useGradientStore.getState().speed

    advance(2000)
    useGradientStore.getState().randomize()

    const history = useGradientStore.getState().randomHistory
    expect(history).toHaveLength(2)
    expect(history[1].speed).toBe(firstSpeed)
    expect(history[0].speed).toBe(useGradientStore.getState().speed)
  })

  it("limita o histórico a 10 sorteios", () => {
    for (let i = 0; i < 15; i++) {
      advance(2000)
      useGradientStore.getState().randomize()
    }
    expect(useGradientStore.getState().randomHistory).toHaveLength(10)
  })

  it("applySnapshot restaura um sorteio antigo e é desfazível", () => {
    advance(2000)
    useGradientStore.getState().randomize()
    const rolled = useGradientStore.getState().randomHistory[0]

    advance(2000)
    useGradientStore.getState().resetToDefaults()
    expect(useGradientStore.getState().speed).toBe(1.0)

    useGradientStore.getState().applySnapshot(rolled)
    const state = useGradientStore.getState()
    expect(state.speed).toBe(rolled.speed)
    expect(state.customColors.color1).toEqual(rolled.customColors.color1)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
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

  it("persiste presets salvos e histórico do randomizador", () => {
    useGradientStore.getState().saveCurrentPreset("Persistente")
    advance(2000)
    useGradientStore.getState().randomize()

    const { partialize } = useGradientStore.persist.getOptions()
    const persisted = partialize!(useGradientStore.getState()) as Record<string, unknown>

    expect(persisted).toHaveProperty("savedPresets")
    expect(persisted).toHaveProperty("randomHistory")
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

// ─── Histórico cobrindo camadas ──────────────────────────────────────────────

describe("undo/redo de camadas", () => {
  it("desfaz a criação de uma camada", () => {
    const store = useGradientStore.getState()
    expect(store.layers).toHaveLength(1)

    store.addLayer()
    expect(useGradientStore.getState().layers).toHaveLength(2)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers).toHaveLength(1)

    useGradientStore.getState().redo()
    expect(useGradientStore.getState().layers).toHaveLength(2)
  })

  it("desfaz a remoção de uma camada, restaurando seus parâmetros", () => {
    useGradientStore.getState().addLayer()
    const removed = useGradientStore.getState().layers[1]
    advance(2000)
    useGradientStore.getState().updateLayer(removed.id, { opacity: 0.42, blendMode: "screen" })

    useGradientStore.getState().removeLayer(removed.id)
    expect(useGradientStore.getState().layers).toHaveLength(1)

    useGradientStore.getState().undo()
    const restored = useGradientStore.getState().layers[1]
    expect(restored.id).toBe(removed.id)
    expect(restored.opacity).toBe(0.42)
    expect(restored.blendMode).toBe("screen")
  })

  it("desfaz a edição de uma camada", () => {
    const layerId = useGradientStore.getState().layers[0].id
    advance(2000)
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.3 })

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers[0].opacity).toBe(1)
  })

  it("coalesce arrastar o slider de uma camada em um único snapshot", () => {
    const layerId = useGradientStore.getState().layers[0].id
    advance(2000)
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.9 })
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.8 })
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.7 })

    expect(useGradientStore.getState().past).toHaveLength(1)
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers[0].opacity).toBe(1)
  })

  it("desfaz reordenação de camadas", () => {
    useGradientStore.getState().addLayer()
    const [a, b] = useGradientStore.getState().layers.map((l) => l.id)

    useGradientStore.getState().reorderLayers([b, a])
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([b, a])

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([a, b])
  })

  it("desfaz a ativação do modo multi-camadas", () => {
    useGradientStore.getState().setMultiLayerMode(true)
    expect(useGradientStore.getState().multiLayerMode).toBe(true)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().multiLayerMode).toBe(false)
  })

  it("mantém a camada ativa quando ela sobrevive ao undo", () => {
    useGradientStore.getState().addLayer()
    const secondId = useGradientStore.getState().layers[1].id
    advance(2000)
    useGradientStore.getState().updateLayer(secondId, { noiseScale: 4 })

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().activeLayerId).toBe(secondId)
  })

  it("novas camadas nascem com seed próprio, para não repetir a mesma forma", () => {
    useGradientStore.getState().addLayer()
    const [first, second] = useGradientStore.getState().layers
    expect(first.seed).toEqual([0, 0])
    expect(second.seed).not.toEqual(first.seed)
  })
})

describe("seed", () => {
  it("shuffleSeed troca a forma e é desfazível", () => {
    expect(useGradientStore.getState().seed).toEqual([0, 0])

    useGradientStore.getState().shuffleSeed()
    expect(useGradientStore.getState().seed).not.toEqual([0, 0])

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().seed).toEqual([0, 0])
  })

  it("randomize sorteia também a forma", () => {
    useGradientStore.getState().randomize()
    expect(useGradientStore.getState().seed).not.toEqual([0, 0])
  })

  it("resetToDefaults volta o seed para a origem", () => {
    useGradientStore.getState().shuffleSeed()
    useGradientStore.getState().resetToDefaults()
    expect(useGradientStore.getState().seed).toEqual([0, 0])
  })
})

describe("presets guardam a composição de camadas", () => {
  it("restaura camadas ao aplicar um preset", () => {
    useGradientStore.getState().addLayer()
    useGradientStore.getState().setMultiLayerMode(true)
    useGradientStore.getState().saveCurrentPreset("Duas camadas")

    useGradientStore.getState().removeLayer(useGradientStore.getState().layers[1].id)
    expect(useGradientStore.getState().layers).toHaveLength(1)

    const presetId = useGradientStore.getState().savedPresets[0].id
    useGradientStore.getState().applyPreset(presetId)
    expect(useGradientStore.getState().layers).toHaveLength(2)
    expect(useGradientStore.getState().multiLayerMode).toBe(true)
  })

  it("snapshot antigo sem camadas preserva as camadas atuais", () => {
    useGradientStore.getState().addLayer()
    const before = useGradientStore.getState().layers.map((l) => l.id)

    // Preset salvo antes de as camadas entrarem no snapshot
    const legacySnapshot = {
      speed: 2,
      complexity: 5,
      noiseScale: 3,
      colorScheme: "neon",
      isCustomMode: false,
      customColors: {
        color1: [1, 0, 0] as [number, number, number],
        color2: [0, 1, 0] as [number, number, number],
        color3: [0, 0, 1] as [number, number, number],
      },
      flowIntensity: 0.5,
      grainAmount: 0.1,
      grainScale: 400,
      thresholdMin: 0.2,
      thresholdMax: 0.8,
      vibrance: 0,
      blendSpace: "oklab" as const,
      seed: [0, 0] as [number, number],
    }

    useGradientStore.getState().applySnapshot(legacySnapshot)

    expect(useGradientStore.getState().speed).toBe(2)
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual(before)
  })
})

// ─── Migração da persistência ────────────────────────────────────────────────

describe("migratePersistedState", () => {
  // Estado como era gravado antes do pipeline de cor e do seed
  const v0State = () => ({
    speed: 1.5,
    complexity: 4,
    noiseScale: 2,
    colorScheme: "custom_123",
    isCustomMode: false,
    customColors: { color1: [1, 0, 0], color2: [0, 0, 1] },
    colorSchemes: {
      redBlue: { color1: [0.9, 0.1, 0.1], color2: [0, 0, 0.9], name: "Vermelho & Azul" },
      custom_123: { color1: [0.2, 0.4, 0.6], color2: [0.8, 0.2, 0.1], name: "Meu" },
    },
    flowIntensity: 0.3,
    grainAmount: 0.05,
    grainScale: 500,
    thresholdMin: 0.3,
    thresholdMax: 0.7,
    multiLayerMode: true,
    layers: [
      {
        id: "layer_1",
        opacity: 1,
        blendMode: "normal",
        visible: true,
        colorScheme: "redBlue",
        isCustomMode: true,
        customColors: { color1: [1, 1, 0], color2: [0, 1, 1] },
        noiseScale: 2,
        flowIntensity: 0.3,
        thresholdMin: 0.3,
        thresholdMax: 0.7,
      },
    ],
    activeLayerId: "layer_1",
    savedPresets: [
      {
        id: "preset_1",
        name: "Antigo",
        createdAt: 1,
        snapshot: {
          speed: 1,
          complexity: 3,
          noiseScale: 2,
          colorScheme: "redBlue",
          isCustomMode: false,
          customColors: { color1: [1, 0, 0], color2: [0, 0, 1] },
          flowIntensity: 0.3,
          grainAmount: 0.05,
          grainScale: 500,
          thresholdMin: 0.3,
          thresholdMax: 0.7,
        },
      },
    ],
    randomHistory: [
      {
        speed: 2,
        complexity: 6,
        noiseScale: 3,
        colorScheme: "neon",
        isCustomMode: true,
        customColors: { color1: [0.1, 0.2, 0.3], color2: [0.4, 0.5, 0.6] },
        flowIntensity: 0.5,
        grainAmount: 0.1,
        grainScale: 300,
        thresholdMin: 0.2,
        thresholdMax: 0.8,
      },
    ],
  })

  it("preenche os parâmetros de cor e o seed que não existiam", () => {
    const migrated = migratePersistedState(v0State(), 0) as Record<string, unknown>
    expect(migrated.vibrance).toBe(0)
    expect(migrated.blendSpace).toBe("oklab")
    expect(migrated.seed).toEqual([0, 0])
  })

  it("preserva os valores que já existiam", () => {
    const migrated = migratePersistedState(v0State(), 0) as Record<string, unknown>
    expect(migrated.speed).toBe(1.5)
    expect(migrated.grainScale).toBe(500)
    expect(migrated.colorScheme).toBe("custom_123")
  })

  it("dá aos esquemas de 2 cores uma 3ª parada igual à segunda", () => {
    const migrated = migratePersistedState(v0State(), 0) as {
      colorSchemes: Record<string, { color2: number[]; color3: number[]; name?: string }>
      customColors: { color2: number[]; color3: number[] }
    }
    // color3 = color2 mantém exatamente a aparência de duas cores que o
    // usuário havia salvo
    expect(migrated.colorSchemes.custom_123.color3).toEqual([0.8, 0.2, 0.1])
    expect(migrated.colorSchemes.custom_123.name).toBe("Meu")
    expect(migrated.colorSchemes.redBlue.color3).toEqual([0, 0, 0.9])
    expect(migrated.customColors.color3).toEqual([0, 0, 1])
  })

  it("dá seed e 3ª cor às camadas persistidas", () => {
    const migrated = migratePersistedState(v0State(), 0) as {
      layers: Array<{ seed: number[]; customColors: { color3: number[] } }>
    }
    expect(migrated.layers[0].seed).toEqual([0, 0])
    expect(migrated.layers[0].customColors.color3).toEqual([0, 1, 1])
  })

  it("migra snapshots de presets salvos e do histórico do randomizador", () => {
    const migrated = migratePersistedState(v0State(), 0) as {
      savedPresets: Array<{ name: string; snapshot: Record<string, unknown> }>
      randomHistory: Array<Record<string, unknown>>
    }
    const snapshot = migrated.savedPresets[0].snapshot
    expect(migrated.savedPresets[0].name).toBe("Antigo")
    expect(snapshot.vibrance).toBe(0)
    expect(snapshot.blendSpace).toBe("oklab")
    expect(snapshot.seed).toEqual([0, 0])
    expect((snapshot.customColors as { color3: number[] }).color3).toEqual([0, 0, 1])
    expect(migrated.randomHistory[0].seed).toEqual([0, 0])
    expect((migrated.randomHistory[0].customColors as { color3: number[] }).color3).toEqual([
      0.4, 0.5, 0.6,
    ])
  })

  it("descarta valores inválidos vindos do localStorage", () => {
    const corrupted = {
      ...v0State(),
      vibrance: "muito" as unknown as number,
      blendSpace: "espaço_inexistente",
      seed: ["a", null],
    }
    const migrated = migratePersistedState(corrupted, 0) as Record<string, unknown>
    expect(migrated.vibrance).toBe(0)
    expect(migrated.blendSpace).toBe("oklab")
    expect(migrated.seed).toEqual([0, 0])
  })

  it("não mexe em estados já na versão atual", () => {
    const current = { ...v0State(), vibrance: 0.4, blendSpace: "linear", seed: [5, 6] }
    const migrated = migratePersistedState(current, PERSIST_VERSION) as Record<string, unknown>
    expect(migrated.vibrance).toBe(0.4)
    expect(migrated.blendSpace).toBe("linear")
    expect(migrated.seed).toEqual([5, 6])
  })

  it("tolera estados vazios ou não-objeto", () => {
    expect(migratePersistedState(null, 0)).toBeNull()
    expect(migratePersistedState("lixo", 0)).toBe("lixo")
    expect(migratePersistedState({}, 0)).toEqual({
      vibrance: 0,
      blendSpace: "oklab",
      seed: [0, 0],
    })
  })
})

describe("normalizePersistedState", () => {
  // O zustand só chama `migrate` quando o JSON gravado tem `version` numérico;
  // as versões anteriores persistiam sem esse campo, então é a normalização no
  // `merge` que resgata o localStorage real dos usuários
  it("normaliza um estado gravado sem version", () => {
    const legacy = {
      speed: 1,
      customColors: { color1: [1, 0, 0], color2: [0, 0, 1] },
      colorSchemes: { meu: { color1: [0.2, 0.3, 0.4], color2: [0.5, 0.6, 0.7] } },
      layers: [{ id: "layer_1", colorScheme: "meu" }],
    }
    const migrated = normalizePersistedState(legacy) as {
      vibrance: number
      blendSpace: string
      seed: number[]
      colorSchemes: Record<string, { color3: number[] }>
      customColors: { color3: number[] }
      layers: Array<{ seed: number[] }>
    }

    expect(migrated.vibrance).toBe(0)
    expect(migrated.blendSpace).toBe("oklab")
    expect(migrated.seed).toEqual([0, 0])
    expect(migrated.colorSchemes.meu.color3).toEqual([0.5, 0.6, 0.7])
    expect(migrated.customColors.color3).toEqual([0, 0, 1])
    expect(migrated.layers[0].seed).toEqual([0, 0])
  })

  it("é idempotente — rodar de novo não muda nada", () => {
    const once = normalizePersistedState(v0StateForNormalize())
    const twice = normalizePersistedState(once)
    expect(twice).toEqual(once)
  })

  it("preserva escolhas válidas do usuário", () => {
    const normalized = normalizePersistedState({
      ...v0StateForNormalize(),
      vibrance: 0.35,
      blendSpace: "linear",
      seed: [12, 34],
    }) as Record<string, unknown>
    expect(normalized.vibrance).toBe(0.35)
    expect(normalized.blendSpace).toBe("linear")
    expect(normalized.seed).toEqual([12, 34])
  })
})

const v0StateForNormalize = () => ({
  speed: 1,
  customColors: { color1: [1, 0, 0], color2: [0, 0, 1] },
  colorSchemes: { meu: { color1: [0.2, 0.3, 0.4], color2: [0.5, 0.6, 0.7] } },
  layers: [{ id: "layer_1", colorScheme: "meu" }],
})
