"use client"

import { useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore, resolveActiveStops } from "@/lib/store"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"
import { CaptureHelper } from "@/components/capture-helper"
import { OrganicGradientShader } from "@/components/organic-gradient-shader"

// Cena de camada única. O GLSL vive em lib/shaders/organic-gradient.ts e é o
// mesmo usado pelo modo multi-camadas.
function GradientShader() {
  // Seletores em vez do store inteiro: arrastar um slider não deve
  // re-renderizar toda a árvore de um app que desenha em canvas
  const params = useGradientStore(
    useShallow((state) => ({
      complexity: state.complexity,
      noiseScale: state.noiseScale,
      flowIntensity: state.flowIntensity,
      grainAmount: state.grainAmount,
      grainScale: state.grainScale,
      thresholdMin: state.thresholdMin,
      thresholdMax: state.thresholdMax,
      vibrance: state.vibrance,
      blendSpace: state.blendSpace,
      seed: state.seed,
      loopDuration: state.loopDuration,
    }))
  )

  const stops = useGradientStore((state) =>
    resolveActiveStops({
      isCustomMode: state.isCustomMode,
      customStops: state.customStops,
      colorScheme: state.colorScheme,
      colorSchemes: state.colorSchemes,
    })
  )

  return <OrganicGradientShader stops={stops} {...params} />
}

export function GradientScene() {
  const { quality, pixelRatio, antialias } = useDeviceOptimizations()
  const isPlaying = useGradientStore((state) => state.isPlaying)

  const glConfig = useMemo(() => {
    return {
      preserveDrawingBuffer: true, // Necessário para exportação de imagem
      antialias, // Desativar antialiasing em dispositivos de baixo desempenho
      powerPreference: (quality === "high"
        ? "high-performance"
        : "low-power") as WebGLPowerPreference,
      depth: false, // Não precisamos de teste de profundidade para um gradiente 2D
      stencil: false, // Não precisamos de buffer de stencil
    }
  }, [quality, antialias])

  return (
    <Canvas
      gl={glConfig}
      camera={{ position: [0, 0, 5] }}
      dpr={[1, pixelRatio]}
      // Pausado significa pausado: em vez de seguir redesenhando o mesmo frame,
      // o canvas só renderiza sob demanda (mudança de controle ou resize).
      // Poupa GPU e bateria enquanto o designer ajusta cores.
      frameloop={isPlaying ? "always" : "demand"}
    >
      <GradientShader />
      <CaptureHelper />
    </Canvas>
  )
}
