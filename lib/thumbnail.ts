"use client"

import * as THREE from "three"
import {
  MAX_COLOR_STOPS,
  organicGradientFragmentShader,
  organicGradientVertexShader,
} from "@/lib/shaders/organic-gradient"
import { srgbTripletToLinear } from "@/lib/color"
import { sortStops, type ColorStop } from "@/lib/color-stops"

// Thumbnails rendered by the shader itself.
//
// Thumbnails used to be CSS `linear-gradient`: they showed the colors but not
// the gradient. Two configurations with the same colors and completely different
// shapes looked identical in the gallery, which makes the gallery useless as a
// way to choose.
//
// A small shared WebGL renderer draws each thumbnail for real — same GLSL, same
// framing, a fraction of the cost.

export interface ThumbnailParams {
  stops: ColorStop[]
  complexity: number
  noiseScale: number
  flowIntensity: number
  grainAmount: number
  grainScale: number
  thresholdMin: number
  thresholdMax: number
  vibrance: number
  // Optional: presets written before the tone controls existed carry no value,
  // and an undefined uniform would render the thumbnail black
  exposure?: number
  brightness?: number
  contrast?: number
  blendSpace: "oklab" | "linear"
  seed: [number, number]
  loopDuration: number
  time?: number
}

interface ThumbnailRenderer {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  material: THREE.ShaderMaterial
}

let shared: ThumbnailRenderer | null = null
let unavailable = false

function getRenderer(width: number, height: number): ThumbnailRenderer | null {
  if (unavailable) return null

  if (!shared) {
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        preserveDrawingBuffer: true,
        alpha: false,
        powerPreference: "low-power",
      })
      renderer.setPixelRatio(1)

      const material = new THREE.ShaderMaterial({
        vertexShader: organicGradientVertexShader,
        fragmentShader: organicGradientFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uComplexity: { value: 3 },
          uNoiseScale: { value: 2 },
          uStopColors: {
            value: Array.from({ length: MAX_COLOR_STOPS }, () => new THREE.Vector3()),
          },
          uStopPositions: { value: new Array(MAX_COLOR_STOPS).fill(0) },
          uStopCount: { value: 2 },
          uFlowIntensity: { value: 0.3 },
          uGrainAmount: { value: 0 },
          uGrainScale: { value: 500 },
          uThresholdMin: { value: 0.3 },
          uThresholdMax: { value: 0.7 },
          uVibrance: { value: 0 },
          uOklabMix: { value: 1 },
          uSeed: { value: [0, 0] },
          uLoopDuration: { value: 0 },
        },
      })

      const scene = new THREE.Scene()
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(20, 20), material))

      // Same framing as the main scene, so the thumbnail shows what the artboard
      // would show
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100)
      camera.position.set(0, 0, 5)

      shared = { renderer, scene, camera, material }
    } catch {
      // No WebGL context available (tab with too many canvases, blocked GPU):
      // the caller falls back to the CSS preview
      unavailable = true
      return null
    }
  }

  shared.renderer.setSize(width, height, false)
  shared.camera.aspect = width / height
  shared.camera.updateProjectionMatrix()
  return shared
}

/** Releases the shared renderer (used when the gallery unmounts) */
export function disposeThumbnailRenderer() {
  if (!shared) return
  shared.material.dispose()
  shared.renderer.dispose()
  shared = null
}

export function renderThumbnail(
  params: ThumbnailParams,
  width = 192,
  height = 120
): string | null {
  const context = getRenderer(width, height)
  if (!context) return null

  const { renderer, scene, camera, material } = context
  const uniforms = material.uniforms

  const stops = sortStops(params.stops)
  for (let index = 0; index < MAX_COLOR_STOPS; index++) {
    const stop = stops[Math.min(index, stops.length - 1)]
    if (!stop) continue
    const [r, g, b] = srgbTripletToLinear(stop.color)
    ;(uniforms.uStopColors.value[index] as THREE.Vector3).set(r, g, b)
    uniforms.uStopPositions.value[index] = stop.position
  }
  uniforms.uStopCount.value = Math.min(Math.max(stops.length, 2), MAX_COLOR_STOPS)

  uniforms.uTime.value = params.time ?? 0
  uniforms.uComplexity.value = params.complexity
  uniforms.uNoiseScale.value = params.noiseScale
  uniforms.uFlowIntensity.value = params.flowIntensity
  uniforms.uGrainAmount.value = params.grainAmount
  uniforms.uGrainScale.value = params.grainScale
  uniforms.uThresholdMin.value = params.thresholdMin
  uniforms.uThresholdMax.value = params.thresholdMax
  uniforms.uVibrance.value = params.vibrance
  uniforms.uExposure.value = params.exposure ?? 0
  uniforms.uBrightness.value = params.brightness ?? 0
  uniforms.uContrast.value = params.contrast ?? 1
  uniforms.uOklabMix.value = params.blendSpace === "oklab" ? 1 : 0
  uniforms.uSeed.value = [params.seed[0], params.seed[1]]
  uniforms.uLoopDuration.value = params.loopDuration

  try {
    renderer.render(scene, camera)
    return renderer.domElement.toDataURL("image/png")
  } catch {
    return null
  }
}
