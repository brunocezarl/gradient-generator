"use client"

import { BatchExport } from "@/components/batch-export"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { ImageIcon, Loader2, Code2, Copy, Check, Download } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore, resolveActiveStops } from "@/lib/store"
import { stopsToCss } from "@/lib/color-stops"
import {
  generateTokens,
  tokenFormatExtensions,
  tokenFormatLabels,
  type TokenFormat,
} from "@/lib/tokens"

interface ExportOptionsProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  onExport: (
    format: string,
    quality: number,
    scale: number,
    size?: { width: number; height: number },
  ) => Promise<void>
}

// Output sizes. "artboard" (the default) inherits the artboard dimensions — the
// file comes out at the size the preview is showing; the others force a specific
// destination without touching the artboard.
const SIZE_PRESETS: Record<string, { label: string; width?: number; height?: number }> = {
  artboard: { label: "Current artboard" },
  fullhd: { label: "Full HD — 1920×1080", width: 1920, height: 1080 },
  uhd4k: { label: "4K — 3840×2160", width: 3840, height: 2160 },
  qhd: { label: "QHD wallpaper — 2560×1440", width: 2560, height: 1440 },
  square: { label: "Square post — 1080×1080", width: 1080, height: 1080 },
  story: { label: "Story / phone — 1080×1920", width: 1080, height: 1920 },
}

export function ExportOptions({ onExport, containerRef }: ExportOptionsProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState("single")
  const [batchBusy, setBatchBusy] = useState(false)
  const [format, setFormat] = useState("png")
  const [quality, setQuality] = useState(1)
  const [scale, setScale] = useState(1)
  const [sizePreset, setSizePreset] = useState("artboard")
  const [isExporting, setIsExporting] = useState(false)
  const [cssCopied, setCssCopied] = useState(false)
  const { toast } = useToast()

  const [tokenFormat, setTokenFormat] = useState<TokenFormat>("css")

  const { colorScheme, colorSchemes, isCustomMode, customStops, blendSpace } =
    useGradientStore(
      useShallow((state) => ({
        colorScheme: state.colorScheme,
        colorSchemes: state.colorSchemes,
        isCustomMode: state.isCustomMode,
        customStops: state.customStops,
        blendSpace: state.blendSpace,
      }))
    )

  const stops = resolveActiveStops({ isCustomMode, customStops, colorScheme, colorSchemes })
  const schemeName = isCustomMode
    ? "gradient"
    : colorSchemes[colorScheme]?.name ?? colorScheme

  // ─── Tokens ────────────────────────────────────────────────────────────────

  const tokens = generateTokens(tokenFormat, { stops, blendSpace, name: schemeName })

  const copyTokens = async () => {
    try {
      await navigator.clipboard.writeText(tokens)
      setCssCopied(true)
      toast({
        title: "Copied",
        description: `${tokenFormatLabels[tokenFormat]} is on your clipboard.`,
      })
      setTimeout(() => setCssCopied(false), 2000)
    } catch {
      toast({
        title: "Error",
        description: "Could not copy to the clipboard.",
        variant: "destructive",
      })
    }
  }

  const downloadTokens = () => {
    const blob = new Blob([tokens], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `palette.${tokenFormatExtensions[tokenFormat]}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ─── Image export ──────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const preset = SIZE_PRESETS[sizePreset]
      const size =
        preset?.width && preset?.height
          ? { width: preset.width, height: preset.height }
          : undefined
      await onExport(format, quality, scale, size)
      setOpen(false)
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export failed",
        description: "Something went wrong while exporting the image. Try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-label="Export Image"
        size="sm"
        className="w-full sm:w-auto h-8 bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800"
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Image
      </Button>

      <Dialog open={open} onOpenChange={(next) => { if (!batchBusy && !isExporting) setOpen(next) }}>
        <DialogContent className="bg-neutral-900 text-white border-neutral-700">
          <DialogHeader>
            <DialogTitle>Export images</DialogTitle>
            <div className="flex gap-1 pt-3" role="group" aria-label="Export mode">
              <Button variant="ghost" size="sm" aria-pressed={mode === "single"} disabled={batchBusy || isExporting} className={mode === "single" ? "bg-neutral-700" : ""} onClick={() => setMode("single")}>Single image</Button>
              <Button variant="ghost" size="sm" aria-pressed={mode === "kit"} disabled={batchBusy || isExporting} className={mode === "kit" ? "bg-neutral-700" : ""} onClick={() => setMode("kit")}>Image kit · ZIP</Button>
            </div>
          </DialogHeader>

          <DialogBody className={mode === "kit" ? "flex flex-col overflow-hidden" : "space-y-4"}>
            {mode === "kit" ? <BatchExport containerRef={containerRef} onBusyChange={setBatchBusy} /> : <>
            {/* Palette tokens */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-1">
                <Code2 className="h-4 w-4" />
                Palette tokens
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  value={tokenFormat}
                  onValueChange={(value) => setTokenFormat(value as TokenFormat)}
                >
                  <SelectTrigger
                    id="token-format"
                    className="h-8 flex-1 bg-neutral-800 border-neutral-700 text-white text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    {(Object.keys(tokenFormatLabels) as TokenFormat[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {tokenFormatLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
                  onClick={copyTokens}
                  aria-label="Copy tokens"
                >
                  {cssCopied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
                  onClick={downloadTokens}
                  aria-label="Download tokens"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              {/* Wrapping (instead of a second, horizontal scrollbar) keeps the
                  long gradient declaration readable in full. */}
              <pre
                tabIndex={0}
                className="max-h-56 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-md bg-neutral-800 px-3 py-2 text-[10px] leading-relaxed text-green-400 font-mono"
              >
                {tokens}
              </pre>
              <p className="text-xs text-neutral-400">
All {stops.length} stops with their positions, hue/chroma/lightness in OKLCH, and
                the CSS gradient in the same interpolation space as the render.
              </p>
            </div>

            <div className="border-t border-neutral-700 pt-4 space-y-4">
              {/* Format */}
              <div className="space-y-2">
                <Label htmlFor="format" className="text-white">
                  Format
                </Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger id="format" className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Pick a format" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectItem value="png">PNG (lossless)</SelectItem>
                    <SelectItem value="jpeg">JPEG (smaller file)</SelectItem>
                    <SelectItem value="webp">WebP (modern)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quality */}
              {format !== "png" && (
                <div className="space-y-2">
                  <Label htmlFor="quality" className="text-white">
                    Quality
                  </Label>
                  <Select
                    value={quality.toString()}
                    onValueChange={(value) => setQuality(Number(value))}
                  >
                    <SelectTrigger id="quality" className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Pick a quality" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectItem value="0.6">Low (60%)</SelectItem>
                      <SelectItem value="0.8">Medium (80%)</SelectItem>
                      <SelectItem value="0.9">High (90%)</SelectItem>
                      <SelectItem value="1">Maximum (100%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dimensions */}
              <div className="space-y-2">
                <Label htmlFor="size-preset" className="text-white">
                  Dimensions
                </Label>
                <Select value={sizePreset} onValueChange={setSizePreset}>
                  <SelectTrigger id="size-preset" className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Pick the dimensions" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    {Object.entries(SIZE_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scale — only when exporting at artboard size */}
              {sizePreset === "artboard" && (
                <div className="space-y-2">
                  <Label htmlFor="scale" className="text-white">
                    Scale
                  </Label>
                  <Select
                    value={scale.toString()}
                    onValueChange={(value) => setScale(Number(value))}
                  >
                    <SelectTrigger id="scale" className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Pick a scale" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectItem value="0.5">Small (50%)</SelectItem>
                      <SelectItem value="1">Original (100%)</SelectItem>
                      <SelectItem value="2">Large (200%)</SelectItem>
                      <SelectItem value="4">Extra large (400%)</SelectItem>
                      <SelectItem value="8">Ultra (800%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-neutral-400">
The gradient is rendered natively at the final resolution, with the camera
                reprojected to the output aspect ratio — no upscaling, no distortion. Sizes
                above the GPU limit are clamped automatically.
              </p>
            </div>
            </>}
          </DialogBody>

          {mode === "single" && <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleExport}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>}
        </DialogContent>
      </Dialog>
    </>
  )
}
