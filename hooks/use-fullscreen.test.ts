// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useFullscreen } from "@/hooks/use-fullscreen"

function setFullscreenElement(element: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    value: element,
    configurable: true,
  })
}

describe("useFullscreen", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fullscreenEnabled", {
      value: true,
      configurable: true,
    })
    setFullscreenElement(null)
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
  })

  it("expõe o suporte a fullscreen do documento", () => {
    const { result } = renderHook(() => useFullscreen())
    expect(result.current.isFullscreenEnabled).toBe(true)
    expect(result.current.isFullscreen).toBe(false)
  })

  it("entra em fullscreen no elemento raiz por padrão", async () => {
    const { result } = renderHook(() => useFullscreen())
    await act(() => result.current.toggleFullscreen())
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it("entra em fullscreen no elemento fornecido", async () => {
    const target = document.createElement("div")
    target.requestFullscreen = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => useFullscreen())
    await act(() => result.current.toggleFullscreen(target))

    expect(target.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()
  })

  it("acompanha o evento fullscreenchange e sai do fullscreen", async () => {
    const { result } = renderHook(() => useFullscreen())

    // Navegador entrou em fullscreen
    setFullscreenElement(document.documentElement)
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"))
    })
    expect(result.current.isFullscreen).toBe(true)

    // Próximo toggle deve sair
    await act(() => result.current.toggleFullscreen())
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it("é no-op quando fullscreen não é suportado", async () => {
    Object.defineProperty(document, "fullscreenEnabled", {
      value: false,
      configurable: true,
    })
    const { result } = renderHook(() => useFullscreen())
    expect(result.current.isFullscreenEnabled).toBeFalsy()

    await act(() => result.current.toggleFullscreen())
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()
  })
})
