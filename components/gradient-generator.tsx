"use client"

import { useRef, useEffect, useCallback } from "react"
import { GradientScene } from "@/components/gradient-scene"
import { ControlsPanel } from "@/components/controls-panel"
import ErrorBoundary from "@/components/error-boundary"
import WebGLNotSupported from "@/components/webgl-not-supported"
import { ExportOptions } from "@/components/export-options"
import { VideoExport } from "@/components/video-export"
import { ShareGradient } from "@/components/share-gradient"
import { FullscreenButton } from "@/components/fullscreen-button"
import { MultiLayerGradient } from "@/components/multi-layer-gradient"
import { Artboard } from "@/components/artboard"
import { TimelineBar } from "@/components/timeline-bar"
import { useWebGLSupport } from "@/hooks/use-webgl-support"
import { useGradientStore } from "@/lib/store"
import { exportCompositeImage } from "@/lib/capture"
import { getArtboard, isFreeArtboard } from "@/lib/artboards"
import { useToast } from "@/components/ui/use-toast"
import { useFullscreen } from "@/hooks/use-fullscreen"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { usePlaybackDriver } from "@/hooks/use-playback-driver"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Keyboard, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { artboards } from "@/lib/artboards"

// ─── Tabela de atalhos exibida no dialog ─────────────────────────────────────
const SHORTCUTS = [
  { key: "Espaço", desc: "Play / Pausar animação" },
  { key: "R", desc: "Restaurar configurações padrão" },
  { key: "S", desc: "Salvar / Capturar imagem" },
  { key: "F", desc: "Alternar tela cheia (preview limpo)" },
  { key: "Ctrl + Z", desc: "Desfazer última ação" },
  { key: "Ctrl + Y", desc: "Refazer última ação" },
]

export default function GradientGenerator() {
  // Aponta apenas para a prancheta: a exportação varre os canvases dentro dele,
  // e o fullscreen mostra a arte sem o chrome do app
  const artboardRef = useRef<HTMLDivElement>(null)
  const isWebGLSupported = useWebGLSupport()
  const { toast } = useToast()

  const multiLayerMode = useGradientStore((state) => state.multiLayerMode)
  const sidebarOpen = useGradientStore((state) => state.menuOpen)
  const toggleSidebar = useGradientStore((state) => state.toggleMenu)
  const isPlaying = useGradientStore((state) => state.isPlaying)
  const setIsPlaying = useGradientStore((state) => state.setIsPlaying)
  const resetToDefaults = useGradientStore((state) => state.resetToDefaults)
  const undo = useGradientStore((state) => state.undo)
  const redo = useGradientStore((state) => state.redo)
  const artboardId = useGradientStore((state) => state.artboardId)
  const setArtboard = useGradientStore((state) => state.setArtboard)
  const showSafeAreas = useGradientStore((state) => state.showSafeAreas)
  const setShowSafeAreas = useGradientStore((state) => state.setShowSafeAreas)

  const { toggleFullscreen } = useFullscreen()

  // Relógio único da animação (lib/playback.ts)
  usePlaybackDriver()

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
      scale = 1,
      size?: { width: number; height: number },
    ) => {
      try {
        if (!artboardRef.current) return
        const canvas = artboardRef.current.querySelector("canvas")
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

        // Sem dimensões explícitas, a prancheta manda: o arquivo sai no
        // tamanho que o preview está mostrando
        const artboard = getArtboard(useGradientStore.getState().artboardId)
        const target =
          size ??
          (isFreeArtboard(artboard)
            ? undefined
            : { width: artboard.width, height: artboard.height })

        // Re-renderiza cada camada nativamente na resolução final (sem
        // upscaling) e compõe com opacidade/blend modes; usa Blob em vez de
        // dataURL para suportar arquivos grandes (4K/8K) sem estourar memória
        const blob = await exportCompositeImage(artboardRef.current, {
          scale,
          width: target?.width,
          height: target?.height,
          mimeType,
          quality,
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
    onFullscreen: () => toggleFullscreen(artboardRef.current ?? undefined),
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
    <div className="flex flex-col h-screen w-full bg-neutral-950 text-white overflow-hidden">
      {/* ─── Barra superior ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={toggleSidebar}
          title={sidebarOpen ? "Ocultar controles" : "Mostrar controles"}
          aria-label={sidebarOpen ? "Ocultar controles" : "Mostrar controles"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>

        <h1 className="text-sm font-medium tracking-tight mr-2 hidden sm:block">
          Gradientes Orgânicos
        </h1>

        {/* Prancheta: define a proporção do preview e o tamanho do arquivo */}
        <div className="flex items-center gap-2">
          <Select value={artboardId} onValueChange={setArtboard}>
            <SelectTrigger
              className="h-8 w-[190px] md:w-[230px] bg-neutral-900 border-neutral-700 text-white text-xs"
              aria-label="Prancheta"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-700 text-white max-h-72">
              {artboards.map((artboard) => (
                <SelectItem key={artboard.id} value={artboard.id}>
                  {artboard.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="hidden md:flex items-center gap-2">
            <Switch
              id="safe-areas"
              checked={showSafeAreas}
              onCheckedChange={setShowSafeAreas}
            />
            <Label htmlFor="safe-areas" className="text-xs text-neutral-400">
              Guias
            </Label>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <ExportOptions onExport={captureImage} />
            <VideoExport containerRef={artboardRef} />
            <ShareGradient />
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
                title="Atalhos de teclado"
                aria-label="Atalhos de teclado"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 text-white border-neutral-700">
              <DialogHeader>
                <DialogTitle>Atalhos de Teclado</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                {SHORTCUTS.map(({ key, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1 border-b border-neutral-800"
                  >
                    <span className="text-neutral-300 text-sm">{desc}</span>
                    <kbd className="px-2 py-1 bg-neutral-800 rounded text-xs font-mono text-white border border-neutral-600">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <FullscreenButton targetRef={artboardRef} />
        </div>
      </header>

      {/* ─── Corpo: controles + prancheta ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <aside className="w-72 lg:w-80 shrink-0 border-r border-neutral-800 bg-neutral-950 overflow-y-auto">
            <ControlsPanel onCaptureImage={() => captureImage()} />
          </aside>
        )}

        <main className="flex flex-col flex-1 min-w-0">
          <ErrorBoundary
            fallback={
              <div className="flex-1 flex items-center justify-center bg-neutral-900 text-white">
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
            <Artboard ref={artboardRef}>
              {multiLayerMode ? <MultiLayerGradient /> : <GradientScene />}
            </Artboard>
          </ErrorBoundary>

          <TimelineBar />

          {/* Exportação também no rodapé em telas estreitas, onde a barra
              superior não tem espaço */}
          <div className="sm:hidden flex gap-2 p-2 border-t border-neutral-800">
            <ExportOptions onExport={captureImage} />
            <VideoExport containerRef={artboardRef} />
            <ShareGradient />
          </div>
        </main>
      </div>
    </div>
  )
}
