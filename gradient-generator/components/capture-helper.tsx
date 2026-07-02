"use client"

import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { registerCaptureContext, unregisterCaptureContext } from "@/lib/capture"

// Montado dentro de cada <Canvas> para expor o renderer ao sistema de
// exportação, permitindo re-renderizar a cena na resolução de exportação
export function CaptureHelper() {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    registerCaptureContext(canvas, { gl, scene, camera })
    return () => unregisterCaptureContext(canvas)
  }, [gl, scene, camera])

  return null
}
