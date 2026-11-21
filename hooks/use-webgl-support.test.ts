// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useWebGLSupport } from "@/hooks/use-webgl-support"

describe("useWebGLSupport", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("accepts WebGL 2 and releases the probe context", () => {
    const loseContext = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      { getExtension: () => ({ loseContext }) } as unknown as WebGL2RenderingContext
    )
    const { result } = renderHook(() => useWebGLSupport())
    expect(result.current).toBe(true)
    expect(loseContext).toHaveBeenCalledOnce()
  })

  it("returns false when no WebGL context is available", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    const { result } = renderHook(() => useWebGLSupport())
    expect(result.current).toBe(false)
  })

  it("rejects devices that only support WebGL 1", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((type: string) =>
        type === "webgl" || type === "experimental-webgl" ? ({} as RenderingContext) : null
      )
    const { result } = renderHook(() => useWebGLSupport())
    expect(result.current).toBe(false)
    expect(getContext).toHaveBeenCalledWith("webgl2")
  })

  it("returns false when creating the context throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked")
    })
    const { result } = renderHook(() => useWebGLSupport())
    expect(result.current).toBe(false)
  })
})
