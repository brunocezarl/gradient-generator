"use client"

import { useRef } from "react"
import { stopToHex, type ColorStop } from "@/lib/color-stops"
import type { ColorBlendSpace } from "@/lib/color"
import { GradientSwatch } from "@/components/gradient-swatch"

interface StopsBarProps {
  stops: readonly ColorStop[]
  blendSpace: ColorBlendSpace
  selected: number
  onSelect: (index: number) => void
  onMove: (index: number, position: number) => void
}

// The gradient with its stops on it. Position is edited where it is seen:
// each handle sits at its stop and is dragged along the bar. Handles are
// sliders to assistive tech and move with the arrow keys (Shift for 10%).
export function StopsBar({ stops, blendSpace, selected, onSelect, onMove }: StopsBarProps) {
  const barRef = useRef<HTMLDivElement>(null)

  const positionAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    const ratio = (clientX - rect.left) / rect.width
    // Whole percents, like the numeric field next to each stop
    return Math.round(Math.min(1, Math.max(0, ratio)) * 100) / 100
  }

  return (
    // Side padding equals half a handle, so 0% and 100% sit on the bar's ends
    // without the handle hanging outside the panel
    <div className="px-2">
      <div ref={barRef} className="relative h-10 touch-none select-none">
        <GradientSwatch
          stops={stops}
          blendSpace={blendSpace}
          className="absolute inset-x-0 top-0 h-6 ring-1 ring-inset ring-white/10"
        />
        {stops.map((stop, index) => {
          const active = index === selected
          const percent = Math.round(stop.position * 100)
          return (
            <button
              key={index}
              type="button"
              role="slider"
              aria-label={`Stop ${index + 1} position`}
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={`${percent}%, ${stopToHex(stop)}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                onSelect(index)
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                const next = positionAt(event.clientX)
                if (next !== null && next !== stop.position) onMove(index, next)
              }}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.1 : 0.01
                const delta =
                  event.key === "ArrowRight" || event.key === "ArrowUp"
                    ? step
                    : event.key === "ArrowLeft" || event.key === "ArrowDown"
                      ? -step
                      : 0
                const next =
                  event.key === "Home" ? 0 : event.key === "End" ? 1 : stop.position + delta
                if (next === stop.position) return
                event.preventDefault()
                onMove(index, Math.round(Math.min(1, Math.max(0, next)) * 100) / 100)
              }}
              onFocus={() => onSelect(index)}
              style={{ left: `${stop.position * 100}%`, zIndex: active ? 2 : 1 }}
              className="group absolute top-0 flex h-10 w-6 -translate-x-1/2 cursor-ew-resize flex-col items-center focus-visible:outline-none"
            >
              {/* Tick across the bar marks the exact position */}
              <span
                className={`h-6 w-0.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.45)] ${
                  active ? "bg-white" : "bg-white/70"
                }`}
              />
              <span
                className={`mt-0.5 h-3.5 w-3.5 rounded-full border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-ring/70 ${
                  active ? "border-white scale-110" : "border-white/70"
                }`}
                style={{ backgroundColor: stopToHex(stop) }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
