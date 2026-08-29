"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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

// Color stop editor: a list with position, color and order, plus the tools that
// make the palette a decision rather than a lottery — harmonies derived from the
// first stop and a WCAG contrast readout.
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
  // Position field being typed into. Held locally so intermediate states ("",
  // "1" on the way to "100") survive: writing every keystroke straight to the
  // store would snap the caret back as the value is normalized under it.
  const [draft, setDraft] = useState<{ index: number; value: string } | null>(null)

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

  // Worst-case contrast: text has to work over every color the gradient crosses,
  // not over the average
  const colors = stops.map((stop) => stop.color)
  const whiteContrast = worstContrast(colors, [1, 1, 1])
  const blackContrast = worstContrast(colors, [0, 0, 0])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Label className="text-white">Color Stops</Label>
          <TooltipHelp content="From 2 to 8 stops, each with its own position along the gradient. Click a stop to edit its color." />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={addStop}
          disabled={stops.length >= MAX_STOPS}
          title={
            stops.length >= MAX_STOPS
              ? `Maximum of ${MAX_STOPS} stops`
              : "Add a stop in the largest gap"
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Stop
        </Button>
      </div>

      <GradientSwatch stops={stops} blendSpace={blendSpace} className="h-6 w-full" />

      {/* Stop list */}
      <div className="space-y-1.5">
        {stops.map((stop: ColorStop, index: number) => (
          <div
            key={index}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
              index === activeIndex
                ? "bg-neutral-800 ring-1 ring-inset ring-white/10"
                : "hover:bg-neutral-800/50"
            }`}
          >
            <button
              type="button"
              onClick={() => setSelected(index)}
              className="h-6 w-6 shrink-0 rounded-md ring-1 ring-inset ring-white/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              style={{ backgroundColor: stopToHex(stop) }}
              aria-label={`Edit stop ${index + 1} (${stopToHex(stop)})`}
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
              thumbLabel={`Stop ${index + 1} position`}
            />
            <div className="flex items-center shrink-0">
              <Input
                value={
                  draft?.index === index ? draft.value : String(Math.round(stop.position * 100))
                }
                onChange={(event) => {
                  const value = event.target.value
                  setDraft({ index, value })
                  const parsed = Number(value)
                  if (value.trim() !== "" && Number.isFinite(parsed)) {
                    setSelected(index)
                    setStopPosition(index, Math.min(100, Math.max(0, parsed)) / 100)
                  }
                }}
                onFocus={() => setSelected(index)}
                onBlur={() => setDraft(null)}
                inputMode="numeric"
                className="h-6 w-10 px-1 bg-neutral-900 border-neutral-700 text-right font-mono text-[10px] text-neutral-300"
                aria-label={`Stop ${index + 1} position in percent`}
              />
              <span className="font-mono text-[10px] text-neutral-500 pl-0.5">%</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-neutral-500 hover:text-white"
              onClick={() => removeStop(index)}
              disabled={stops.length <= MIN_STOPS}
              aria-label={`Remove stop ${index + 1}`}
              title={
                stops.length <= MIN_STOPS
                  ? `Minimum of ${MIN_STOPS} stops`
                  : "Remove stop"
              }
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Harmonies */}
      <div className="flex items-center gap-2 pt-2">
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
          title="Regenerate the colors from the first stop, keeping the positions"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Apply
        </Button>
      </div>

      <PaletteFromImage />

      {/* WCAG contrast */}
      <div className="rounded-lg border border-white/5 bg-neutral-900/70 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center">
          <Label className="text-xs text-neutral-400">Text contrast (worst case)</Label>
          <TooltipHelp content="Lowest contrast ratio between the text and the gradient colors, per WCAG 2.1. AA needs 4.5:1 for body text and 3:1 for large text." />
        </div>
        {(
          [
            ["White", whiteContrast],
            ["Black", blackContrast],
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
                    level === "Fail"
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

      {/* Editor for the selected stop */}
      {activeStop && (
        <div className="border-t border-neutral-800/70 pt-4">
          <ColorPicker
            label={`Stop ${activeIndex + 1}`}
            color={activeStop.color}
            onChange={(color) => setStopColor(activeIndex, color)}
          />
        </div>
      )}
    </div>
  )
}
