"use client"

import { useState, useEffect, useCallback } from "react"

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Check if fullscreen is supported
  const isFullscreenEnabled = typeof document !== "undefined" && 
    (document.fullscreenEnabled || 
     (document as any).webkitFullscreenEnabled || 
     (document as any).mozFullScreenEnabled ||
     (document as any).msFullscreenEnabled)

  // Update state when fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        )
      )
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
    }
  }, [])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async (element?: HTMLElement) => {
    if (!isFullscreenEnabled) return

    try {
      const targetElement = element || document.documentElement

      if (!isFullscreen) {
        if (targetElement.requestFullscreen) {
          await targetElement.requestFullscreen()
        } else if ((targetElement as any).webkitRequestFullscreen) {
          await (targetElement as any).webkitRequestFullscreen()
        } else if ((targetElement as any).mozRequestFullScreen) {
          await (targetElement as any).mozRequestFullScreen()
        } else if ((targetElement as any).msRequestFullscreen) {
          await (targetElement as any).msRequestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen()
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen()
        }
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error)
    }
  }, [isFullscreen, isFullscreenEnabled])

  return {
    isFullscreen,
    toggleFullscreen,
    isFullscreenEnabled
  }
}
