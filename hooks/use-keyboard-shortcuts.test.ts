// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

function createHandlers() {
  return {
    onPlayPause: vi.fn(),
    onReset: vi.fn(),
    onFullscreen: vi.fn(),
    onSave: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  }
}

function press(key: string, modifiers: Partial<KeyboardEventInit> = {}, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  })
  target.dispatchEvent(event)
  return event
}

describe("useKeyboardShortcuts", () => {
  let handlers: ReturnType<typeof createHandlers>

  beforeEach(() => {
    handlers = createHandlers()
    document.body.innerHTML = ""
  })

  it("espaço aciona play/pause e previne o scroll da página", () => {
    renderHook(() => useKeyboardShortcuts(handlers))
    const event = press(" ")
    expect(handlers.onPlayPause).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it("r/f/s acionam reset, fullscreen e save (com maiúsculas)", () => {
    renderHook(() => useKeyboardShortcuts(handlers))
    press("r")
    press("R")
    press("f")
    press("S")
    expect(handlers.onReset).toHaveBeenCalledTimes(2)
    expect(handlers.onFullscreen).toHaveBeenCalledTimes(1)
    expect(handlers.onSave).toHaveBeenCalledTimes(1)
  })

  it("Ctrl+Z e Cmd+Z acionam undo", () => {
    renderHook(() => useKeyboardShortcuts(handlers))
    const ctrlZ = press("z", { ctrlKey: true })
    press("z", { metaKey: true })
    expect(handlers.onUndo).toHaveBeenCalledTimes(2)
    expect(ctrlZ.defaultPrevented).toBe(true)
  })

  it("Ctrl+Y e Ctrl+Shift+Z acionam redo", () => {
    renderHook(() => useKeyboardShortcuts(handlers))
    press("y", { ctrlKey: true })
    press("z", { ctrlKey: true, shiftKey: true })
    expect(handlers.onRedo).toHaveBeenCalledTimes(2)
    expect(handlers.onUndo).not.toHaveBeenCalled()
  })

  it("ignora outros atalhos com Ctrl (ex.: Ctrl+S do navegador)", () => {
    renderHook(() => useKeyboardShortcuts(handlers))
    press("s", { ctrlKey: true })
    press("r", { ctrlKey: true })
    expect(handlers.onSave).not.toHaveBeenCalled()
    expect(handlers.onReset).not.toHaveBeenCalled()
  })

  it("ignora teclas quando o foco está em campos de texto", () => {
    renderHook(() => useKeyboardShortcuts(handlers))
    const input = document.createElement("input")
    const textarea = document.createElement("textarea")
    document.body.append(input, textarea)

    press(" ", {}, input)
    press("r", {}, textarea)
    press("z", { ctrlKey: true }, input)

    expect(handlers.onPlayPause).not.toHaveBeenCalled()
    expect(handlers.onReset).not.toHaveBeenCalled()
    expect(handlers.onUndo).not.toHaveBeenCalled()
  })

  it("remove o listener ao desmontar", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(handlers))
    unmount()
    press(" ")
    expect(handlers.onPlayPause).not.toHaveBeenCalled()
  })
})
