import { describe, it, expect, vi } from "vitest"
import { curatedPresets } from "./curated-presets"
import { useGradientStore } from "./store"
import { playback } from "./playback"
import { createShareableURL, parseShareableURL } from "./share-utils"

describe("complete looks and shared framing", () => {
  it("applies a full look over layers and lets undo restore them", () => {
    useGradientStore.setState({ multiLayerMode: true, effect: "ascii" })
    const prior = useGradientStore.getState().layers
    useGradientStore.getState().applySnapshot(curatedPresets[0].snapshot)
    expect(useGradientStore.getState().multiLayerMode).toBe(false)
    expect(useGradientStore.getState().effect).toBe("none")
    useGradientStore.getState().undo()
    expect(useGradientStore.getState().multiLayerMode).toBe(true)
    expect(useGradientStore.getState().layers).toEqual(prior)
  })
  it("restores shared framing and pauses at the chosen frame", () => {
    vi.stubGlobal("window", { location: { origin: "https://example.com", pathname: "/" } })
    const settings = parseShareableURL(createShareableURL({ artboardId: "story", loopDuration: 8 }, 3.125))!
    useGradientStore.getState().importSettings(settings)
    expect(useGradientStore.getState().artboardId).toBe("story")
    expect(useGradientStore.getState().isPlaying).toBe(false)
    expect(playback.time).toBe(3.125)
  })
})
