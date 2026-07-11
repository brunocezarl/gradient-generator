// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useMediaQuery } from "@/hooks/use-media-query"

// Mock controlável de matchMedia: permite definir o valor inicial e
// disparar mudanças manualmente
type Listener = (event: { matches: boolean }) => void

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches: initialMatches,
    addEventListener: vi.fn((_: string, cb: Listener) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: Listener) => listeners.delete(cb)),
  }
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia
  return {
    mql,
    fireChange(matches: boolean) {
      mql.matches = matches
      listeners.forEach((cb) => cb({ matches }))
    },
  }
}

describe("useMediaQuery", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna o valor inicial da media query", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"))
    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 768px)")
  })

  it("reage a mudanças da media query", () => {
    const { fireChange } = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"))
    expect(result.current).toBe(false)

    act(() => fireChange(true))
    expect(result.current).toBe(true)

    act(() => fireChange(false))
    expect(result.current).toBe(false)
  })

  it("remove o listener ao desmontar", () => {
    const { mql } = mockMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 768px)"))
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
