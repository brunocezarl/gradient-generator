// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"

// matchMedia fake: responde true apenas para as queries listadas
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

  it("desktop com 8+ núcleos usa qualidade alta", () => {
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("high")
    expect(result.current.frameSkip).toBe(0)
    expect(result.current.maxComplexity).toBe(10)
    expect(result.current.pixelRatio).toBe(2)
    expect(result.current.antialias).toBe(true)
  })

  it("desktop com 4-7 núcleos usa qualidade média", () => {
    mockCores(4)
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("medium")
    expect(result.current.frameSkip).toBe(1)
    expect(result.current.pixelRatio).toBe(1.5)
  })

  it("desktop com poucos núcleos usa qualidade baixa", () => {
    mockCores(2)
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("low")
    expect(result.current.antialias).toBe(false)
  })

  it("mobile força qualidade baixa mesmo com CPU forte", () => {
    mockMatchMedia(["max-width: 768px"])
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("low")
    expect(result.current.isMobile).toBe(true)
    expect(result.current.frameSkip).toBe(2)
    expect(result.current.pixelRatio).toBe(1)
  })

  it("prefers-reduced-motion força qualidade baixa", () => {
    mockMatchMedia(["prefers-reduced-motion"])
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("low")
    expect(result.current.isLowPower).toBe(true)
  })

  it("usa qualidade média quando hardwareConcurrency não existe", () => {
    mockCores(undefined)
    const { result } = renderHook(() => useDeviceOptimizations())
    expect(result.current.quality).toBe("medium")
  })
})
