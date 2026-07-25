"use client"

import { useEffect } from "react"
import { playback } from "@/lib/playback"
import { useGradientStore } from "@/lib/store"

// Avança o relógio da animação em um lugar só, montado uma vez na raiz do app.
//
// Antes o tempo era acumulado dentro do render loop de cada canvas — no modo
// multi-camadas, N canvases acumulavam N relógios, e a velocidade efetiva
// dependia de quantas camadas estavam visíveis. Aqui o relógio é único e os
// shaders apenas leem.
export function usePlaybackDriver() {
  const isPlaying = useGradientStore((state) => state.isPlaying)
  const speed = useGradientStore((state) => state.speed)
  const loopDuration = useGradientStore((state) => state.loopDuration)

  useEffect(() => {
    if (!isPlaying) return

    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      // Limitar o delta evita um salto no tempo quando a aba volta do
      // background (onde o rAF fica suspenso)
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      playback.advance(delta * speed, loopDuration)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, speed, loopDuration])
}
