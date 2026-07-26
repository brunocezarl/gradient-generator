"use client"

import { useEffect } from "react"
import { playback } from "@/lib/playback"
import { useGradientStore } from "@/lib/store"

// Advances the animation clock in one place, mounted once at the app root.
//
// Time used to be accumulated inside each canvas's render loop — in multi-layer
// mode, N canvases accumulated N clocks, and the effective speed depended on how
// many layers were visible. Here the clock is single and the shaders only read.
export function usePlaybackDriver() {
  const isPlaying = useGradientStore((state) => state.isPlaying)
  const speed = useGradientStore((state) => state.speed)
  const loopDuration = useGradientStore((state) => state.loopDuration)

  useEffect(() => {
    if (!isPlaying) return

    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      // Capping the delta avoids a jump in time when the tab returns from the
      // background (where rAF is suspended)
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      playback.advance(delta * speed, loopDuration)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, speed, loopDuration])
}
