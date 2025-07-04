"use client"

import { useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { useGradientStore } from "@/lib/store"
import { blendModeToCSS } from "@/lib/layer-utils"
import { OrganicGradientShader } from "@/components/organic-gradient-shader"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"

export function MultiLayerGradient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { layers, multiLayerMode } = useGradientStore()
  
  // Device optimizations
  const { quality } = useDeviceOptimizations()
  
  // Configure renderer based on device quality
  const glConfig = {
    preserveDrawingBuffer: true,
    antialias: quality !== 'low', // Disable antialiasing on low-end devices
    powerPreference: quality === 'high' ? 'high-performance' : 'low-power',
    depth: false, // We don't need depth testing for a 2D gradient
    stencil: false, // We don't need stencil buffer
  }
  
  // If not in multi-layer mode, return null (will use the regular GradientScene)
  if (!multiLayerMode) {
    return null
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
              mixBlendMode: blendModeToCSS(layer.blendMode),
              zIndex: index + 1
            }}
          >
            <Canvas 
              gl={glConfig} 
              camera={{ position: [0, 0, 5] }}
              dpr={[1, quality === 'high' ? 2 : 1.5]}
            >
              <OrganicGradientShader
                isPlaying={true}
                speed={1.0} // Use a fixed speed for all layers
                complexity={3} // Use a fixed complexity for all layers
                noiseScale={layer.noiseScale}
                colorScheme={layer.isCustomMode ? layer.customColors : layer.colorScheme}
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
