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

// Extract the palette from a reference image.
//
// This is how a palette is born in practice: the designer already has the photo,
// the frame or the screenshot that sets the mood. Typing hex values by hand is
// busywork.
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
        element.onerror = () => reject(new Error("Could not open the image"))
        element.src = url
      })

      const extracted = await extractPaletteFromImage(image, { count: 4 })
      if (extracted.length < 2) {
        toast({
          title: "Not enough colors",
          description: "This image has too few distinct colors for a palette.",
          variant: "destructive",
        })
        return
      }

      setPalette(extracted)
      setCustomMode(true)
      setStops(stopsFromColors(extracted))
      toast({
        title: "Palette extracted",
        description: `${extracted.length} dominant colors became gradient stops.`,
      })
    } catch (error) {
      toast({
        title: "Could not read the image",
        description: error instanceof Error ? error.message : "Try another file.",
        variant: "destructive",
      })
    } finally {
      URL.revokeObjectURL(url)
      setIsReading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-neutral-400">Palette from an image</Label>
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
          Extract from image
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
        aria-label="Reference image to extract the palette from"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleFile(file)
          // Allows re-opening the same file after tweaking the palette
          event.target.value = ""
        }}
      />
    </div>
  )
}
