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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Github, Keyboard, PanelLeftClose, PanelLeftOpen } from "lucide-react"

// ─── Shortcut table shown in the dialog ──────────────────────────────────────
const SHORTCUTS = [
  { key: "Space", desc: "Play / pause the animation" },
  { key: "R", desc: "Restore default settings" },
  { key: "S", desc: "Save / capture an image" },
  { key: "F", desc: "Toggle full screen (clean preview)" },
  { key: "Ctrl + Z", desc: "Undo the last action" },
  { key: "Ctrl + Y", desc: "Redo the last action" },
]

export default function GradientGenerator() {
  // Points only at the artboard: exporting scans the canvases inside it, and full
  // screen shows the art without the app chrome
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

  const { toggleFullscreen } = useFullscreen()

  // The single animation clock (lib/playback.ts)
  usePlaybackDriver()

  // Respect the reduced-motion preference: start paused
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      useGradientStore.getState().setIsPlaying(false)
    }
  }, [])

  // ─── Image capture ────────────────────────────────────────────────────────

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
            title: "Error",
            description: "Could not find a canvas to capture the image from.",
            variant: "destructive",
          })
          return
        }

        toast({ title: "Working", description: "Preparing the image for download…" })

        let mimeType = "image/png"
        if (format === "jpeg") mimeType = "image/jpeg"
        if (format === "webp") mimeType = "image/webp"

        // With no explicit dimensions the artboard decides: the file comes out at
        // the size the preview is showing
        const artboard = getArtboard(useGradientStore.getState().artboardId)
        const target =
          size ??
          (isFreeArtboard(artboard)
            ? undefined
            : { width: artboard.width, height: artboard.height })

        // Re-renders each layer natively at the final resolution (no upscaling)
        // and composes with opacity/blend modes; uses a Blob instead of a dataURL
        // so large files (4K/8K) do not blow up memory
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

        toast({ title: "Done", description: "Image exported successfully." })
      } catch (error) {
        console.error("Error capturing image:", error)
        toast({
          title: "Error",
          description: "Something went wrong while exporting the image.",
          variant: "destructive",
        })
        throw error
      }
    },
    [toast]
  )

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useKeyboardShortcuts({
    onPlayPause: () => setIsPlaying(!isPlaying),
    onReset: () => {
      resetToDefaults()
      toast({
        title: "Settings reset",
        description: "Every setting is back to its default value.",
      })
    },
    onFullscreen: () => toggleFullscreen(artboardRef.current ?? undefined),
    onSave: () => captureImage(),
    onUndo: () => {
      undo()
      toast({ title: "Undone", description: "Last action undone." })
    },
    onRedo: () => {
      redo()
      toast({ title: "Redone", description: "Action redone." })
    },
  })

  if (!isWebGLSupported) {
    return <WebGLNotSupported />
  }

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-950 text-white overflow-hidden">
      {/* ─── Top bar ────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2.5 px-4 py-2.5 border-b border-neutral-800/80 bg-neutral-950 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={toggleSidebar}
          title={sidebarOpen ? "Hide controls" : "Show controls"}
          aria-label={sidebarOpen ? "Hide controls" : "Show controls"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>

        <div className="hidden sm:flex items-baseline gap-2.5 mr-2 min-w-0">
          <h1 className="text-sm font-medium tracking-tight">
            organic gradients
          </h1>
          {/* Quiet byline: name → site, mark → GitHub */}
          <p className="flex items-center gap-1.5 text-[11px] text-neutral-500 tracking-wide">
            <span>developed by</span>
            <a
              href="https://brnczr.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              brnczr
            </a>
            <a
              href="https://github.com/brunocezarl"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="GitHub"
              className="text-neutral-500 hover:text-neutral-200 transition-colors"
            >
              <Github className="h-3 w-3" />
            </a>
          </p>
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
                title="Keyboard shortcuts"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 text-white border-neutral-700">
              <DialogHeader>
                <DialogTitle>Keyboard Shortcuts</DialogTitle>
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

      {/* ─── Body: controls + artboard ─────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <aside className="w-72 lg:w-80 shrink-0 border-r border-neutral-800/80 bg-neutral-950 overflow-y-auto overscroll-contain">
            <ControlsPanel onCaptureImage={() => captureImage()} />
          </aside>
        )}

        <main className="flex flex-col flex-1 min-w-0">
          <ErrorBoundary
            fallback={
              <div className="flex-1 flex items-center justify-center bg-neutral-900 text-white">
                <div className="text-center p-6">
                  <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                  <p className="mb-4">An error occurred while rendering the gradient.</p>
                  <button
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                    onClick={() => window.location.reload()}
                  >
                    Try again
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

          {/* Export also in the footer on narrow screens, where the top bar runs
              out of room */}
          <div className="sm:hidden flex gap-2 p-3 border-t border-neutral-800/80">
            <ExportOptions onExport={captureImage} />
            <VideoExport containerRef={artboardRef} />
            <ShareGradient />
          </div>
        </main>
      </div>
    </div>
  )
}
