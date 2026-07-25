"use client"

import { forwardRef, useEffect, useRef, useState } from "react"
import { useGradientStore } from "@/lib/store"
import { getArtboard, isFreeArtboard, SAFE_AREA_INSET } from "@/lib/artboards"

// Prancheta: caixa com a proporção de saída, centrada num fundo neutro.
//
// O fundo é cinza médio de propósito — julgar cor sobre preto puro (ou sobre a
// própria arte, como acontecia com os painéis translúcidos) distorce a
// percepção. As guias de safe area ficam fora do canvas, então não entram na
// exportação.

interface ArtboardProps {
  children: React.ReactNode
}

// Encaixe medido em JS em vez de `aspect-ratio` + `max-*`: a interação entre
// razão de aspecto e restrições máximas depende do navegador, e aqui um erro de
// alguns pixels significaria preview e export com proporções diferentes.
function useFittedSize(aspect: number | null) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const element = frameRef.current
    if (!element || aspect === null) {
      setSize(null)
      return
    }

    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      const fitted =
        width / height > aspect
          ? { width: height * aspect, height }
          : { width, height: width / aspect }
      setSize({ width: Math.floor(fitted.width), height: Math.floor(fitted.height) })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [aspect])

  return { frameRef, size }
}

export const Artboard = forwardRef<HTMLDivElement, ArtboardProps>(function Artboard(
  { children },
  ref
) {
  const artboardId = useGradientStore((state) => state.artboardId)
  const showSafeAreas = useGradientStore((state) => state.showSafeAreas)
  const artboard = getArtboard(artboardId)
  const free = isFreeArtboard(artboard)
  const { frameRef, size } = useFittedSize(free ? null : artboard.width / artboard.height)

  return (
    // O padding fica no elemento externo e a medição no interno: getBoundingClientRect
    // devolve a caixa de borda (padding incluído), e medir a caixa errada fazia a
    // prancheta transbordar exatamente o valor do padding
    <div className="relative flex-1 min-h-0 bg-neutral-800 p-4 md:p-6">
      <div ref={frameRef} className="relative w-full h-full flex items-center justify-center">
        <div
          className={`relative ${free ? "w-full h-full" : "shadow-2xl ring-1 ring-black/40"}`}
          style={free ? undefined : { width: size?.width ?? 0, height: size?.height ?? 0 }}
        >
          {/* O ref aponta para o elemento que contém apenas os canvases do
              gradiente: é o que a exportação e o fullscreen usam */}
          <div ref={ref} className="absolute inset-0 overflow-hidden bg-black">
            {children}
          </div>

          {showSafeAreas && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute border border-dashed border-white/50"
                style={{
                  top: `${SAFE_AREA_INSET * 100}%`,
                  bottom: `${SAFE_AREA_INSET * 100}%`,
                  left: `${SAFE_AREA_INSET * 100}%`,
                  right: `${SAFE_AREA_INSET * 100}%`,
                }}
              />
              {/* Eixos centrais: onde logo e texto costumam ser alinhados */}
              <div className="absolute left-1/2 top-0 bottom-0 border-l border-white/20" />
              <div className="absolute top-1/2 left-0 right-0 border-t border-white/20" />
            </div>
          )}
        </div>
      </div>

      {!free && (
        <span className="absolute bottom-1.5 right-2 font-mono text-[10px] text-neutral-400 pointer-events-none">
          {artboard.width}×{artboard.height}
        </span>
      )}
    </div>
  )
})
