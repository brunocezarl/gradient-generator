"use client"

import { useRef, useMemo, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import {
  createGradientUniforms,
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
  /** Color stops in sRGB, as they come out of the color picker */
  stops: ColorStop[]
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number
  vibrance: number
  /** Stops of light, applied as a linear multiply */
  exposure: number
  /** Offset on Oklab lightness */
  brightness: number
  /** Gain on Oklab lightness around the mid point */
  contrast: number
  blendSpace: ColorBlendSpace
  seed: [number, number]
  // 0 = free animation; > 0 = period over which the drawing repeats exactly
  loopDuration: number
  /**
   * Write unclamped linear light instead of a finished sRGB image. Set while a
   * post-processing chain is running: it needs energy to sum, and the encode,
   * grain and dither move to the end of that chain.
   */
  outputLinear?: boolean
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

// Writes the stops into the uniforms.
//
// Sorting happens here, not in state: re-sorting the list mid-drag would make the
// slider jump to another stop under the user's cursor, while the shader needs
// ascending positions. Unused slots repeat the last stop, keeping the array
// filled.
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

// The app's only shader component: the simple scene and every layer of the
// multi-layer mode render through here, so the same configuration produces the
// same image in both modes.
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
  exposure,
  brightness,
  contrast,
  blendSpace,
  seed,
  loopDuration,
  outputLinear = false,
}: OrganicGradientParams) {
  const meshRef = useRef<THREE.Mesh>(null)
  const invalidate = useThree((state) => state.invalidate)
  const gl = useThree((state) => state.gl)

  // Initial values only — updates happen in the effect below, without recreating
  // the material (recreating recompiles the shader and flashes the screen)
  const uniforms = useMemo(() => {
    const stopUniforms = createStopUniforms()
    writeStopUniforms(stopUniforms, stops)
    return {
      ...createGradientUniforms(),
      ...stopUniforms,
      uComplexity: { value: complexity },
      uNoiseScale: { value: noiseScale },
      uFlowIntensity: { value: flowIntensity },
      uGrainAmount: { value: grainAmount },
      uGrainScale: { value: grainScale },
      uThresholdMin: { value: thresholdMin },
      uThresholdMax: { value: thresholdMax },
      uVibrance: { value: vibrance },
      uExposure: { value: exposure },
      uBrightness: { value: brightness },
      uContrast: { value: contrast },
      uOklabMix: { value: blendSpace === "oklab" ? 1 : 0 },
      uSeed: { value: [seed[0], seed[1]] },
      uLoopDuration: { value: loopDuration },
      uOutputLinear: { value: outputLinear ? 1 : 0 },
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
    material.uniforms.uExposure.value = exposure
    material.uniforms.uBrightness.value = brightness
    material.uniforms.uContrast.value = contrast
    material.uniforms.uOklabMix.value = blendSpace === "oklab" ? 1 : 0
    material.uniforms.uSeed.value = [seed[0], seed[1]]
    material.uniforms.uLoopDuration.value = loopDuration
    material.uniforms.uOutputLinear.value = outputLinear ? 1 : 0

    // With the animation paused the canvas runs on the "demand" frameloop:
    // without this the screen would keep the old image while controls change
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
    exposure,
    brightness,
    contrast,
    blendSpace,
    seed,
    loopDuration,
    outputLinear,
    invalidate,
  ])

  // Dragging the timeline (or jumping to a frame) has to redraw even while the
  // animation is paused
  useEffect(() => playback.subscribe(invalidate), [invalidate])

  // Time comes from the shared clock (lib/playback.ts), not from a local
  // accumulator: that way the timeline shows the real instant and the exporter
  // can ask for a specific one
  useFrame(() => {
    const material = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!material?.uniforms) return
    material.uniforms.uTime.value = playback.time
  })

  // Lets the exporter ask for an exact instant of the animation instead of
  // capturing whichever one the browser called the render loop on
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
