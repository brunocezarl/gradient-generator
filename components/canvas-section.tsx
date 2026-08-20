"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TooltipHelp } from "@/components/tooltip-help"
import { useGradientStore } from "@/lib/store"
import { activeRatioChip, artboards, ratioChips } from "@/lib/artboards"

// Canvas: the framing the gradient is composed and exported in.
//
// Two levels of decision, in the order they are actually made — the ratio first,
// as a row of chips, and the exact pixel size second, in the full list. Picking
// 4K from the list keeps the 16:9 chip lit, because it is the same framing.
export function CanvasSection() {
  const artboardId = useGradientStore((state) => state.artboardId)
  const setArtboard = useGradientStore((state) => state.setArtboard)
  const showSafeAreas = useGradientStore((state) => state.showSafeAreas)
  const setShowSafeAreas = useGradientStore((state) => state.setShowSafeAreas)

  const activeChip = activeRatioChip(artboardId)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1">
        {ratioChips.map((chip) => {
          const isActive = activeChip === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              // Already on this framing: clicking would silently drop the size
              // chosen from the list (4K back down to Full HD)
              onClick={() => !isActive && setArtboard(chip.id)}
              aria-pressed={isActive}
              className={`h-7 rounded text-[11px] font-medium tracking-wide transition-colors ${
                isActive
                  ? "bg-white text-neutral-950"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center">
          <Label className="text-xs text-neutral-400">Size</Label>
          <TooltipHelp content="The exported file inherits these dimensions. Free follows the available area — the export then uses the window's own ratio." />
        </div>
        <Select value={artboardId} onValueChange={setArtboard}>
          <SelectTrigger
            className="h-8 bg-neutral-900 border-neutral-700 text-white text-xs"
            aria-label="Artboard"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white max-h-72">
            {artboards.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Label htmlFor="safe-areas" className="text-xs text-neutral-400">
            Safe area guides
          </Label>
          <TooltipHelp content="An inset that marks roughly what story and post UIs cover. A composition guide only — it never shows up in the export." />
        </div>
        <Switch
          id="safe-areas"
          checked={showSafeAreas}
          onCheckedChange={setShowSafeAreas}
        />
      </div>
    </div>
  )
}
