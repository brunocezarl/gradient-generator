// @vitest-environment happy-dom
// (the zustand/persist middleware needs window.localStorage; without a DOM it
// silently disables itself and useGradientStore.persist does not exist)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  useGradientStore,
  resolveActiveStops,
  migratePersistedState,
  normalizePersistedState,
  PERSIST_VERSION,
  type StateSnapshot,
} from "@/lib/store"

// Snapshot of the initial state, restored between tests
const initialState = useGradientStore.getState()

let now = 0

beforeEach(() => {
  // Control Date.now so history coalescing can be tested deterministically (and
  // so coalescing state does not leak between tests)
  now = 1_000_000
  vi.spyOn(Date, "now").mockImplementation(() => now)

  useGradientStore.setState(
    {
      ...initialState,
      customStops: initialState.customStops.map((stop) => ({ ...stop })),
      colorSchemes: { ...initialState.colorSchemes },
      layers: [...initialState.layers],
      past: [],
      future: [],
    },
    true
  )
  // Make sure the next edit is not coalesced with one from a previous test
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
  it("restores the default parameters", () => {
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

  it("preserves user-saved color schemes", () => {
    useGradientStore.getState().saveCustomScheme("My Scheme")
    const savedKey = useGradientStore.getState().colorScheme
    expect(savedKey).toMatch(/^custom_/)

    useGradientStore.getState().resetToDefaults()

    const state = useGradientStore.getState()
    expect(state.colorSchemes[savedKey]).toBeDefined()
    expect(state.colorSchemes[savedKey].name).toBe("My Scheme")
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

describe("undo/redo with coalescing", () => {
  it("groups continuous edits of the same control into one step", () => {
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

  it("creates a new step after the coalescing window", () => {
    useGradientStore.getState().setSpeed(1.5)
    advance(2000)
    useGradientStore.getState().setSpeed(2.0)

    expect(useGradientStore.getState().past).toHaveLength(2)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.5)
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
  })

  it("creates separate steps for different controls", () => {
    useGradientStore.getState().setSpeed(1.5)
    advance(100)
    useGradientStore.getState().setComplexity(7)

    expect(useGradientStore.getState().past).toHaveLength(2)
  })

  it("redo reapplies what was undone", () => {
    useGradientStore.getState().setSpeed(2.0)
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)

    useGradientStore.getState().redo()
    expect(useGradientStore.getState().speed).toBe(2.0)
  })

  it("undo with no history is a no-op", () => {
    const before = useGradientStore.getState().speed
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(before)
  })

  it("caps the history at 50 states", () => {
    for (let i = 0; i < 60; i++) {
      advance(2000)
      useGradientStore.getState().setSpeed(1 + (i % 9) / 10)
    }
    expect(useGradientStore.getState().past.length).toBeLessThanOrEqual(50)
  })
})

describe("importSettings", () => {
  it("applies valid settings with clamping", () => {
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

  it("falls back for an unknown color scheme", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "scheme_that_does_not_exist",
      isCustomMode: false,
      customColors: { color1: [0, 0, 0], color2: [1, 1, 1] },
    })

    expect(useGradientStore.getState().colorScheme).toBe("redBlue")
  })

  it("converts three-color links into stops, clamping values outside 0-1", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: true,
      customColors: { color1: [5, -1, 0.5], color2: [0.1, 0.2, 0.3] },
    })

    const { customStops } = useGradientStore.getState()
    expect(customStops).toHaveLength(2)
    expect(customStops[0]).toEqual({ color: [1, 0, 0.5], position: 0 })
    expect(customStops[1]).toEqual({ color: [0.1, 0.2, 0.3], position: 1 })
  })

  it("rejects malformed colors", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: true,
      // Invalid external payload: a hand-edited link
      customColors: { color1: "red" as unknown as number[], color2: [0.1] },
    })

    // With no valid colors in the link, the app default is preserved
    const { customStops } = useGradientStore.getState()
    expect(customStops).toEqual(initialState.customStops)
  })

  it("applies advanced parameters with clamping (v2 links)", () => {
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
    // thresholdMax is forced to stay above thresholdMin
    expect(state.thresholdMax).toBeCloseTo(0.6)
  })

  it("leaves missing advanced parameters untouched (v1 links)", () => {
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

  it("imports layers with regenerated ids and a validated blend mode", () => {
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
          blendMode: "invalid_mode",
          visible: true,
          colorScheme: "scheme_that_does_not_exist",
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
          customStops: [
            { color: [1, 0, 0] as [number, number, number], position: 0 },
            { color: [0, 0, 1] as [number, number, number], position: 1 },
          ],
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

describe("resolveActiveStops", () => {
  it("returns the custom stops in custom mode", () => {
    const state = useGradientStore.getState()
    expect(resolveActiveStops({ ...state, isCustomMode: true })).toBe(state.customStops)
  })

  it("resolves the named scheme", () => {
    const state = useGradientStore.getState()
    expect(resolveActiveStops({ ...state, isCustomMode: false, colorScheme: "neon" })).toBe(
      state.colorSchemes.neon.stops
    )
  })

  it("falls back for a missing scheme", () => {
    const state = useGradientStore.getState()
    const resolved = resolveActiveStops({
      ...state,
      isCustomMode: false,
      colorScheme: "does_not_exist",
    })
    expect(resolved).toBe(state.colorSchemes.redBlue.stops)
  })
})

describe("randomize", () => {
  it("produces values inside the control ranges", () => {
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
  it("keeps thresholdMax at least 0.1 above thresholdMin", () => {
    useGradientStore.getState().setThresholdMin(0.5)
    advance(2000)
    useGradientStore.getState().setThresholdMax(0.2)

    const state = useGradientStore.getState()
    expect(state.thresholdMax).toBeCloseTo(0.6)
  })

  it("leaves values above the minimum untouched", () => {
    useGradientStore.getState().setThresholdMax(0.9)
    expect(useGradientStore.getState().thresholdMax).toBe(0.9)
  })
})

describe("applyAnimationPreset", () => {
  it("applies the preset parameters and turns custom mode off", () => {
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

  it("records an undoable history step", () => {
    useGradientStore.getState().applyAnimationPreset("calm")
    expect(useGradientStore.getState().speed).toBe(0.5)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
  })

  it("is a no-op for an unknown preset", () => {
    const before = useGradientStore.getState()
    useGradientStore.getState().applyAnimationPreset("preset_falso")

    const after = useGradientStore.getState()
    expect(after.speed).toBe(before.speed)
    expect(after.past).toHaveLength(0)
  })
})

describe("saveCustomScheme", () => {
  it("saves an isolated copy of the custom stops", () => {
    useGradientStore.getState().setStopColor(0, [0.2, 0.3, 0.4])
    useGradientStore.getState().saveCustomScheme("Congelado")
    const savedKey = useGradientStore.getState().colorScheme

    // Editing the custom stops afterwards must not change the saved scheme
    advance(2000)
    useGradientStore.getState().setStopColor(0, [0.9, 0.9, 0.9])

    const saved = useGradientStore.getState().colorSchemes[savedKey]
    expect(saved.stops[0].color).toEqual([0.2, 0.3, 0.4])
    expect(saved.name).toBe("Congelado")
  })
})

describe("presets completos", () => {
  it("saves a frozen copy of the current state", () => {
    useGradientStore.getState().setSpeed(2.2)
    advance(2000)
    useGradientStore.getState().setFlowIntensity(0.7)
    useGradientStore.getState().saveCurrentPreset("Meu Visual")

    // Later edits must not change the saved preset
    advance(2000)
    useGradientStore.getState().setSpeed(0.5)

    const [preset] = useGradientStore.getState().savedPresets
    expect(preset.name).toBe("Meu Visual")
    expect(preset.snapshot.speed).toBe(2.2)
    expect(preset.snapshot.flowIntensity).toBe(0.7)
  })

  it("applyPreset restores every parameter and is undoable", () => {
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

  it("applyPreset is a no-op for an unknown id", () => {
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

describe("randomizer history", () => {
  it("stores each roll in the history (most recent first)", () => {
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

  it("caps the history at 10 rolls", () => {
    for (let i = 0; i < 15; i++) {
      advance(2000)
      useGradientStore.getState().randomize()
    }
    expect(useGradientStore.getState().randomHistory).toHaveLength(10)
  })

  it("applySnapshot restores an old roll and is undoable", () => {
    advance(2000)
    useGradientStore.getState().randomize()
    const rolled = useGradientStore.getState().randomHistory[0]

    advance(2000)
    useGradientStore.getState().resetToDefaults()
    expect(useGradientStore.getState().speed).toBe(1.0)

    useGradientStore.getState().applySnapshot(rolled)
    const state = useGradientStore.getState()
    expect(state.speed).toBe(rolled.speed)
    expect(state.customStops[0].color).toEqual(rolled.customStops[0].color)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().speed).toBe(1.0)
  })
})

describe("persistence", () => {
  it("does not persist the undo/redo history", () => {
    useGradientStore.getState().setSpeed(2.0)
    const { partialize } = useGradientStore.persist.getOptions()
    const persisted = partialize!(useGradientStore.getState()) as Record<string, unknown>

    expect(persisted).not.toHaveProperty("past")
    expect(persisted).not.toHaveProperty("future")
    expect(persisted).toHaveProperty("speed", 2.0)
    expect(persisted).toHaveProperty("layers")
  })

  it("persists saved presets and the randomizer history", () => {
    useGradientStore.getState().saveCurrentPreset("Persistente")
    advance(2000)
    useGradientStore.getState().randomize()

    const { partialize } = useGradientStore.persist.getOptions()
    const persisted = partialize!(useGradientStore.getState()) as Record<string, unknown>

    expect(persisted).toHaveProperty("savedPresets")
    expect(persisted).toHaveProperty("randomHistory")
  })
})

describe("layers", () => {
  it("does not remove the last layer", () => {
    const state = useGradientStore.getState()
    expect(state.layers).toHaveLength(1)
    state.removeLayer(state.layers[0].id)
    expect(useGradientStore.getState().layers).toHaveLength(1)
  })

  it("reorderLayers ignora ids desconhecidos", () => {
    useGradientStore.getState().addLayer()
    const ids = useGradientStore.getState().layers.map((l) => l.id)
    useGradientStore.getState().reorderLayers([ids[1], "fake_id", ids[0]])

    const reordered = useGradientStore.getState().layers.map((l) => l.id)
    expect(reordered).toEqual([ids[1], ids[0]])
  })

  it("addLayer makes the new layer active", () => {
    useGradientStore.getState().addLayer()
    const state = useGradientStore.getState()
    expect(state.layers).toHaveLength(2)
    expect(state.activeLayerId).toBe(state.layers[1].id)
  })

  it("removing the active layer moves the selection to a remaining layer", () => {
    useGradientStore.getState().addLayer()
    const active = useGradientStore.getState().activeLayerId
    useGradientStore.getState().removeLayer(active)

    const state = useGradientStore.getState()
    expect(state.layers).toHaveLength(1)
    expect(state.activeLayerId).toBe(state.layers[0].id)
    expect(state.activeLayerId).not.toBe(active)
  })

  it("removing an inactive layer keeps the selection", () => {
    useGradientStore.getState().addLayer()
    const [first, second] = useGradientStore.getState().layers
    useGradientStore.getState().setActiveLayer(second.id)
    useGradientStore.getState().removeLayer(first.id)

    expect(useGradientStore.getState().activeLayerId).toBe(second.id)
  })

  it("updateLayer changes only the target layer", () => {
    useGradientStore.getState().addLayer()
    const [first, second] = useGradientStore.getState().layers
    useGradientStore.getState().updateLayer(first.id, { opacity: 0.5, blendMode: "multiply" })

    const [updatedFirst, untouchedSecond] = useGradientStore.getState().layers
    expect(updatedFirst.opacity).toBe(0.5)
    expect(updatedFirst.blendMode).toBe("multiply")
    expect(untouchedSecond.opacity).toBe(second.opacity)
    expect(untouchedSecond.blendMode).toBe("normal")
  })

  it("moveLayer swaps adjacent layers in both directions", () => {
    useGradientStore.getState().addLayer()
    const [a, b] = useGradientStore.getState().layers.map((l) => l.id)

    useGradientStore.getState().moveLayer(b, "up")
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([b, a])

    useGradientStore.getState().moveLayer(b, "down")
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([a, b])
  })

  it("moveLayer is a no-op at the edges and for an unknown id", () => {
    useGradientStore.getState().addLayer()
    const ids = useGradientStore.getState().layers.map((l) => l.id)

    useGradientStore.getState().moveLayer(ids[0], "up")
    useGradientStore.getState().moveLayer(ids[1], "down")
    useGradientStore.getState().moveLayer("fake_id", "up")

    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual(ids)
  })
})

// ─── History covering layers ─────────────────────────────────────────────────

describe("layer undo/redo", () => {
  it("undoes creating a layer", () => {
    const store = useGradientStore.getState()
    expect(store.layers).toHaveLength(1)

    store.addLayer()
    expect(useGradientStore.getState().layers).toHaveLength(2)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers).toHaveLength(1)

    useGradientStore.getState().redo()
    expect(useGradientStore.getState().layers).toHaveLength(2)
  })

  it("undoes removing a layer, restoring its parameters", () => {
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

  it("undoes editing a layer", () => {
    const layerId = useGradientStore.getState().layers[0].id
    advance(2000)
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.3 })

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers[0].opacity).toBe(1)
  })

  it("coalesces dragging a layer slider into a single snapshot", () => {
    const layerId = useGradientStore.getState().layers[0].id
    advance(2000)
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.9 })
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.8 })
    useGradientStore.getState().updateLayer(layerId, { opacity: 0.7 })

    expect(useGradientStore.getState().past).toHaveLength(1)
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers[0].opacity).toBe(1)
  })

  it("undoes reordering layers", () => {
    useGradientStore.getState().addLayer()
    const [a, b] = useGradientStore.getState().layers.map((l) => l.id)

    useGradientStore.getState().reorderLayers([b, a])
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([b, a])

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual([a, b])
  })

  it("undoes turning on multi-layer mode", () => {
    useGradientStore.getState().setMultiLayerMode(true)
    expect(useGradientStore.getState().multiLayerMode).toBe(true)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().multiLayerMode).toBe(false)
  })

  it("keeps the active layer when it survives the undo", () => {
    useGradientStore.getState().addLayer()
    const secondId = useGradientStore.getState().layers[1].id
    advance(2000)
    useGradientStore.getState().updateLayer(secondId, { noiseScale: 4 })

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().activeLayerId).toBe(secondId)
  })

  it("new layers are born with their own seed, so shapes do not repeat", () => {
    useGradientStore.getState().addLayer()
    const [first, second] = useGradientStore.getState().layers
    expect(first.seed).toEqual([0, 0])
    expect(second.seed).not.toEqual(first.seed)
  })
})

describe("seed", () => {
  it("shuffleSeed changes the shape and is undoable", () => {
    expect(useGradientStore.getState().seed).toEqual([0, 0])

    useGradientStore.getState().shuffleSeed()
    expect(useGradientStore.getState().seed).not.toEqual([0, 0])

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().seed).toEqual([0, 0])
  })

  it("randomize also rolls the shape", () => {
    useGradientStore.getState().randomize()
    expect(useGradientStore.getState().seed).not.toEqual([0, 0])
  })

  it("resetToDefaults returns the seed to the origin", () => {
    useGradientStore.getState().shuffleSeed()
    useGradientStore.getState().resetToDefaults()
    expect(useGradientStore.getState().seed).toEqual([0, 0])
  })
})

describe("presets store the layer composition", () => {
  it("restores layers when applying a preset", () => {
    useGradientStore.getState().addLayer()
    useGradientStore.getState().setMultiLayerMode(true)
    useGradientStore.getState().saveCurrentPreset("Two layers")

    useGradientStore.getState().removeLayer(useGradientStore.getState().layers[1].id)
    expect(useGradientStore.getState().layers).toHaveLength(1)

    const presetId = useGradientStore.getState().savedPresets[0].id
    useGradientStore.getState().applyPreset(presetId)
    expect(useGradientStore.getState().layers).toHaveLength(2)
    expect(useGradientStore.getState().multiLayerMode).toBe(true)
  })

  it("an old snapshot without layers preserves the current layers", () => {
    useGradientStore.getState().addLayer()
    const before = useGradientStore.getState().layers.map((l) => l.id)

    // Preset saved before layers joined the snapshot
    const legacySnapshot = {
      speed: 2,
      complexity: 5,
      noiseScale: 3,
      colorScheme: "neon",
      isCustomMode: false,
      customStops: [
        { color: [1, 0, 0] as [number, number, number], position: 0 },
        { color: [0, 1, 0] as [number, number, number], position: 0.5 },
        { color: [0, 0, 1] as [number, number, number], position: 1 },
      ],
      flowIntensity: 0.5,
      grainAmount: 0.1,
      grainScale: 400,
      thresholdMin: 0.2,
      thresholdMax: 0.8,
      vibrance: 0,
      blendSpace: "oklab" as const,
      seed: [0, 0] as [number, number],
      loopDuration: 0,
      // No exposure/brightness/contrast: this snapshot predates the tone controls
    } as StateSnapshot

    useGradientStore.getState().applySnapshot(legacySnapshot)

    expect(useGradientStore.getState().speed).toBe(2)
    expect(useGradientStore.getState().layers.map((l) => l.id)).toEqual(before)
    // Missing tone falls back to neutral rather than reaching the shader as NaN
    expect(useGradientStore.getState().exposure).toBe(0)
    expect(useGradientStore.getState().brightness).toBe(0)
    expect(useGradientStore.getState().contrast).toBe(1)
  })
})

// ─── Persistence migration ───────────────────────────────────────────────────

describe("migratePersistedState", () => {
  // State as it was written before the color pipeline and the seed
  const v0State = () => ({
    speed: 1.5,
    complexity: 4,
    noiseScale: 2,
    colorScheme: "custom_123",
    isCustomMode: false,
    customColors: { color1: [1, 0, 0], color2: [0, 0, 1] },
    colorSchemes: {
      redBlue: { color1: [0.9, 0.1, 0.1], color2: [0, 0, 0.9], name: "Red & Blue" },
      custom_123: { color1: [0.2, 0.4, 0.6], color2: [0.8, 0.2, 0.1], name: "Mine" },
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
        name: "Legacy",
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

  it("fills in the color parameters and the seed that did not exist", () => {
    const migrated = migratePersistedState(v0State(), 0) as Record<string, unknown>
    expect(migrated.vibrance).toBe(0)
    expect(migrated.blendSpace).toBe("oklab")
    expect(migrated.seed).toEqual([0, 0])
  })

  it("preserves values that already existed", () => {
    const migrated = migratePersistedState(v0State(), 0) as Record<string, unknown>
    expect(migrated.speed).toBe(1.5)
    expect(migrated.grainScale).toBe(500)
    expect(migrated.colorScheme).toBe("custom_123")
  })

  it("converts three-color schemes into evenly spaced stops", () => {
    const migrated = migratePersistedState(v0State(), 0) as {
      colorSchemes: Record<string, { stops: { color: number[]; position: number }[]; name?: string }>
      customStops: { color: number[]; position: number }[]
    }
    // Two colors become stops at 0 and 1 — the same look the user saved
    const scheme = migrated.colorSchemes.custom_123
    expect(scheme.name).toBe("Mine")
    expect(scheme.stops).toEqual([
      { color: [0.2, 0.4, 0.6], position: 0 },
      { color: [0.8, 0.2, 0.1], position: 1 },
    ])
    expect(migrated.customStops).toEqual([
      { color: [1, 0, 0], position: 0 },
      { color: [0, 0, 1], position: 1 },
    ])
  })

  it("gives persisted layers a seed and stops", () => {
    const migrated = migratePersistedState(v0State(), 0) as {
      layers: Array<{ seed: number[]; customStops: { color: number[] }[]; customColors?: unknown }>
    }
    expect(migrated.layers[0].seed).toEqual([0, 0])
    expect(migrated.layers[0].customStops.map((stop) => stop.color)).toEqual([
      [1, 1, 0],
      [0, 1, 1],
    ])
    expect(migrated.layers[0].customColors).toBeUndefined()
  })

  it("migrates snapshots of saved presets and of the randomizer history", () => {
    const migrated = migratePersistedState(v0State(), 0) as {
      savedPresets: Array<{ name: string; snapshot: Record<string, unknown> }>
      randomHistory: Array<Record<string, unknown>>
    }
    const snapshot = migrated.savedPresets[0].snapshot
    expect(migrated.savedPresets[0].name).toBe("Legacy")
    expect(snapshot.vibrance).toBe(0)
    expect(snapshot.blendSpace).toBe("oklab")
    expect(snapshot.seed).toEqual([0, 0])
    expect((snapshot.customStops as { color: number[] }[]).map((stop) => stop.color)).toEqual([
      [1, 0, 0],
      [0, 0, 1],
    ])
    expect(migrated.randomHistory[0].seed).toEqual([0, 0])
    expect(
      (migrated.randomHistory[0].customStops as { color: number[] }[]).map((stop) => stop.color)
    ).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ])
  })

  it("drops invalid values coming from localStorage", () => {
    const corrupted = {
      ...v0State(),
      vibrance: "lots" as unknown as number,
      blendSpace: "nonexistent_space",
      seed: ["a", null],
    }
    const migrated = migratePersistedState(corrupted, 0) as Record<string, unknown>
    expect(migrated.vibrance).toBe(0)
    expect(migrated.blendSpace).toBe("oklab")
    expect(migrated.seed).toEqual([0, 0])
  })

  it("leaves states already on the current version untouched", () => {
    const current = { ...v0State(), vibrance: 0.4, blendSpace: "linear", seed: [5, 6] }
    const migrated = migratePersistedState(current, PERSIST_VERSION) as Record<string, unknown>
    expect(migrated.vibrance).toBe(0.4)
    expect(migrated.blendSpace).toBe("linear")
    expect(migrated.seed).toEqual([5, 6])
  })

  it("tolerates empty or non-object states", () => {
    expect(migratePersistedState(null, 0)).toBeNull()
    expect(migratePersistedState("garbage", 0)).toBe("garbage")
    expect(migratePersistedState({}, 0)).toEqual({
      vibrance: 0,
      exposure: 0,
      brightness: 0,
      contrast: 1,
      effect: "none",
      bloomThreshold: 0.6,
      bloomIntensity: 0.8,
      bloomRadius: 1,
      blendSpace: "oklab",
      loopDuration: 0,
      seed: [0, 0],
      artboardId: "free",
      showSafeAreas: false,
      customStops: initialState.customStops,
    })
  })
})

describe("normalizePersistedState", () => {
  // zustand only calls `migrate` when the stored JSON has a numeric `version`;
  // earlier versions persisted without that field, so it is the normalization in
  // `merge` that rescues real user localStorage
  it("normalizes a state stored without a version", () => {
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
      colorSchemes: Record<string, { stops: { color: number[]; position: number }[] }>
      customStops: { color: number[]; position: number }[]
      layers: Array<{ seed: number[] }>
    }

    expect(migrated.vibrance).toBe(0)
    expect(migrated.blendSpace).toBe("oklab")
    expect(migrated.seed).toEqual([0, 0])
    expect(migrated.colorSchemes.meu.stops).toEqual([
      { color: [0.2, 0.3, 0.4], position: 0 },
      { color: [0.5, 0.6, 0.7], position: 1 },
    ])
    expect(migrated.customStops).toEqual([
      { color: [1, 0, 0], position: 0 },
      { color: [0, 0, 1], position: 1 },
    ])
    expect(migrated.layers[0].seed).toEqual([0, 0])
  })

  it("is idempotent — running it again changes nothing", () => {
    const once = normalizePersistedState(v0StateForNormalize())
    const twice = normalizePersistedState(once)
    expect(twice).toEqual(once)
  })

  it("preserves valid user choices", () => {
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

describe("library (import/export)", () => {
  it("exports and re-imports presets and schemes", () => {
    useGradientStore.getState().saveCustomScheme("My Scheme")
    useGradientStore.getState().saveCurrentPreset("My Preset")

    const json = useGradientStore.getState().exportLibrary()

    // Clean state: importing has to rebuild the library
    useGradientStore.setState({ savedPresets: [], colorSchemes: initialState.colorSchemes })

    const result = useGradientStore.getState().importLibrary(json)
    expect(result.presets).toBe(1)
    expect(result.schemes).toBeGreaterThanOrEqual(1)

    const state = useGradientStore.getState()
    expect(state.savedPresets[0].name).toBe("My Preset")
    expect(Object.values(state.colorSchemes).some((s) => s.name === "My Scheme")).toBe(true)
  })

  it("importing twice does not collide ids", () => {
    useGradientStore.getState().saveCurrentPreset("Preset")
    const json = useGradientStore.getState().exportLibrary()
    useGradientStore.setState({ savedPresets: [] })

    useGradientStore.getState().importLibrary(json)
    useGradientStore.getState().importLibrary(json)

    const ids = useGradientStore.getState().savedPresets.map((preset) => preset.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it("migrates presets exported in the three-color format", () => {
    const legacyFile = JSON.stringify({
      format: "gradient-generator-library",
      version: 1,
      presets: [
        {
          id: "antigo",
          name: "Legacy Preset",
          createdAt: 1,
          snapshot: {
            speed: 1,
            complexity: 3,
            noiseScale: 2,
            colorScheme: "redBlue",
            isCustomMode: true,
            customColors: { color1: [1, 0, 0], color2: [0, 1, 0], color3: [0, 0, 1] },
            flowIntensity: 0.3,
            grainAmount: 0.05,
            grainScale: 500,
            thresholdMin: 0.3,
            thresholdMax: 0.7,
          },
        },
      ],
      colorSchemes: {
        antigo: { color1: [0.2, 0.3, 0.4], color2: [0.5, 0.6, 0.7], name: "Legacy Scheme" },
      },
    })

    useGradientStore.setState({ savedPresets: [] })
    const result = useGradientStore.getState().importLibrary(legacyFile)
    expect(result.presets).toBe(1)

    const state = useGradientStore.getState()
    const imported = state.savedPresets[0].snapshot
    expect(imported.customStops.map((stop) => stop.color)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
    expect(imported.vibrance).toBe(0)
    expect(imported.blendSpace).toBe("oklab")
    expect(state.colorSchemes.antigo.stops).toEqual([
      { color: [0.2, 0.3, 0.4], position: 0 },
      { color: [0.5, 0.6, 0.7], position: 1 },
    ])
  })

  it("propagates the error for an invalid file", () => {
    expect(() => useGradientStore.getState().importLibrary("{}")).toThrow()
  })
})

describe("color stops", () => {
  it("adds a stop in the largest gap and removes by index", () => {
    const store = useGradientStore.getState()
    expect(store.customStops).toHaveLength(3)

    store.addStop()
    expect(useGradientStore.getState().customStops).toHaveLength(4)

    useGradientStore.getState().removeStop(1)
    expect(useGradientStore.getState().customStops).toHaveLength(3)
  })

  it("respects the minimum and maximum", () => {
    useGradientStore.setState({
      customStops: [
        { color: [1, 0, 0], position: 0 },
        { color: [0, 0, 1], position: 1 },
      ],
    })
    useGradientStore.getState().removeStop(0)
    expect(useGradientStore.getState().customStops).toHaveLength(2)

    for (let i = 0; i < 12; i++) {
      advance(2000)
      useGradientStore.getState().addStop()
    }
    expect(useGradientStore.getState().customStops).toHaveLength(8)
  })

  it("adding and removing a stop are undoable", () => {
    useGradientStore.getState().addStop()
    expect(useGradientStore.getState().customStops).toHaveLength(4)
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().customStops).toHaveLength(3)
  })

  it("setStops sorts and validates the incoming palette", () => {
    useGradientStore.getState().setStops([
      { color: [0, 1, 0], position: 0.9 },
      { color: [1, 0, 0], position: 0.1 },
      { color: [5, -1, 0.5], position: 2 },
    ])
    const stops = useGradientStore.getState().customStops
    expect(stops.map((stop) => stop.position)).toEqual([0.1, 0.9, 1])
    expect(stops[2].color).toEqual([1, 0, 0.5])
  })

  it("moving a stop does not re-sort the list (stable drag)", () => {
    advance(2000)
    useGradientStore.getState().setStopPosition(0, 1)
    const stops = useGradientStore.getState().customStops
    expect(stops[0].position).toBe(1)
    expect(stops[0].color).toEqual(initialState.customStops[0].color)
  })

  it("randomize produces a palette with perceptible chroma", () => {
    for (let i = 0; i < 10; i++) {
      advance(2000)
      useGradientStore.getState().randomize()
      const stops = useGradientStore.getState().customStops
      expect(stops.length).toBeGreaterThanOrEqual(2)
      // Drawn in OKLCH: none of the mud the RGB draw produced
      const saturated = stops.some((stop) => {
        const [r, g, b] = stop.color
        return Math.max(r, g, b) - Math.min(r, g, b) > 0.05
      })
      expect(saturated).toBe(true)
    }
  })
})

// ─── Tone controls ───────────────────────────────────────────────────────────

describe("tone controls", () => {
  it("start neutral, so the pipeline is a no-op until touched", () => {
    expect(useGradientStore.getState().exposure).toBe(0)
    expect(useGradientStore.getState().brightness).toBe(0)
    expect(useGradientStore.getState().contrast).toBe(1)
  })

  it("travel in snapshots and come back through undo", () => {
    const store = useGradientStore.getState()
    store.setExposure(0.5)
    now += 2000
    store.setContrast(1.6)
    now += 2000
    store.setBrightness(-0.1)

    expect(useGradientStore.getState().exposure).toBe(0.5)
    expect(useGradientStore.getState().contrast).toBe(1.6)
    expect(useGradientStore.getState().brightness).toBe(-0.1)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().brightness).toBe(0)
    expect(useGradientStore.getState().contrast).toBe(1.6)
  })

  it("go back to neutral on reset", () => {
    const store = useGradientStore.getState()
    store.setExposure(1.5)
    store.setBrightness(0.2)
    store.setContrast(0.7)

    useGradientStore.getState().resetToDefaults()

    expect(useGradientStore.getState().exposure).toBe(0)
    expect(useGradientStore.getState().brightness).toBe(0)
    expect(useGradientStore.getState().contrast).toBe(1)
  })

  it("are filled in when hydrating a state that predates them", () => {
    const normalized = normalizePersistedState({
      speed: 1,
      vibrance: 0,
    }) as Record<string, unknown>

    expect(normalized.exposure).toBe(0)
    expect(normalized.brightness).toBe(0)
    expect(normalized.contrast).toBe(1)
  })

  it("survive a stored value of the wrong type", () => {
    const normalized = normalizePersistedState({
      exposure: "bright",
      brightness: null,
      contrast: undefined,
    }) as Record<string, unknown>

    expect(normalized.exposure).toBe(0)
    expect(normalized.brightness).toBe(0)
    expect(normalized.contrast).toBe(1)
  })

  it("are clamped when they arrive from a link", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      stops: [
        { color: [1, 0, 0], position: 0 },
        { color: [0, 0, 1], position: 1 },
      ],
      exposure: 99,
      brightness: -99,
      contrast: 0,
    })

    expect(useGradientStore.getState().exposure).toBe(2)
    expect(useGradientStore.getState().brightness).toBe(-0.3)
    expect(useGradientStore.getState().contrast).toBe(0.5)
  })
})

// ─── Effects ─────────────────────────────────────────────────────────────────

describe("effects", () => {
  it("start with no chain, which is the untouched render path", () => {
    expect(useGradientStore.getState().effect).toBe("none")
  })

  it("travel in snapshots and come back through undo", () => {
    const store = useGradientStore.getState()
    store.setEffect("bloom")
    now += 2000
    store.setBloomIntensity(1.7)

    expect(useGradientStore.getState().effect).toBe("bloom")
    expect(useGradientStore.getState().bloomIntensity).toBe(1.7)

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().bloomIntensity).toBe(0.8)
    expect(useGradientStore.getState().effect).toBe("bloom")

    useGradientStore.getState().undo()
    expect(useGradientStore.getState().effect).toBe("none")
  })

  it("go back to none on reset", () => {
    const store = useGradientStore.getState()
    store.setEffect("bloom")
    store.setBloomRadius(2.5)

    useGradientStore.getState().resetToDefaults()

    expect(useGradientStore.getState().effect).toBe("none")
    expect(useGradientStore.getState().bloomRadius).toBe(1)
  })

  it("are filled in when hydrating a state that predates them", () => {
    const normalized = normalizePersistedState({ speed: 1 }) as Record<string, unknown>

    expect(normalized.effect).toBe("none")
    expect(normalized.bloomThreshold).toBe(0.6)
    expect(normalized.bloomIntensity).toBe(0.8)
    expect(normalized.bloomRadius).toBe(1)
  })

  it("reject an effect name this build does not know", () => {
    const normalized = normalizePersistedState({ effect: "ascii" }) as Record<string, unknown>
    // A link or a stored state from a newer build must not leave the renderer
    // asking for a chain that does not exist here
    expect(normalized.effect).toBe("none")
  })

  it("are clamped when they arrive from a link", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      stops: [
        { color: [1, 0, 0], position: 0 },
        { color: [0, 0, 1], position: 1 },
      ],
      effect: "bloom",
      bloomThreshold: -5,
      bloomIntensity: 99,
      bloomRadius: 0,
    })

    expect(useGradientStore.getState().effect).toBe("bloom")
    expect(useGradientStore.getState().bloomThreshold).toBe(0)
    expect(useGradientStore.getState().bloomIntensity).toBe(3)
    expect(useGradientStore.getState().bloomRadius).toBe(0.5)
  })

  it("fall back to none when a link names an unknown effect", () => {
    useGradientStore.getState().importSettings({
      speed: 1,
      complexity: 3,
      noiseScale: 2,
      colorScheme: "redBlue",
      isCustomMode: false,
      stops: [
        { color: [1, 0, 0], position: 0 },
        { color: [0, 0, 1], position: 1 },
      ],
      effect: "kaleidoscope",
    })

    expect(useGradientStore.getState().effect).toBe("none")
  })
})
