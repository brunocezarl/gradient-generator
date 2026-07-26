// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"

// Fake matchMedia: returns true only for the listed queries
function mockMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.some((m) => query.includes(m)),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function mockCores(count: number | undefined) {
  Object.defineProperty(window.navigator, "hardwareConcurrency", {
    value: count,
    configurable: true,
  })
}

describe("useDeviceOptimizations", () => {
  beforeEach(() => {
    mockMatchMedia([])
    mockCores(8)
  })

  it("desktop with 8+ cores uses high quality", () => {
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("high")
    expect(result.current.maxComplexity).toBe(10)
    expect(result.current.pixelRatio).toBe(2)
    expect(result.current.antialias).toBe(true)
  })

  it("desktop with 4-7 cores uses medium quality", () => {
    mockCores(4)
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("medium")
    expect(result.current.pixelRatio).toBe(1.5)
  })

  it("desktop with few cores uses low quality", () => {
    mockCores(2)
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("low")
    expect(result.current.antialias).toBe(false)
  })

  it("mobile forces low quality even with a strong CPU", () => {
    mockMatchMedia(["max-width: 768px"])
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("low")
    expect(result.current.isMobile).toBe(true)
    expect(result.current.pixelRatio).toBe(1)
  })

  it("prefers-reduced-motion forces low quality", () => {
    mockMatchMedia(["prefers-reduced-motion"])
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("low")
    expect(result.current.isLowPower).toBe(true)
  })

  it("uses medium quality when hardwareConcurrency is missing", () => {
    mockCores(undefined)
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("medium")
  })
})
