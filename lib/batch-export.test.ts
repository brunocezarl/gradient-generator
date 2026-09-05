import { beforeEach, describe, expect, it, vi } from "vitest"
import { batchSizes, exportImageBatch, exportName } from "./batch-export"
import { exportCompositeImage, renderFrameAtTime } from "./capture"
import { playback } from "./playback"
import { useGradientStore } from "./store"

vi.mock("./capture", () => ({
  exportCompositeImage: vi.fn(async () => new Blob(["image"], { type: "image/png" })),
  renderFrameAtTime: vi.fn(() => 1),
}))

beforeEach(() => {
  vi.clearAllMocks()
  useGradientStore.setState({ isPlaying: true, artboardId: "story" })
  playback.set(2.5)
})
const container = {} as HTMLElement
const options = () => ({ name: "My art", sizes: ["square", "story"], format: "png" as const,
  quality: 1, signal: new AbortController().signal, onProgress: vi.fn() })

describe("batch image delivery", () => {
  it("renders exact destinations at one instant and restores playback and framing", async () => {
    const result = await exportImageBatch(container, options())
    expect(result.type).toBe("application/zip")
    expect(exportCompositeImage).toHaveBeenCalledTimes(2)
    expect(exportCompositeImage).toHaveBeenNthCalledWith(2, container, expect.objectContaining({ width: 1080, height: 1920 }))
    expect(vi.mocked(renderFrameAtTime).mock.calls.every((call) => call[1] === 2.5)).toBe(true)
    expect(useGradientStore.getState().isPlaying).toBe(true)
    expect(useGradientStore.getState().artboardId).toBe("story")
    expect(playback.time).toBe(2.5)
  })
  it("cancels between images without completing the archive", async () => {
    const abort = new AbortController()
    vi.mocked(exportCompositeImage).mockImplementationOnce(async () => {
      abort.abort()
      return new Blob(["image"], { type: "image/png" })
    })
    await expect(exportImageBatch(container, { ...options(), signal: abort.signal })).rejects.toMatchObject({ name: "AbortError" })
    expect(exportCompositeImage).toHaveBeenCalledTimes(1)
    expect(useGradientStore.getState().isPlaying).toBe(true)
  })
  it("restores a paused session after an encoder failure", async () => {
    useGradientStore.setState({ isPlaying: false })
    vi.mocked(exportCompositeImage).mockRejectedValueOnce(new Error("Encoder failed"))
    await expect(exportImageBatch(container, options())).rejects.toThrow("Encoder failed")
    expect(useGradientStore.getState().isPlaying).toBe(false)
    expect(playback.time).toBe(2.5)
  })
  it("rejects an empty selection without changing playback", async () => {
    await expect(exportImageBatch(container, { ...options(), sizes: [] })).rejects.toThrow("Select at least one size")
    expect(exportCompositeImage).not.toHaveBeenCalled()
  })
  it("uses safe, bounded names for every destination", () => {
    expect(exportName("../../São Paulo / hero")).toBe("Sao-Paulo-hero")
    expect(exportName(" 🌊 ")).toBe("gradient")
    expect(exportName("a".repeat(100))).toHaveLength(64)
    expect(new Set(batchSizes.map((size) => size.id)).size).toBe(batchSizes.length)
  })
})
