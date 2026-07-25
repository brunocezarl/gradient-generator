"use client"

import { useRef, useMemo, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type * as THREE from "three"
import {
  organicGradientFragmentShader,
  organicGradientVertexShader,
} from "@/lib/shaders/organic-gradient"
import { srgbTripletToLinear, type ColorBlendSpace } from "@/lib/color"

export interface OrganicGradientParams {
  isPlaying: boolean
  speed: number
  complexity: number
  noiseScale: number
  // Cores em sRGB 0-1, como saem do color picker
  colors: {
    color1: number[]
    color2: number[]
    color3: number[]
  }
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number
  vibrance: number
  blendSpace: ColorBlendSpace
  seed: [number, number]
}

// Único componente de shader do app: a cena simples e cada camada do modo
// multi-camadas renderizam por aqui, garantindo que a mesma configuração
// produza a mesma imagem nos dois modos.
export function OrganicGradientShader({
  isPlaying,
  speed,
  complexity,
  noiseScale,
  colors,
  flowIntensity,
  grainAmount,
  grainScale,
  thresholdMin,
  thresholdMax,
  vibrance,
  blendSpace,
  seed,
}: OrganicGradientParams) {
  const meshRef = useRef<THREE.Mesh>(null)
  const timeRef = useRef(0)
  const invalidate = useThree((state) => state.invalidate)

  // Valores iniciais apenas — as atualizações acontecem no effect abaixo, sem
  // recriar o material (recriar recompila o shader e pisca a tela)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uComplexity: { value: complexity },
      uNoiseScale: { value: noiseScale },
      uColor1: { value: srgbTripletToLinear(colors.color1) },
      uColor2: { value: srgbTripletToLinear(colors.color2) },
      uColor3: { value: srgbTripletToLinear(colors.color3) },
      uFlowIntensity: { value: flowIntensity },
      uGrainAmount: { value: grainAmount },
      uGrainScale: { value: grainScale },
      uThresholdMin: { value: thresholdMin },
      uThresholdMax: { value: thresholdMax },
      uVibrance: { value: vibrance },
      uOklabMix: { value: blendSpace === "oklab" ? 1 : 0 },
      uSeed: { value: [seed[0], seed[1]] },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    const material = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) return

    material.uniforms.uComplexity.value = complexity
    material.uniforms.uNoiseScale.value = noiseScale
    material.uniforms.uColor1.value = srgbTripletToLinear(colors.color1)
    material.uniforms.uColor2.value = srgbTripletToLinear(colors.color2)
    material.uniforms.uColor3.value = srgbTripletToLinear(colors.color3)
    material.uniforms.uFlowIntensity.value = flowIntensity
    material.uniforms.uGrainAmount.value = grainAmount
    material.uniforms.uGrainScale.value = grainScale
    material.uniforms.uThresholdMin.value = thresholdMin
    material.uniforms.uThresholdMax.value = thresholdMax
    material.uniforms.uVibrance.value = vibrance
    material.uniforms.uOklabMix.value = blendSpace === "oklab" ? 1 : 0
    material.uniforms.uSeed.value = [seed[0], seed[1]]

    // Com a animação pausada o canvas roda em frameloop "demand": sem isto a
    // tela ficaria com a imagem antiga ao mexer nos controles
    invalidate()
  }, [
    complexity,
    noiseScale,
    colors,
    flowIntensity,
    grainAmount,
    grainScale,
    thresholdMin,
    thresholdMax,
    vibrance,
    blendSpace,
    seed,
    invalidate,
  ])

  useFrame((_, delta) => {
    const material = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) return
    if (isPlaying) {
      timeRef.current += delta * speed
    }
    material.uniforms.uTime.value = timeRef.current
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[20, 20]} />
      <shaderMaterial
        vertexShader={organicGradientVertexShader}
        fragmentShader={organicGradientFragmentShader}
        uniforms={uniforms}
        transparent={true}
      />
    </mesh>
  )
}
