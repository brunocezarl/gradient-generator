"use client"

import { useRef, useEffect, useCallback } from "react"
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
import { exportCompositeImage, type ImageExportTarget } from "@/lib/capture"
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

  const multiLayerMode = useGradientStore((state) => state.multiLayerMode)
  const isPlaying = useGradientStore((state) => state.isPlaying)
  const setIsPlaying = useGradientStore((state) => state.setIsPlaying)
  const resetToDefaults = useGradientStore((state) => state.resetToDefaults)
  const undo = useGradientStore((state) => state.undo)
  const redo = useGradientStore((state) => state.redo)

  const { toggleFullscreen } = useFullscreen()

  // Respeitar preferência de movimento reduzido: iniciar pausado
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      useGradientStore.getState().setIsPlaying(false)
    }
  }, [])

  // ─── Captura de imagem ────────────────────────────────────────────────────

  const captureImage = useCallback(
    async (
      format = "png",
      quality = 1,
      target: ImageExportTarget = { kind: "scale", scale: 1 },
      supersample = 1,
    ) => {
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

        let mimeType = "image/png"
        if (format === "jpeg") mimeType = "image/jpeg"
        if (format === "webp") mimeType = "image/webp"

        // Re-renderiza cada camada nativamente na resolução final (sem
        // upscaling) e compõe com opacidade/blend modes; usa Blob em vez de
        // dataURL para suportar arquivos grandes (4K/8K) sem estourar memória
        const blob = await exportCompositeImage(containerRef.current, {
          target,
          mimeType,
          quality,
          supersample,
        })

        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.download = `gradient-${Date.now()}.${format}`
        link.href = url
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(url), 1000)

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

      {/* Layer Manager — canto inferior esquerdo (em telas pequenas fica
          disponível apenas na aba "Camadas" do painel de controles, para não
          sobrepor os botões de exportação) */}
      {multiLayerMode && (
        <div className="absolute bottom-4 left-4 z-40 w-72 hidden md:block bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg shadow-xl p-4">
          <LayerManager />
        </div>
      )}

      {/* Fullscreen — canto superior direito */}
      <div className="absolute top-4 right-4 z-40">
        <FullscreenButton targetRef={containerRef} />
      </div>

      {/* Botão de Ajuda (atalhos) — canto inferior esquerdo (acima do layer manager se ativo) */}
      <div
        className={`absolute z-40 left-4 ${multiLayerMode ? "bottom-4 md:bottom-[calc(1rem+theme(spacing.4)+280px)]" : "bottom-4"}`}
      >
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-black/50 border-gray-700 hover:bg-black/70 text-white"
              title="Atalhos de teclado"
              aria-label="Atalhos de teclado"
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
