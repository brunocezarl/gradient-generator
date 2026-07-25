"use client"

import { ReactNode } from "react"
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

export function TooltipHelp({ content, side = "top" }: TooltipHelpProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-neutral-400 hover:text-neutral-300 cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs bg-neutral-800 text-white border-neutral-700">
          <div className="text-sm">{content}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
