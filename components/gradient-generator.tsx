"use client"

import { useRef, useState, useEffect } from "react"
import { GradientScene } from "@/components/gradient-scene"
import { ControlsPanel } from "@/components/controls-panel"
import ErrorBoundary from "@/components/error-boundary"
import WebGLNotSupported from "@/components/webgl-not-supported"
import { ExportOptions } from "@/components/export-options"
// import { ShareGradient } from "@/components/share-gradient" // Removed ShareGradient import
import { VideoExport } from "@/components/video-export"
import { FullscreenButton } from "@/components/fullscreen-button"
import { MultiLayerGradient } from "@/components/multi-layer-gradient"
import { LayerManager } from "@/components/layer-manager"
import { useWebGLSupport } from "@/hooks/use-webgl-support"
import { useGradientStore } from "@/lib/store"
import { useToast } from "@/components/ui/use-toast"

export default function GradientGenerator() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isWebGLSupported = useWebGLSupport()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const multiLayerMode = useGradientStore(state => state.multiLayerMode)

  // Set loading state to false after component mounts
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Enhanced image capture function with options
  const captureImage = async (format = "png", quality = 1, scale = 1) => {
    try {
      if (!containerRef.current) return

      const canvas = containerRef.current.querySelector("canvas")
      if (!canvas) {
        console.error("Canvas element not found")
        toast({
          title: "Erro",
          description: "Não foi possível encontrar o canvas para capturar a imagem.",
          variant: "destructive",
        })
        return
      }

      // Show toast notification
      toast({
        title: "Processando",
        description: "Preparando a imagem para download...",
      })

      // Create a temporary canvas for scaling if needed
      let outputCanvas = canvas
      let ctx

      if (scale !== 1) {
        // Create a new canvas with scaled dimensions
        const scaledCanvas = document.createElement("canvas")
        scaledCanvas.width = canvas.width * scale
        scaledCanvas.height = canvas.height * scale

        // Get context and set scaling properties
        ctx = scaledCanvas.getContext("2d")
        if (!ctx) throw new Error("Could not get 2D context")

        // Apply scaling with high quality settings
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height)

        outputCanvas = scaledCanvas
      }

      // Determine the correct MIME type
      let mimeType = "image/png"
      if (format === "jpeg") mimeType = "image/jpeg"
      if (format === "webp") mimeType = "image/webp"

      // Create a temporary link element
      const link = document.createElement("a")
      link.download = `gradient-${Date.now()}.${format}`

      // Convert canvas to data URL with specified format and quality
      const dataUrl = outputCanvas.toDataURL(mimeType, quality)
      link.href = dataUrl

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Success toast
      toast({
        title: "Sucesso!",
        description: "Imagem exportada com sucesso.",
      })
    } catch (error) {
      console.error("Error capturing image:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao exportar a imagem.",
        variant: "destructive",
      })
      throw error // Re-throw to allow the export dialog to handle it
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
      </div>
    )
  }

  // Show WebGL not supported message if WebGL is not available
  if (!isWebGLSupported) {
    return <WebGLNotSupported />
  }

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden">
      {/* Gradient Scene with Error Boundary */}
      <ErrorBoundary
        fallback={
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center p-6">
              <h2 className="text-xl font-bold mb-2">Algo deu errado</h2>
              <p className="mb-4">Ocorreu um erro ao renderizar o gradiente.</p>
              <button
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        }
      >
        <div className="absolute inset-0">
          {multiLayerMode ? <MultiLayerGradient /> : <GradientScene />}
        </div>
      </ErrorBoundary>

      {/* Controls */}
      <div className="absolute top-0 left-0 z-40 flex flex-col">
        <ControlsPanel onCaptureImage={() => captureImage()} />
      </div>

      {/* Export and Share Options - Fixed at bottom right */}
      <div className="absolute bottom-4 right-4 z-40 w-64 space-y-2">
        <ExportOptions onExport={captureImage} />
        <VideoExport containerRef={containerRef} />
        {/* <ShareGradient /> */} {/* Removed ShareGradient component */}
      </div>

      {/* Layer Manager - Fixed at bottom left */}
      {multiLayerMode && (
        <div className="absolute bottom-4 left-4 z-40 w-72 bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg shadow-xl p-4">
          <LayerManager />
        </div>
      )}

      {/* Fullscreen Button - Fixed at top right */}
      <div className="absolute top-4 right-4 z-40">
        <FullscreenButton targetRef={containerRef} />
      </div>
    </div>
  )
}
