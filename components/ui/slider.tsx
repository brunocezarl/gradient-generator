"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

// `thumbLabel` names the control that actually receives focus: keyboard and
// screen reader users interact with the thumb (role="slider"), not the root — an
// aria-label on the root is neither announced nor reachable.
//
// `trackBackground` paints the track with a CSS background — the color picker
// uses it to show what each position of a channel produces. The filled range
// is then dropped (it would cover the very colors being shown) and the thumb
// gains a dark outline so it stays readable over any color.
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    thumbLabel?: string
    trackBackground?: string
  }
>(({ className, thumbLabel, trackBackground, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        "relative w-full grow overflow-hidden rounded-full",
        trackBackground ? "h-2.5 ring-1 ring-inset ring-white/10" : "h-1.5 bg-white/15"
      )}
      style={trackBackground ? { background: trackBackground } : undefined}
    >
      {!trackBackground && <SliderPrimitive.Range className="absolute h-full bg-primary" />}
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={thumbLabel}
      className={cn(
        "block h-4 w-4 cursor-pointer rounded-full bg-primary shadow-[0_1px_4px_rgba(0,0,0,0.55)] transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50",
        trackBackground && "border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.55),0_1px_4px_rgba(0,0,0,0.55)]"
      )}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
