"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Sparkles } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore } from "@/lib/store"
import {
  MAX_STOPS,
  MIN_STOPS,
  sortStops,
  stopToHex,
  type ColorStop,
} from "@/lib/color-stops"
import {
  contrastLevel,
  generateHarmony,
  harmonyLabels,
  oklchToSrgb,
  srgbToOklch,
  worstContrast,
  type HarmonyKind,
} from "@/lib/oklch"
import { ColorPicker } from "@/components/color-picker"
import { GradientSwatch } from "@/components/gradient-swatch"
import { PaletteFromImage } from "@/components/palette-from-image"
import { TooltipHelp } from "@/components/tooltip-help"

const HARMONY_KINDS = Object.keys(harmonyLabels) as HarmonyKind[]

// Editor das paradas de cor: lista com posição, cor e ordem, mais as
// ferramentas que fazem a paleta ser uma decisão e não um sorteio — harmonias
// derivadas da primeira parada e leitura de contraste WCAG.
export function StopsEditor() {
  const { stops, blendSpace, setStopColor, setStopPosition, setStops, addStop, removeStop } =
    useGradientStore(
      useShallow((state) => ({
        stops: state.customStops,
        blendSpace: state.blendSpace,
        setStopColor: state.setStopColor,
        setStopPosition: state.setStopPosition,
        setStops: state.setStops,
        addStop: state.addStop,
        removeStop: state.removeStop,
      }))
    )

  const [selected, setSelected] = useState(0)
  const [harmony, setHarmony] = useState<HarmonyKind>("analogous")

  const activeIndex = Math.min(selected, stops.length - 1)
  const activeStop = stops[activeIndex]

  const applyHarmony = () => {
    const base = srgbToOklch(sortStops(stops)[0].color)
    const palette = generateHarmony(base, harmony, { count: stops.length })
    setStops(
      palette.map((color, index) => ({
        color: oklchToSrgb(color),
        position: sortStops(stops)[index]?.position ?? index / (palette.length - 1),
      }))
    )
  }

  // Contraste no pior caso: o texto tem de funcionar sobre todas as cores por
  // onde o gradiente passa, não sobre a média
  const colors = stops.map((stop) => stop.color)
  const whiteContrast = worstContrast(colors, [1, 1, 1])
  const blackContrast = worstContrast(colors, [0, 0, 0])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Label className="text-white">Paradas de Cor</Label>
          <TooltipHelp content="De 2 a 8 paradas, cada uma com sua posição ao longo do gradiente. Clique numa parada para editar a cor." />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={addStop}
          disabled={stops.length >= MAX_STOPS}
          title={
            stops.length >= MAX_STOPS
              ? `Máximo de ${MAX_STOPS} paradas`
              : "Adicionar parada no maior intervalo"
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Parada
        </Button>
      </div>

      <GradientSwatch stops={stops} blendSpace={blendSpace} className="h-6 w-full" />

      {/* Lista de paradas */}
      <div className="space-y-1.5">
        {stops.map((stop: ColorStop, index: number) => (
          <div
            key={index}
            className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
              index === activeIndex ? "bg-neutral-800" : "hover:bg-neutral-800/50"
            }`}
          >
            <button
              type="button"
              onClick={() => setSelected(index)}
              className="h-6 w-6 shrink-0 rounded border border-neutral-600"
              style={{ backgroundColor: stopToHex(stop) }}
              aria-label={`Editar parada ${index + 1} (${stopToHex(stop)})`}
              title={stopToHex(stop)}
            />
            <span className="font-mono text-[10px] text-neutral-400 w-12 shrink-0">
              {stopToHex(stop)}
            </span>
            <Slider
              value={[stop.position * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => {
                setSelected(index)
                setStopPosition(index, value[0] / 100)
              }}
              className="h-2"
              thumbLabel={`Posição da parada ${index + 1}`}
            />
            <span className="font-mono text-[10px] text-neutral-500 w-8 shrink-0 text-right">
              {Math.round(stop.position * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-neutral-500 hover:text-white"
              onClick={() => removeStop(index)}
              disabled={stops.length <= MIN_STOPS}
              aria-label={`Remover parada ${index + 1}`}
              title={
                stops.length <= MIN_STOPS
                  ? `Mínimo de ${MIN_STOPS} paradas`
                  : "Remover parada"
              }
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Harmonias */}
      <div className="flex items-center gap-2 pt-1">
        <Select value={harmony} onValueChange={(value) => setHarmony(value as HarmonyKind)}>
          <SelectTrigger className="h-8 flex-1 bg-neutral-900 border-neutral-700 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            {HARMONY_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {harmonyLabels[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-8 bg-neutral-700 hover:bg-neutral-600 text-white text-xs"
          onClick={applyHarmony}
          title="Regerar as cores a partir da primeira parada, mantendo as posições"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Aplicar
        </Button>
      </div>

      <PaletteFromImage />

      {/* Contraste WCAG */}
      <div className="rounded-md bg-neutral-900 px-2.5 py-2 space-y-1">
        <div className="flex items-center">
          <Label className="text-xs text-neutral-400">Contraste de texto (pior caso)</Label>
          <TooltipHelp content="Menor razão de contraste entre o texto e as cores do gradiente, segundo a WCAG 2.1. AA exige 4.5:1 para texto normal e 3:1 para texto grande." />
        </div>
        {(
          [
            ["Branco", whiteContrast],
            ["Preto", blackContrast],
          ] as const
        ).map(([name, ratio]) => {
          const level = contrastLevel(ratio)
          return (
            <div key={name} className="flex items-center justify-between text-xs">
              <span className="text-neutral-300">{name}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-neutral-400">{ratio.toFixed(2)}:1</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    level === "Insuficiente"
                      ? "bg-red-500/20 text-red-300"
                      : level === "AA Large"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-green-500/20 text-green-300"
                  }`}
                >
                  {level}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {/* Editor da parada selecionada */}
      {activeStop && (
        <div className="border-t border-neutral-800 pt-3">
          <ColorPicker
            label={`Parada ${activeIndex + 1}`}
            color={activeStop.color}
            onChange={(color) => setStopColor(activeIndex, color)}
          />
        </div>
      )}
    </div>
  )
}
