// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useWebGLSupport } from "@/hooks/use-webgl-support"

describe("useWebGLSupport", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns true when the WebGL context is created", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as RenderingContext
    )
    const { result } = renderHook(() => useWebGLSupport())
    expect(result.current).toBe(true)
  })

  it("returns false when no WebGL context is available", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    const { result } = renderHook(() => useWebGLSupport())
    expect(result.current).toBe(false)
  })

  it("tenta o fallback 'experimental-webgl' antes de desistir", () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((type: string) =>
        type === "experimental-webgl" ? ({} as RenderingContext) : null
      )
    const { result } = renderHook(() => useWebGLSupport())
    expect(result.current).toBe(true)
    expect(getContext).toHaveBeenCalledWith("webgl")
    expect(getContext).toHaveBeenCalledWith("experimental-webgl")
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
