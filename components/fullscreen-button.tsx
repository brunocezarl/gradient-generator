"use client"

import { Button } from "@/components/ui/button"
import { Maximize, Minimize } from "lucide-react"
import { useFullscreen } from "@/hooks/use-fullscreen"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FullscreenButtonProps {
  targetRef?: React.RefObject<HTMLElement | null> // Allow null
}

export function FullscreenButton({ targetRef }: FullscreenButtonProps) {
  const { isFullscreen, toggleFullscreen, isFullscreenEnabled } = useFullscreen()

  if (!isFullscreenEnabled) {
    return null
  }

  const handleToggle = () => {
    if (targetRef?.current) {
      toggleFullscreen(targetRef.current)
    } else {
      toggleFullscreen()
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggle}
            className="bg-black/50 border-gray-700 hover:bg-black/70 text-white"
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{isFullscreen ? "Sair da tela cheia" : "Modo tela cheia"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
