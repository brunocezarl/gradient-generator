"use client"

import { useRef, useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { useGradientStore } from "@/lib/store"
import { blendModeToCSS } from "@/lib/layer-utils"
import { OrganicGradientShader } from "@/components/organic-gradient-shader"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"

export function MultiLayerGradient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [contextLost, setContextLost] = useState(false)
  const layers = useGradientStore(state => state.layers)
  const multiLayerMode = useGradientStore(state => state.multiLayerMode)
  const isPlaying = useGradientStore(state => state.isPlaying)
  const speed = useGradientStore(state => state.speed)
  const complexity = useGradientStore(state => state.complexity)

  // Device optimizations
  const { quality } = useDeviceOptimizations()
  
  // Configure renderer based on device quality
  const glConfig = {
    preserveDrawingBuffer: true,
    antialias: quality !== 'low', // Disable antialiasing on low-end devices
    powerPreference: (quality === 'high' ? 'high-performance' : 'low-power') as WebGLPowerPreference,
    depth: false, // We don't need depth testing for a 2D gradient
    stencil: false, // We don't need stencil buffer
  }
  
  // Handle WebGL context loss
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleContextLost = (event: WebGLContextEvent) => {
      event.preventDefault()
      setContextLost(true)
    }

    const handleContextRestored = () => {
      setContextLost(false)
    }

    container.addEventListener('webglcontextlost', handleContextLost as EventListener, true)
    container.addEventListener('webglcontextrestored', handleContextRestored as EventListener, true)

    return () => {
      container.removeEventListener('webglcontextlost', handleContextLost as EventListener, true)
      container.removeEventListener('webglcontextrestored', handleContextRestored as EventListener, true)
    }
  }, [])

  // If not in multi-layer mode, return null (will use the regular GradientScene)
  if (!multiLayerMode) {
    return null
  }

  if (contextLost) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div className="text-center">
          <p className="text-lg mb-2">WebGL context lost</p>
          <p className="text-sm text-gray-400">Reloading...</p>
        </div>
      </div>
    )
  }

  // Sort layers from bottom to top (reverse order for z-index)
  const sortedLayers = [...layers].reverse()

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {sortedLayers.map((layer, index) => (
        layer.visible && (
          <div
            key={layer.id}
            className="absolute inset-0"
            style={{
              opacity: layer.opacity,
              mixBlendMode: blendModeToCSS(layer.blendMode) as React.CSSProperties['mixBlendMode'],
              zIndex: index + 1
            }}
          >
            <Canvas
              gl={glConfig}
              camera={{ position: [0, 0, 5] }}
              dpr={[1, quality === 'high' ? 2 : 1.5]}
            >
              <OrganicGradientShader
                isPlaying={isPlaying}
                speed={speed}
                complexity={complexity}
                noiseScale={layer.noiseScale}
                colorScheme={layer.isCustomMode && layer.customColors ? layer.customColors : layer.colorScheme}
                flowIntensity={layer.flowIntensity}
                thresholdMin={layer.thresholdMin}
                thresholdMax={layer.thresholdMax}
              />
            </Canvas>
          </div>
        )
      ))}
    </div>
  )
}
