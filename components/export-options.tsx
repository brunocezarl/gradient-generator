"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
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
  onExport: (
    format: string,
    quality: number,
    scale: number,
    size?: { width: number; height: number },
  ) => Promise<void>
}

// Tamanhos de saída. "artboard" (padrão) herda as dimensões da prancheta — o
// arquivo sai no tamanho que o preview está mostrando; os demais forçam um
// destino específico sem mexer na prancheta.
const SIZE_PRESETS: Record<string, { label: string; width?: number; height?: number }> = {
  artboard: { label: "Prancheta atual" },
  fullhd: { label: "Full HD — 1920×1080", width: 1920, height: 1080 },
  uhd4k: { label: "4K — 3840×2160", width: 3840, height: 2160 },
  qhd: { label: "Wallpaper QHD — 2560×1440", width: 2560, height: 1440 },
  square: { label: "Post quadrado — 1080×1080", width: 1080, height: 1080 },
  story: { label: "Story / Celular — 1080×1920", width: 1080, height: 1920 },
}

export function ExportOptions({ onExport }: ExportOptionsProps) {
  const [open, setOpen] = useState(false)
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
        title: "Copiado!",
        description: `${tokenFormatLabels[tokenFormat]} na área de transferência.`,
      })
      setTimeout(() => setCssCopied(false), 2000)
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar para a área de transferência.",
        variant: "destructive",
      })
    }
  }

  const downloadTokens = () => {
    const blob = new Blob([tokens], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `paleta.${tokenFormatExtensions[tokenFormat]}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ─── Exportar imagem ────────────────────────────────────────────────────────

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
        title: "Erro na Exportação",
        description: "Ocorreu um erro ao exportar a imagem. Tente novamente.",
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
        aria-label="Exportar Imagem"
        size="sm"
        className="w-full sm:w-auto h-8 bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800"
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Imagem
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-neutral-900 text-white border-neutral-700">
          <DialogHeader>
            <DialogTitle>Opções de Exportação</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Tokens da paleta */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-1">
                <Code2 className="h-4 w-4" />
                Tokens da paleta
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
                  aria-label="Copiar tokens"
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
                  aria-label="Baixar tokens"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <pre className="max-h-32 overflow-auto rounded-md bg-neutral-800 px-3 py-2 text-[10px] leading-relaxed text-green-400 font-mono">
                {tokens}
              </pre>
              <p className="text-xs text-neutral-400">
                As {stops.length} paradas com posição, matiz/croma/luminosidade em OKLCH e o
                gradiente CSS no mesmo espaço de interpolação do render.
              </p>
            </div>

            <div className="border-t border-neutral-700 pt-4 space-y-4">
              {/* Formato */}
              <div className="space-y-2">
                <Label htmlFor="format" className="text-white">
                  Formato
                </Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger id="format" className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Selecione o formato" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectItem value="png">PNG (Sem perdas)</SelectItem>
                    <SelectItem value="jpeg">JPEG (Menor tamanho)</SelectItem>
                    <SelectItem value="webp">WebP (Moderno)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Qualidade */}
              {format !== "png" && (
                <div className="space-y-2">
                  <Label htmlFor="quality" className="text-white">
                    Qualidade
                  </Label>
                  <Select
                    value={quality.toString()}
                    onValueChange={(value) => setQuality(Number(value))}
                  >
                    <SelectTrigger id="quality" className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Selecione a qualidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectItem value="0.6">Baixa (60%)</SelectItem>
                      <SelectItem value="0.8">Média (80%)</SelectItem>
                      <SelectItem value="0.9">Alta (90%)</SelectItem>
                      <SelectItem value="1">Máxima (100%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dimensões */}
              <div className="space-y-2">
                <Label htmlFor="size-preset" className="text-white">
                  Dimensões
                </Label>
                <Select value={sizePreset} onValueChange={setSizePreset}>
                  <SelectTrigger id="size-preset" className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectValue placeholder="Selecione as dimensões" />
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

              {/* Escala — apenas quando exportando no tamanho da tela */}
              {sizePreset === "artboard" && (
                <div className="space-y-2">
                  <Label htmlFor="scale" className="text-white">
                    Tamanho
                  </Label>
                  <Select
                    value={scale.toString()}
                    onValueChange={(value) => setScale(Number(value))}
                  >
                    <SelectTrigger id="scale" className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectItem value="0.5">Pequeno (50%)</SelectItem>
                      <SelectItem value="1">Original (100%)</SelectItem>
                      <SelectItem value="2">Grande (200%)</SelectItem>
                      <SelectItem value="4">Extra Grande (400%)</SelectItem>
                      <SelectItem value="8">Ultra (800%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-neutral-400">
                O gradiente é renderizado nativamente na resolução final, com a câmera
                reprojetada na proporção de saída — sem upscaling e sem distorção.
                Tamanhos acima do limite da GPU são ajustados automaticamente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
              >
                Cancelar
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
                  Exportando...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Exportar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
