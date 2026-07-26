"use client"

import { useState, useEffect } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"

type DeviceQuality = "low" | "medium" | "high"

export function useDeviceOptimizations() {
  const [quality, setQuality] = useState<DeviceQuality>("medium")
  const isMobile = useMediaQuery("(max-width: 768px)")
  const isLowPowerMode = useMediaQuery("(prefers-reduced-motion: reduce)")

  useEffect(() => {
    // Detect device quality from heuristics
    const detectQuality = () => {
      // Check whether we are on a mobile device
      if (isMobile) {
        // Mobile devices start at low quality by default
        setQuality("low")
        return
      }

      // Check whether the user prefers reduced motion
      if (isLowPowerMode) {
        setQuality("low")
        return
      }

      // Check the number of logical CPU cores (when available)
      if (navigator.hardwareConcurrency) {
        if (navigator.hardwareConcurrency >= 8) {
          setQuality("high")
        } else if (navigator.hardwareConcurrency >= 4) {
          setQuality("medium")
        } else {
          setQuality("low")
        }
        return
      }

      // Fall back to medium quality when we cannot tell
      setQuality("medium")
    }

    detectQuality()
  }, [isMobile, isLowPowerMode])

  // Quality-based settings. Adaptation happens through *resolution* (pixelRatio)
  // rather than skipping frames: half the frame rate makes the animation stutter,
  // while rendering fewer pixels keeps the motion fluid.
  return {
    quality,
    maxComplexity: quality === "low" ? 5 : quality === "medium" ? 8 : 10,
    pixelRatio: quality === "low" ? 1 : quality === "medium" ? 1.5 : 2,
    antialias: quality !== "low",
    isMobile,
    isLowPower: isLowPowerMode
  }
}
