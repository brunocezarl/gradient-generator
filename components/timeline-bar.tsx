"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Play, Pause, SkipBack, ChevronLeft, ChevronRight, Repeat, Waves } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore } from "@/lib/store"
import { playback } from "@/lib/playback"
import { TooltipHelp } from "@/components/tooltip-help"

// Scrub window when no loop is set: a free animation has no end, so the ruler
// just follows the current instant
const FREE_SCRUB_WINDOW = 30
const STEP_FPS = 30

const LOOP_OPTIONS = [
  { value: "0", label: "Free" },
  { value: "4", label: "4 s" },
  { value: "6", label: "6 s" },
  { value: "8", label: "8 s" },
  { value: "12", label: "12 s" },
  { value: "20", label: "20 s" },
]

export function TimelineBar() {
  const { isPlaying, setIsPlaying, loopDuration, setLoopDuration, shuffleSeed } =
    useGradientStore(
      useShallow((state) => ({
        isPlaying: state.isPlaying,
        setIsPlaying: state.setIsPlaying,
        loopDuration: state.loopDuration,
        setLoopDuration: state.setLoopDuration,
        shuffleSeed: state.shuffleSeed,
      }))
    )

  // Time lives outside React (lib/playback.ts). The ruler mirrors the clock in
  // its own rAF so the whole tree does not re-render at 60 fps.
  const [time, setTime] = useState(0)
  const scrubbingRef = useRef(false)

  useEffect(() => {
    let frame = 0
    const tick = () => {
      if (!scrubbingRef.current) {
        setTime((previous) =>
          Math.abs(previous - playback.time) > 0.01 ? playback.time : previous
        )
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const scrubMax = loopDuration > 0 ? loopDuration : FREE_SCRUB_WINDOW
  const scrubValue = Math.min(time, scrubMax)

  const seek = (next: number) => {
    scrubbingRef.current = true
    setTime(next)
    playback.set(next, loopDuration)
    // Releases the mirror on the next frame, with the value already applied
    requestAnimationFrame(() => {
      scrubbingRef.current = false
    })
  }

  const step = (frames: number) => {
    setIsPlaying(false)
    seek(Math.max(0, time + frames / STEP_FPS))
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border-t border-neutral-800 bg-neutral-950">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          aria-label={isPlaying ? "Pause animation" : "Play animation"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={() => {
            setIsPlaying(false)
            seek(0)
          }}
          title="Back to start"
          aria-label="Back to the start of the animation"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={() => step(-1)}
          title="Previous frame"
          aria-label="Previous frame"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={() => step(1)}
          title="Next frame"
          aria-label="Next frame"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
        <span className="font-mono text-xs text-neutral-400 tabular-nums w-16 shrink-0">
          {time.toFixed(2)}s
        </span>
        <Slider
          value={[scrubValue]}
          min={0}
          max={scrubMax}
          step={1 / STEP_FPS}
          onValueChange={(value) => {
            setIsPlaying(false)
            seek(value[0])
          }}
          thumbLabel="Animation time"
        />
        <span className="font-mono text-xs text-neutral-500 tabular-nums w-16 shrink-0 text-right">
          {scrubMax.toFixed(0)}s
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Repeat className="h-3.5 w-3.5 mr-1.5 text-neutral-400" />
          <Label className="text-xs text-neutral-400">Loop</Label>
          <TooltipHelp content="With a loop set, the animation travels a closed path through the noise field and returns exactly to the start — that is what allows exporting video without a visible seam. On 'Free' the animation drifts without repeating." />
        </div>
        <Select
          value={String(loopDuration)}
          onValueChange={(value) => setLoopDuration(Number(value))}
        >
          <SelectTrigger className="h-8 w-24 bg-neutral-900 border-neutral-700 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            {LOOP_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={shuffleSeed}
          title="Roll another shape, keeping colors and rhythm"
        >
          <Waves className="h-3.5 w-3.5 mr-1.5" />
          Shape
        </Button>
      </div>
    </div>
  )
}
