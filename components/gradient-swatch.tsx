"use client"

import { stopsToCss, type ColorStop } from "@/lib/color-stops"
import type { ColorBlendSpace } from "@/lib/color"
import { cn } from "@/lib/utils"

// Swatch of the gradient formed by the stops. Used in scheme selectors, in
// thumbnails and in the stops editor — one source for the preview, in the same
// interpolation space as the render.
export function GradientSwatch({
  stops,
  blendSpace = "oklab",
  angle = "90deg",
  className,
}: {
  stops: readonly ColorStop[]
  blendSpace?: ColorBlendSpace
  angle?: string
  className?: string
}) {
  return (
    <span
      className={cn("block rounded", className)}
      style={{ background: stopsToCss(stops, blendSpace, angle) }}
    />
  )
}

// Dots with the stop colors, for compact lists (selectors)
export function StopDots({ stops }: { stops: readonly ColorStop[] }) {
  return (
    <span className="flex mr-2 shrink-0">
      {stops.slice(0, 4).map((stop, index) => (
        <span
          key={index}
          className="w-3 h-3 rounded-full -ml-0.5 first:ml-0 border border-black/30"
          style={{
            backgroundColor: `rgb(${stop.color.map((c) => Math.round(c * 255)).join(",")})`,
          }}
        />
      ))}
    </span>
  )
}
