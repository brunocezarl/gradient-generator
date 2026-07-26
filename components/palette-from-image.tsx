"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ImagePlus, Loader2 } from "lucide-react"
import { useGradientStore } from "@/lib/store"
import { extractPaletteFromImage } from "@/lib/palette-extract"
import { stopsFromColors } from "@/lib/color-stops"
import { useToast } from "@/components/ui/use-toast"
import type { RgbTriplet } from "@/lib/color"

// Extrair a paleta de uma imagem de referência.
//
// É como uma paleta nasce na prática: o designer já tem a foto, o frame ou o
// print que define o clima da peça. Digitar os hex na mão é retrabalho.
export function PaletteFromImage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [palette, setPalette] = useState<RgbTriplet[]>([])
  const [isReading, setIsReading] = useState(false)
  const setStops = useGradientStore((state) => state.setStops)
  const setCustomMode = useGradientStore((state) => state.setCustomMode)
  const { toast } = useToast()

  const handleFile = async (file: File) => {
    setIsReading(true)
    const url = URL.createObjectURL(file)

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new Error("Não foi possível abrir a imagem"))
        element.src = url
      })

      const extracted = await extractPaletteFromImage(image, { count: 4 })
      if (extracted.length < 2) {
        toast({
          title: "Poucas cores",
          description: "A imagem não tem cores distintas suficientes para uma paleta.",
          variant: "destructive",
        })
        return
      }

      setPalette(extracted)
      setCustomMode(true)
      setStops(stopsFromColors(extracted))
      toast({
        title: "Paleta extraída",
        description: `${extracted.length} cores dominantes viraram paradas do gradiente.`,
      })
    } catch (error) {
      toast({
        title: "Erro ao ler a imagem",
        description: error instanceof Error ? error.message : "Tente outro arquivo.",
        variant: "destructive",
      })
    } finally {
      URL.revokeObjectURL(url)
      setIsReading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-neutral-400">Paleta de uma imagem</Label>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1 bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={isReading}
        >
          {isReading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
          )}
          Extrair de imagem
        </Button>

        {palette.length > 0 && (
          <span className="flex gap-0.5" aria-hidden>
            {palette.map((color, index) => (
              <span
                key={index}
                className="h-6 w-4 rounded-sm border border-neutral-700"
                style={{
                  backgroundColor: `rgb(${color.map((c) => Math.round(c * 255)).join(",")})`,
                }}
              />
            ))}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Imagem de referência para extrair a paleta"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleFile(file)
          // Permite reabrir o mesmo arquivo depois de ajustar a paleta
          event.target.value = ""
        }}
      />
    </div>
  )
}
