"use client"

import { forwardRef, useEffect, useRef, useState } from "react"
import { useGradientStore } from "@/lib/store"
import { getArtboard, isFreeArtboard, SAFE_AREA_INSET } from "@/lib/artboards"

// Artboard: a box at the output aspect ratio, centered on a neutral backdrop.
//
// The backdrop is mid gray on purpose — judging color over pure black (or over
// the art itself, as happened with the translucent panels) distorts perception.
// Safe area guides live outside the canvas, so they never reach the export.

interface ArtboardProps {
  children: React.ReactNode
}

// The fit is measured in JS rather than with `aspect-ratio` + `max-*`: how
// aspect ratio interacts with maximum constraints varies between browsers, and a
// few pixels off here would mean preview and export at different ratios.
function useFittedSize(aspect: number | null) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const element = frameRef.current
    if (!element || aspect === null) {
      setSize(null)
      return
    }

    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      const fitted =
        width / height > aspect
          ? { width: height * aspect, height }
          : { width, height: width / aspect }
      setSize({ width: Math.floor(fitted.width), height: Math.floor(fitted.height) })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [aspect])

  return { frameRef, size }
}

export const Artboard = forwardRef<HTMLDivElement, ArtboardProps>(function Artboard(
  { children },
  ref
) {
  const artboardId = useGradientStore((state) => state.artboardId)
  const showSafeAreas = useGradientStore((state) => state.showSafeAreas)
  const artboard = getArtboard(artboardId)
  const free = isFreeArtboard(artboard)
  const { frameRef, size } = useFittedSize(free ? null : artboard.width / artboard.height)

  return (
    // Padding sits on the outer element and the measurement on the inner one:
    // getBoundingClientRect returns the border box (padding included), and
    // measuring the wrong box made the artboard overflow by exactly the padding
    <div className="relative flex-1 min-h-0 bg-neutral-800 p-4 md:p-6">
      <div ref={frameRef} className="relative w-full h-full flex items-center justify-center">
        <div
          className={`relative ${free ? "w-full h-full" : "shadow-2xl ring-1 ring-black/40"}`}
          style={free ? undefined : { width: size?.width ?? 0, height: size?.height ?? 0 }}
        >
          {/* The ref points at the element holding only the gradient canvases:
              that is what export and full screen use */}
          <div ref={ref} className="absolute inset-0 overflow-hidden bg-black">
            {children}
          </div>

          {showSafeAreas && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute border border-dashed border-white/50"
                style={{
                  top: `${SAFE_AREA_INSET * 100}%`,
                  bottom: `${SAFE_AREA_INSET * 100}%`,
                  left: `${SAFE_AREA_INSET * 100}%`,
                  right: `${SAFE_AREA_INSET * 100}%`,
                }}
              />
              {/* Center axes: where logos and text usually get aligned */}
              <div className="absolute left-1/2 top-0 bottom-0 border-l border-white/20" />
              <div className="absolute top-1/2 left-0 right-0 border-t border-white/20" />
            </div>
          )}
        </div>
      </div>

      {!free && (
        <span className="absolute bottom-1.5 right-2 font-mono text-[10px] text-neutral-400 pointer-events-none">
          {artboard.width}×{artboard.height}
        </span>
      )}
    </div>
  )
})
