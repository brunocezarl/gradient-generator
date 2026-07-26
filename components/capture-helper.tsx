"use client"

import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { registerCaptureContext, unregisterCaptureContext } from "@/lib/capture"

// Mounted inside each <Canvas> to expose the renderer to the export system, so
// the scene can be re-rendered at export resolution
export function CaptureHelper() {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    registerCaptureContext(canvas, { gl, scene, camera })
    return () => unregisterCaptureContext(canvas)
  }, [gl, scene, camera])

  return null
}
