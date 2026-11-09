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

// Controls that Space already activates when focused. Taking the key away from
// them would leave keyboard users unable to press a button or flip a switch.
const SPACE_ACTIVATED =
  'button, a[href], summary, [role="button"], [role="switch"], [role="slider"], [role="combobox"], [role="tab"], [role="checkbox"], [role="option"], [role="menuitem"]'

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

      if (ctrl) return // Leave every other Ctrl/Cmd combination to the browser

      switch (e.key) {
        case " ":
          if (target.closest?.(SPACE_ACTIVATED)) return
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
