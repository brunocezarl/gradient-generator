"use client"

import { useState, useEffect } from "react"

export function useWebGLSupport(): boolean | null {
  const [isSupported, setIsSupported] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl2")
      setIsSupported(gl !== null)
      gl?.getExtension("WEBGL_lose_context")?.loseContext()
    } catch (e) {
      console.error("Error checking WebGL support:", e)
      setIsSupported(false)
    }
  }, [])

  return isSupported
}
