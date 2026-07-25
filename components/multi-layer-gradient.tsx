"use client"

import { useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore } from "@/lib/store"
import { blendModeToCSS, type GradientLayer } from "@/lib/layer-utils"
import { OrganicGradientShader } from "@/components/organic-gradient-shader"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"
import { CaptureHelper } from "@/components/capture-helper"

export function MultiLayerGradient() {
  const layers = useGradientStore((state) => state.layers)
  const multiLayerMode = useGradientStore((state) => state.multiLayerMode)
  const colorSchemes = useGradientStore((state) => state.colorSchemes)

  // O movimento e o acabamento são globais: a composição inteira se move junta
  // e recebe o mesmo tratamento de cor. Antes estes valores eram fixos aqui
  // dentro, então play/pause, velocidade e complexidade não tinham efeito
  // nenhum no modo multi-camadas.
  const isPlaying = useGradientStore((state) => state.isPlaying)
  const globals = useGradientStore(
    useShallow((state) => ({
      speed: state.speed,
      complexity: state.complexity,
      grainAmount: state.grainAmount,
      grainScale: state.grainScale,
      vibrance: state.vibrance,
      blendSpace: state.blendSpace,
    }))
  )

  const { quality } = useDeviceOptimizations()

  const glConfig = useMemo(
    () => ({
      preserveDrawingBuffer: true,
      antialias: quality !== "low",
      powerPreference: (quality === "high"
        ? "high-performance"
        : "low-power") as WebGLPowerPreference,
      depth: false,
      stencil: false,
    }),
    [quality]
  )

  if (!multiLayerMode) {
    return null
  }

  // Resolve as cores da camada já com a 3ª parada — antes o shader de camada
  // só recebia duas, e a mesma configuração rendia imagens diferentes nos dois
  // modos. Fallback para um esquema existente: o nome pode vir de um link
  // compartilhado apontando para um esquema que este cliente não tem.
  const layerColors = (layer: GradientLayer) => {
    if (layer.isCustomMode && layer.customColors) return layer.customColors
    return colorSchemes[layer.colorScheme] ?? colorSchemes.redBlue
  }

  // Ordem de baixo para cima (z-index invertido)
  const sortedLayers = [...layers].reverse()

  return (
    <div className="w-full h-full relative">
      {sortedLayers.map((layer, index) =>
        layer.visible ? (
          <div
            key={layer.id}
            className="absolute inset-0"
            style={{
              opacity: layer.opacity,
              mixBlendMode: blendModeToCSS(layer.blendMode),
              zIndex: index + 1,
            }}
          >
            <Canvas
              gl={glConfig}
              camera={{ position: [0, 0, 5] }}
              dpr={[1, quality === "high" ? 2 : 1.5]}
              frameloop={isPlaying ? "always" : "demand"}
            >
              <OrganicGradientShader
                isPlaying={isPlaying}
                speed={globals.speed}
                complexity={globals.complexity}
                grainAmount={globals.grainAmount}
                grainScale={globals.grainScale}
                vibrance={globals.vibrance}
                blendSpace={globals.blendSpace}
                colors={layerColors(layer)}
                noiseScale={layer.noiseScale}
                flowIntensity={layer.flowIntensity}
                thresholdMin={layer.thresholdMin}
                thresholdMax={layer.thresholdMax}
                seed={layer.seed}
              />
              <CaptureHelper />
            </Canvas>
          </div>
        ) : null
      )}
    </div>
  )
}
