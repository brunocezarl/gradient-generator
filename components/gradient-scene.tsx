"use client"

import { useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore, resolveActiveStops } from "@/lib/store"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"
import { CaptureHelper } from "@/components/capture-helper"
import { OrganicGradientShader } from "@/components/organic-gradient-shader"

// Single-layer scene. The GLSL lives in lib/shaders/organic-gradient.ts and is
// the same one the multi-layer mode uses.
function GradientShader() {
  // Selectors instead of the whole store: dragging a slider must not re-render
  // the entire tree of an app that draws on a canvas
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
      exposure: state.exposure,
      brightness: state.brightness,
      contrast: state.contrast,
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
      preserveDrawingBuffer: true, // Required for image export
      antialias, // Off on low-end devices
      powerPreference: (quality === "high"
        ? "high-performance"
        : "low-power") as WebGLPowerPreference,
      depth: false, // No depth testing needed for a 2D gradient
      stencil: false, // No stencil buffer needed
    }
  }, [quality, antialias])

  return (
    <Canvas
      gl={glConfig}
      camera={{ position: [0, 0, 5] }}
      dpr={[1, pixelRatio]}
      // Paused means paused: instead of redrawing the same frame forever, the
      // canvas only renders on demand (a control change or a resize). Saves GPU
      // and battery while the designer works on colors.
      frameloop={isPlaying ? "always" : "demand"}
    >
      <GradientShader />
      <CaptureHelper />
    </Canvas>
  )
}
