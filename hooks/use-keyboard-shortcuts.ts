"use client"

import { useEffect } from "react"

type ShortcutHandlers = {
  onPlayPause: () => void
  onReset: () => void
  onFullscreen: () => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
}

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement

      // Ignore while focus is in a text field
      if (INPUT_TAGS.has(target.tagName) || target.isContentEditable || target.closest?.('[role="dialog"]')) return

      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handlers.onUndo()
        return
      }

      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        handlers.onRedo()
        return
      }

      if (ctrl) return // Ignorar outros atalhos com Ctrl

      switch (e.key) {
        case " ":
          e.preventDefault()
          handlers.onPlayPause()
          break
        case "r":
        case "R":
          handlers.onReset()
          break
        case "f":
        case "F":
          handlers.onFullscreen()
          break
        case "s":
        case "S":
          handlers.onSave()
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handlers])
}
