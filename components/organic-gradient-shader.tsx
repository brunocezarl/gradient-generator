"use client"

import { useRef, useMemo, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import {
  MAX_COLOR_STOPS,
  organicGradientFragmentShader,
  organicGradientVertexShader,
} from "@/lib/shaders/organic-gradient"
import { srgbTripletToLinear, type ColorBlendSpace } from "@/lib/color"
import { sortStops, type ColorStop } from "@/lib/color-stops"
import { playback } from "@/lib/playback"
import { registerTimeConsumer } from "@/lib/capture"

export interface OrganicGradientParams {
  complexity: number
  noiseScale: number
  /** Paradas de cor em sRGB, como saem do color picker */
  stops: ColorStop[]
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number
  vibrance: number
  blendSpace: ColorBlendSpace
  seed: [number, number]
  // 0 = animação livre; > 0 = período em que o desenho se repete exatamente
  loopDuration: number
}

interface StopUniforms {
  uStopColors: { value: THREE.Vector3[] }
  uStopPositions: { value: number[] }
  uStopCount: { value: number }
}

function createStopUniforms(): StopUniforms {
  return {
    uStopColors: {
      value: Array.from({ length: MAX_COLOR_STOPS }, () => new THREE.Vector3()),
    },
    uStopPositions: { value: new Array(MAX_COLOR_STOPS).fill(0) },
    uStopCount: { value: 2 },
  }
}

// Escreve as paradas nos uniforms.
//
// A ordenação acontece aqui, não no estado: reordenar a lista no meio de um
// arraste faria o slider pular para outra parada na mão do usuário, enquanto o
// shader precisa das posições crescentes. As posições não usadas repetem a
// última parada, mantendo o array preenchido.
function writeStopUniforms(uniforms: StopUniforms, stops: readonly ColorStop[]) {
  const sorted = sortStops(stops)
  const count = Math.min(Math.max(sorted.length, 2), MAX_COLOR_STOPS)

  for (let index = 0; index < MAX_COLOR_STOPS; index++) {
    const stop = sorted[Math.min(index, sorted.length - 1)]
    if (!stop) continue
    const [r, g, b] = srgbTripletToLinear(stop.color)
    uniforms.uStopColors.value[index].set(r, g, b)
    uniforms.uStopPositions.value[index] = stop.position
  }

  uniforms.uStopCount.value = count
}

// Único componente de shader do app: a cena simples e cada camada do modo
// multi-camadas renderizam por aqui, garantindo que a mesma configuração
// produza a mesma imagem nos dois modos.
export function OrganicGradientShader({
  complexity,
  noiseScale,
  stops,
  flowIntensity,
  grainAmount,
  grainScale,
  thresholdMin,
  thresholdMax,
  vibrance,
  blendSpace,
  seed,
  loopDuration,
}: OrganicGradientParams) {
  const meshRef = useRef<THREE.Mesh>(null)
  const invalidate = useThree((state) => state.invalidate)
  const gl = useThree((state) => state.gl)

  // Valores iniciais apenas — as atualizações acontecem no effect abaixo, sem
  // recriar o material (recriar recompila o shader e pisca a tela)
  const uniforms = useMemo(() => {
    const stopUniforms = createStopUniforms()
    writeStopUniforms(stopUniforms, stops)
    return {
      uTime: { value: 0 },
      uComplexity: { value: complexity },
      uNoiseScale: { value: noiseScale },
      ...stopUniforms,
      uFlowIntensity: { value: flowIntensity },
      uGrainAmount: { value: grainAmount },
      uGrainScale: { value: grainScale },
      uThresholdMin: { value: thresholdMin },
      uThresholdMax: { value: thresholdMax },
      uVibrance: { value: vibrance },
      uOklabMix: { value: blendSpace === "oklab" ? 1 : 0 },
      uSeed: { value: [seed[0], seed[1]] },
      uLoopDuration: { value: loopDuration },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const material = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) return

    material.uniforms.uComplexity.value = complexity
    material.uniforms.uNoiseScale.value = noiseScale
    writeStopUniforms(material.uniforms as unknown as StopUniforms, stops)
    material.uniforms.uFlowIntensity.value = flowIntensity
    material.uniforms.uGrainAmount.value = grainAmount
    material.uniforms.uGrainScale.value = grainScale
    material.uniforms.uThresholdMin.value = thresholdMin
    material.uniforms.uThresholdMax.value = thresholdMax
    material.uniforms.uVibrance.value = vibrance
    material.uniforms.uOklabMix.value = blendSpace === "oklab" ? 1 : 0
    material.uniforms.uSeed.value = [seed[0], seed[1]]
    material.uniforms.uLoopDuration.value = loopDuration

    // Com a animação pausada o canvas roda em frameloop "demand": sem isto a
    // tela ficaria com a imagem antiga ao mexer nos controles
    invalidate()
  }, [
    complexity,
    noiseScale,
    stops,
    flowIntensity,
    grainAmount,
    grainScale,
    thresholdMin,
    thresholdMax,
    vibrance,
    blendSpace,
    seed,
    loopDuration,
    invalidate,
  ])

  // Arrastar a timeline (ou pular para um frame) precisa redesenhar mesmo com a
  // animação pausada
  useEffect(() => playback.subscribe(invalidate), [invalidate])

  // O tempo vem do relógio compartilhado (lib/playback.ts), não de um
  // acumulador local: assim a timeline mostra o instante real e o export pode
  // pedir um instante específico
  useFrame(() => {
    const material = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) return
    material.uniforms.uTime.value = playback.time
  })

  // Permite que a exportação peça um instante exato da animação, em vez de
  // capturar o instante em que o navegador chamou o render loop
  useEffect(
    () =>
      registerTimeConsumer(gl.domElement, (time) => {
        const material = meshRef.current?.material as THREE.ShaderMaterial | undefined
        if (material?.uniforms) material.uniforms.uTime.value = time
      }),
    [gl]
  )

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
