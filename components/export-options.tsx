"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { ImageIcon, Loader2, Code2, Copy, Check } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useGradientStore, resolveActiveColors } from "@/lib/store"
import { rgbToHex } from "@/lib/utils"

interface ExportOptionsProps {
  onExport: (
    format: string,
    quality: number,
    scale: number,
    size?: { width: number; height: number },
  ) => Promise<void>
}

// Tamanhos de saída prontos para os destinos mais comuns (redes sociais,
// wallpapers). "screen" mantém o comportamento original de escalar a tela.
const SIZE_PRESETS: Record<string, { label: string; width?: number; height?: number }> = {
  screen: { label: "Tela atual (usar escala)" },
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
  const [sizePreset, setSizePreset] = useState("screen")
  const [isExporting, setIsExporting] = useState(false)
  const [cssCopied, setCssCopied] = useState(false)
  const { toast } = useToast()

  const { colorScheme, colorSchemes, isCustomMode, customColors } = useGradientStore()

  // ─── Gerar CSS ─────────────────────────────────────────────────────────────

  const generateCSSGradient = (): string => {
    const { color1: c1, color2: c2, color3: c3 } = resolveActiveColors({
      isCustomMode,
      customColors,
      colorScheme,
      colorSchemes,
    })

    const toHex = (c: [number, number, number]) =>
      rgbToHex(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255))

    const h1 = toHex(c1)
    const h2 = toHex(c2)
    const h3 = toHex(c3)

    return `background: linear-gradient(135deg, ${h1} 0%, ${h2} 50%, ${h3} 100%);`
  }

  const handleCopyCSS = async () => {
    const css = generateCSSGradient()
    try {
      await navigator.clipboard.writeText(css)
      setCssCopied(true)
      toast({ title: "CSS Copiado!", description: css })
      setTimeout(() => setCssCopied(false), 2000)
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar para a área de transferência.",
        variant: "destructive",
      })
    }
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
        className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Exportar Imagem
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Opções de Exportação</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Copiar CSS */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-1">
                <Code2 className="h-4 w-4" />
                Exportar CSS
              </Label>
              <div className="flex items-center gap-2 bg-gray-800 rounded-md px-3 py-2">
                <code className="text-xs text-green-400 flex-1 truncate font-mono">
                  {generateCSSGradient()}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-gray-400 hover:text-white"
                  onClick={handleCopyCSS}
                  title="Copiar CSS"
                  aria-label="Copiar CSS"
                >
                  {cssCopied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Aproximação estática: o gradiente animado usa ruído orgânico, que não é
                representável em CSS puro.
              </p>
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-4">
              {/* Formato */}
              <div className="space-y-2">
                <Label htmlFor="format" className="text-white">
                  Formato
                </Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger id="format" className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione o formato" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
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
                    <SelectTrigger id="quality" className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Selecione a qualidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
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
                  <SelectTrigger id="size-preset" className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione as dimensões" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {Object.entries(SIZE_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Escala — apenas quando exportando no tamanho da tela */}
              {sizePreset === "screen" && (
                <div className="space-y-2">
                  <Label htmlFor="scale" className="text-white">
                    Tamanho
                  </Label>
                  <Select
                    value={scale.toString()}
                    onValueChange={(value) => setScale(Number(value))}
                  >
                    <SelectTrigger id="scale" className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="0.5">Pequeno (50%)</SelectItem>
                      <SelectItem value="1">Original (100%)</SelectItem>
                      <SelectItem value="2">Grande (200%)</SelectItem>
                      <SelectItem value="4">Extra Grande (400%)</SelectItem>
                      <SelectItem value="8">Ultra (800%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-gray-400">
                O gradiente é renderizado nativamente na resolução final — sem perda de
                nitidez por upscaling. Tamanhos acima do limite da GPU são ajustados
                automaticamente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
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
