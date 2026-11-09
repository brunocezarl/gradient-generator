"use client"

import { ReactNode, useState } from "react"
import { HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TooltipHelpProps {
  content: ReactNode
  side?: "top" | "right" | "bottom" | "left"
}

// The trigger is a real button, not a bare icon: it takes keyboard focus (which
// opens the tooltip) and a tap opens it on touch screens, where hover never fires.
export function TooltipHelp({ content, side = "top" }: TooltipHelpProps) {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300} open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="More info"
            // Radix closes the tooltip on click; preventing that default keeps
            // it open so a tap (or Enter) is a way in, not a way out
            onClick={(event) => {
              event.preventDefault()
              setOpen(true)
            }}
            className="ml-1 -my-1 inline-flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs bg-neutral-800 text-white border-neutral-700">
          <div className="text-sm">{content}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
