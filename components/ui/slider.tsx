"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

// `thumbLabel` names the control that actually receives focus: keyboard and
// screen reader users interact with the thumb (role="slider"), not the root — an
// aria-label on the root is neither announced nor reachable.
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabel?: string }
>(({ className, thumbLabel, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/15">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={thumbLabel}
      className="block h-4 w-4 cursor-pointer rounded-full bg-primary shadow-[0_1px_4px_rgba(0,0,0,0.55)] transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
