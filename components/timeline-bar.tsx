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

// Janela de scrub quando não há loop definido: a animação livre não tem fim,
// então a régua acompanha o instante atual
const FREE_SCRUB_WINDOW = 30
const STEP_FPS = 30

const LOOP_OPTIONS = [
  { value: "0", label: "Livre" },
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

  // O tempo vive fora do React (lib/playback.ts). A régua espelha o relógio
  // num rAF próprio para não re-renderizar a árvore inteira a 60 fps.
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
    // Solta o espelhamento no próximo frame, já com o valor aplicado
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
          title={isPlaying ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
          aria-label={isPlaying ? "Pausar animação" : "Reproduzir animação"}
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
          title="Voltar ao início"
          aria-label="Voltar ao início da animação"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={() => step(-1)}
          title="Frame anterior"
          aria-label="Frame anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-300 hover:text-white hover:bg-neutral-800"
          onClick={() => step(1)}
          title="Frame seguinte"
          aria-label="Frame seguinte"
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
          thumbLabel="Instante da animação"
        />
        <span className="font-mono text-xs text-neutral-500 tabular-nums w-16 shrink-0 text-right">
          {scrubMax.toFixed(0)}s
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Repeat className="h-3.5 w-3.5 mr-1.5 text-neutral-400" />
          <Label className="text-xs text-neutral-400">Loop</Label>
          <TooltipHelp content="Com um loop definido, a animação percorre um caminho fechado no campo de ruído e volta exatamente ao início — é o que permite exportar vídeo sem corte visível. Em 'Livre' a animação deriva sem repetir." />
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
          title="Sortear outra forma mantendo cores e ritmo"
        >
          <Waves className="h-3.5 w-3.5 mr-1.5" />
          Forma
        </Button>
      </div>
    </div>
  )
}
