// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest"
import { normalizePersistedState, useGradientStore, type GradientStore, type StateSnapshot } from "./store"
import { createShareableURL, parseShareableURL } from "./share-utils"
const initial = useGradientStore.getInitialState()
afterEach(() => useGradientStore.setState(initial, true))

it("round-trips scenes with more than sixteen layers through links and libraries", () => {
  const layers = Array.from({ length: 17 }, (_, i) => ({ ...initial.layers[0], id: `layer-${i}` }))
  useGradientStore.setState({ layers, multiLayerMode: true })
  const shared = parseShareableURL(createShareableURL(useGradientStore.getState()))!
  expect(shared.layers).toHaveLength(17)
  useGradientStore.getState().importSettings(shared)
  useGradientStore.getState().saveCurrentPreset("Many layers")
  const library = useGradientStore.getState().exportLibrary()
  expect(useGradientStore.getState().importLibrary(library).presets).toBe(1)
})

it("repairs malformed persisted layers and their numeric ranges", () => {
  const state = normalizePersistedState({ layers: [null, { id: "bad", opacity: 99, noiseScale: "wrong", thresholdMin: 0.8, thresholdMax: 0.2, blendMode: "constructor", isCustomMode: true }], activeLayerId: "missing" }) as GradientStore
  expect(state.layers).toHaveLength(2)
  expect(state.layers[0].noiseScale).toBe(0.6)
  expect(state.layers[1]).toMatchObject({ opacity: 1, noiseScale: 0.6, thresholdMin: 0.8, thresholdMax: 0.9, blendMode: "normal" })
  expect(state.layers[1].customStops!.length).toBeGreaterThanOrEqual(2)
  expect(state.activeLayerId).toBe(state.layers[0].id)
})

it("rejects invalid optional snapshot fields atomically", () => {
  useGradientStore.getState().saveCurrentPreset("Valid")
  const snapshot = useGradientStore.getState().savedPresets[0].snapshot
  for (const patch of [{ multiLayerMode: "yes" }, { effect: "constructor" }, { exposure: "bad" }]) {
    const before = useGradientStore.getState()
    before.applySnapshot({ ...snapshot, ...patch } as unknown as StateSnapshot)
    expect(useGradientStore.getState()).toBe(before)
    expect(() => before.importLibrary(JSON.stringify({ format: "gradient-generator-library", version: 1, presets: [{ name: "Bad", snapshot: { ...snapshot, ...patch } }] }))).toThrow()
    expect(useGradientStore.getState()).toBe(before)
  }
})
