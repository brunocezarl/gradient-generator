"use client"

// The single animation clock.
//
// Each shader component used to accumulate its own time inside the render loop:
// in multi-layer mode that meant N independent clocks, and there was no way to
// know — let alone choose — which instant of the animation an exported image
// captured. With one clock, time becomes a value the timeline displays, the user
// drags, and the exporter walks in exact steps.
//
// It deliberately lives outside React state: at 60 fps, time in state would
// re-render the whole tree every frame.

type Listener = () => void

const listeners = new Set<Listener>()
let currentTime = 0

function notify() {
  for (const listener of listeners) listener()
}

export const playback = {
  get time(): number {
    return currentTime
  },

  // Advance coming from the animation driver. It does not notify: whoever is
  // animating is already drawing every frame.
  advance(delta: number, loopDuration = 0) {
    let next = currentTime + delta
    if (loopDuration > 0) {
      next = ((next % loopDuration) + loopDuration) % loopDuration
    }
    currentTime = Math.max(0, next)
  },

  // External change (dragging the timeline, resetting, exporting a specific
  // frame): notifies so the canvas redraws even while paused
  set(time: number, loopDuration = 0) {
    let next = Math.max(0, time)
    if (loopDuration > 0) {
      next = ((next % loopDuration) + loopDuration) % loopDuration
    }
    currentTime = next
    notify()
  },

  reset() {
    currentTime = 0
    notify()
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
