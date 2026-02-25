"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { GradientScene } from "@/components/gradient-scene"
import { ControlsPanel } from "@/components/controls-panel"
import ErrorBoundary from "@/components/error-boundary"
import WebGLNotSupported from "@/components/webgl-not-supported"
import { ExportOptions } from "@/components/export-options"
import { VideoExport } from "@/components/video-export"
import { FullscreenButton } from "@/components/fullscreen-button"
import { MultiLayerGradient } from "@/components/multi-layer-gradient"
import { LayerManager } from "@/components/layer-manager"
import { useWebGLSupport } from "@/hooks/use-webgl-support"
import { useGradientStore } from "@/lib/store"
import { useToast } from "@/components/ui/use-toast"
import { useFullscreen } from "@/hooks/use-fullscreen"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"

// ─── Tabela de atalhos exibida no dialog ─────────────────────────────────────
const SHORTCUTS = [
  { key: "Espaço", desc: "Play / Pausar animação" },
  { key: "R", desc: "Restaurar configurações padrão" },
  { key: "S", desc: "Salvar / Capturar imagem" },
  { key: "F", desc: "Alternar tela cheia" },
  { key: "Ctrl + Z", desc: "Desfazer última ação" },
  { key: "Ctrl + Y", desc: "Refazer última ação" },
]

export default function GradientGenerator() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isWebGLSupported = useWebGLSupport()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  const multiLayerMode = useGradientStore((state) => state.multiLayerMode)
  const isPlaying = useGradientStore((state) => state.isPlaying)
  const setIsPlaying = useGradientStore((state) => state.setIsPlaying)
  const resetToDefaults = useGradientStore((state) => state.resetToDefaults)
  const undo = useGradientStore((state) => state.undo)
  const redo = useGradientStore((state) => state.redo)

  const { toggleFullscreen } = useFullscreen()

  // Carregamento inicial
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  // ─── Captura de imagem ────────────────────────────────────────────────────

  const captureImage = useCallback(
    async (format = "png", quality = 1, scale = 1) => {
      try {
        if (!containerRef.current) return
        const canvas = containerRef.current.querySelector("canvas")
        if (!canvas) {
          toast({
            title: "Erro",
            description: "Não foi possível encontrar o canvas para capturar a imagem.",
            variant: "destructive",
          })
          return
        }

        toast({ title: "Processando", description: "Preparando a imagem para download..." })

        let outputCanvas = canvas
        if (scale !== 1) {
          const scaledCanvas = document.createElement("canvas")
          scaledCanvas.width = canvas.width * scale
          scaledCanvas.height = canvas.height * scale
          const ctx = scaledCanvas.getContext("2d")
          if (!ctx) throw new Error("Could not get 2D context")
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = "high"
          ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height)
          outputCanvas = scaledCanvas
        }

        let mimeType = "image/png"
        if (format === "jpeg") mimeType = "image/jpeg"
        if (format === "webp") mimeType = "image/webp"

        const link = document.createElement("a")
        link.download = `gradient-${Date.now()}.${format}`
        link.href = outputCanvas.toDataURL(mimeType, quality)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast({ title: "Sucesso!", description: "Imagem exportada com sucesso." })
      } catch (error) {
        console.error("Error capturing image:", error)
        toast({
          title: "Erro",
          description: "Ocorreu um erro ao exportar a imagem.",
          variant: "destructive",
        })
        throw error
      }
    },
    [toast]
  )

  // ─── Atalhos de teclado ───────────────────────────────────────────────────

  useKeyboardShortcuts({
    onPlayPause: () => setIsPlaying(!isPlaying),
    onReset: () => {
      resetToDefaults()
      toast({
        title: "Configurações Resetadas",
        description: "Todas as configurações foram restauradas para os valores padrão.",
      })
    },
    onFullscreen: () => toggleFullscreen(containerRef.current ?? undefined),
    onSave: () => captureImage(),
    onUndo: () => {
      undo()
      toast({ title: "Desfeito", description: "Última ação desfeita." })
    },
    onRedo: () => {
      redo()
      toast({ title: "Refeito", description: "Ação refeita." })
    },
  })

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin" />
      </div>
    )
  }

  if (!isWebGLSupported) {
    return <WebGLNotSupported />
  }

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden">
      {/* Gradient Scene */}
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

      {/* Export e Vídeo — canto inferior direito */}
      <div className="absolute bottom-4 right-4 z-40 w-64 space-y-2">
        <ExportOptions onExport={captureImage} />
        <VideoExport containerRef={containerRef} />
      </div>

      {/* Layer Manager — canto inferior esquerdo */}
      {multiLayerMode && (
        <div className="absolute bottom-4 left-4 z-40 w-72 bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg shadow-xl p-4">
          <LayerManager />
        </div>
      )}

      {/* Fullscreen — canto superior direito */}
      <div className="absolute top-4 right-4 z-40">
        <FullscreenButton targetRef={containerRef} />
      </div>

      {/* Botão de Ajuda (atalhos) — canto inferior esquerdo (acima do layer manager se ativo) */}
      <div
        className={`absolute z-40 ${multiLayerMode ? "bottom-[calc(1rem+theme(spacing.4)+280px)]" : "bottom-4"} left-4`}
      >
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-black/50 border-gray-700 hover:bg-black/70 text-white"
              title="Atalhos de teclado"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle>Atalhos de Teclado</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {SHORTCUTS.map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between py-1 border-b border-gray-800">
                  <span className="text-gray-300 text-sm">{desc}</span>
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs font-mono text-white border border-gray-600">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
