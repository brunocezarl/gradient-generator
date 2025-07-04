"use client"

import { useState, useEffect } from "react"

export function useWebGLSupport(): boolean {
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    try {
      // Try to create a WebGL context
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
      
      // If we couldn't get a WebGL context, WebGL isn't supported
      if (!gl) {
        setIsSupported(false)
        return
      }
      
      // Clean up
      canvas.remove()
    } catch (e) {
      console.error("Error checking WebGL support:", e)
      setIsSupported(false)
    }
  }, [])

  return isSupported
}
