"use client"

import { useState, useEffect } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"

type DeviceQuality = "low" | "medium" | "high"

export function useDeviceOptimizations() {
  const [quality, setQuality] = useState<DeviceQuality>("medium")
  const isMobile = useMediaQuery("(max-width: 768px)")
  const isLowPowerMode = useMediaQuery("(prefers-reduced-motion: reduce)")

  useEffect(() => {
    // Detectar a qualidade do dispositivo com base em heurísticas
    const detectQuality = () => {
      // Verificar se estamos em um dispositivo móvel
      if (isMobile) {
        // Dispositivos móveis começam com qualidade baixa por padrão
        setQuality("low")
        return
      }

      // Verificar se o usuário prefere movimento reduzido
      if (isLowPowerMode) {
        setQuality("low")
        return
      }

      // Verificar o número de núcleos lógicos da CPU (se disponível)
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

      // Fallback para qualidade média se não conseguirmos determinar
      setQuality("medium")
    }

    detectQuality()
  }, [isMobile, isLowPowerMode])

  // Retornar configurações otimizadas com base na qualidade
  return {
    quality,
    frameSkip: quality === "low" ? 2 : quality === "medium" ? 1 : 0,
    maxComplexity: quality === "low" ? 5 : quality === "medium" ? 8 : 10,
    pixelRatio: quality === "low" ? 1 : quality === "medium" ? 1.5 : 2,
    antialias: quality !== "low",
    isMobile,
    isLowPower: isLowPowerMode
  }
}
