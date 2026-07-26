"use client"

import { useCallback, useEffect, useMemo } from "react"
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore } from "@/lib/store"
import type { GradientLayer } from "@/lib/layer-utils"
import type { ColorStop } from "@/lib/color-stops"
import { OrganicGradientShader } from "@/components/organic-gradient-shader"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"
import { CaptureHelper } from "@/components/capture-helper"
import { registerFrameRenderer } from "@/lib/capture"
import {
  blendModeToShaderIndex,
  compositeFragmentShader,
  compositeVertexShader,
} from "@/lib/shaders/composite"

function createRenderTarget() {
  return new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  })
}

// Compositing N layers in a single WebGL context.
//
// Each layer used to have its own <Canvas> with blending done by CSS
// `mix-blend-mode`: one WebGL context per layer (a scarce, expensive resource),
// no control over the composition, and a second implementation — in canvas 2D —
// just for exporting. Here each layer is drawn into a render target and the
// layers are combined in the shader, with the same result on screen and in the
// file.
function LayeredComposition({
  layers,
  globals,
  colorSchemes,
}: {
  layers: GradientLayer[]
  globals: {
    complexity: number
    grainAmount: number
    grainScale: number
    vibrance: number
    blendSpace: "oklab" | "linear"
    loopDuration: number
  }
  colorSchemes: Record<string, { stops: ColorStop[] }>
}) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)

  // Draw order: bottom to top. layers[0] is the topmost layer in the UI.
  const visibleLayers = useMemo(
    () => [...layers].reverse().filter((layer) => layer.visible),
    [layers]
  )

  // One scene per layer, fed through a portal — so each layer stays the same
  // shader component the single-layer mode uses
  const layerScenes = useMemo(
    () => visibleLayers.map(() => new THREE.Scene()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleLayers.length]
  )

  const targets = useMemo(
    () => ({
      layer: createRenderTarget(),
      accumulation: createRenderTarget(),
      swap: createRenderTarget(),
    }),
    []
  )

  const composite = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: compositeVertexShader,
      fragmentShader: compositeFragmentShader,
      uniforms: {
        uBase: { value: null },
        uLayer: { value: null },
        uOpacity: { value: 1 },
        uBlendMode: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    mesh.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(mesh)
    // The compositing vertex shader writes gl_Position straight from `position`,
    // so any camera works
    return { scene, material, camera: new THREE.Camera() }
  }, [])

  useEffect(
    () => () => {
      targets.layer.dispose()
      targets.accumulation.dispose()
      targets.swap.dispose()
      composite.material.dispose()
    },
    [targets, composite]
  )

  const renderComposition = useCallback(() => {
    if (layerScenes.length === 0) return

    const size = gl.getDrawingBufferSize(new THREE.Vector2())
    const width = Math.max(1, Math.floor(size.x))
    const height = Math.max(1, Math.floor(size.y))

    // Follows the drawing buffer size, including when the export resizes it to
    // the final resolution
    for (const target of [targets.layer, targets.accumulation, targets.swap]) {
      if (target.width !== width || target.height !== height) {
        target.setSize(width, height)
      }
    }

    const previousTarget = gl.getRenderTarget()
    const previousClear = gl.getClearColor(new THREE.Color())
    const previousClearAlpha = gl.getClearAlpha()

    // Black backdrop: layers blend against it, exactly as they did against the
    // page background in the previous mode
    gl.setClearColor(0x000000, 1)
    gl.setRenderTarget(targets.accumulation)
    gl.clear(true, false, false)

    let accumulation = targets.accumulation
    let swap = targets.swap

    visibleLayers.forEach((layer, index) => {
      gl.setRenderTarget(targets.layer)
      gl.clear(true, false, false)
      gl.render(layerScenes[index], camera)

      composite.material.uniforms.uBase.value = accumulation.texture
      composite.material.uniforms.uLayer.value = targets.layer.texture
      composite.material.uniforms.uOpacity.value = layer.opacity
      composite.material.uniforms.uBlendMode.value = blendModeToShaderIndex(layer.blendMode)

      gl.setRenderTarget(swap)
      gl.render(composite.scene, composite.camera)
      ;[accumulation, swap] = [swap, accumulation]
    })

    // Result to the screen
    composite.material.uniforms.uBase.value = accumulation.texture
    composite.material.uniforms.uLayer.value = accumulation.texture
    composite.material.uniforms.uOpacity.value = 1
    composite.material.uniforms.uBlendMode.value = 0
    gl.setRenderTarget(null)
    gl.render(composite.scene, composite.camera)

    gl.setRenderTarget(previousTarget)
    gl.setClearColor(previousClear, previousClearAlpha)
  }, [gl, camera, visibleLayers, layerScenes, targets, composite])

  // Priority > 0 takes over the render loop: react-three-fiber stops drawing the
  // root scene on its own and the composition controls the passes
  useFrame(renderComposition, 1)

  // Image and video export draw through here, so they get the full composition
  // instead of a single pass
  useEffect(
    () => registerFrameRenderer(gl.domElement, renderComposition),
    [gl, renderComposition]
  )

  const layerStops = (layer: GradientLayer): ColorStop[] => {
    if (layer.isCustomMode && layer.customStops) return layer.customStops
    return (colorSchemes[layer.colorScheme] ?? colorSchemes.redBlue).stops
  }

  return (
    <>
      {visibleLayers.map((layer, index) =>
        createPortal(
          <OrganicGradientShader
            key={layer.id}
            complexity={globals.complexity}
            grainAmount={globals.grainAmount}
            grainScale={globals.grainScale}
            vibrance={globals.vibrance}
            blendSpace={globals.blendSpace}
            loopDuration={globals.loopDuration}
            stops={layerStops(layer)}
            noiseScale={layer.noiseScale}
            flowIntensity={layer.flowIntensity}
            thresholdMin={layer.thresholdMin}
            thresholdMax={layer.thresholdMax}
            seed={layer.seed}
          />,
          layerScenes[index]
        )
      )}
    </>
  )
}

export function MultiLayerGradient() {
  const layers = useGradientStore((state) => state.layers)
  const multiLayerMode = useGradientStore((state) => state.multiLayerMode)
  const colorSchemes = useGradientStore((state) => state.colorSchemes)
  const isPlaying = useGradientStore((state) => state.isPlaying)

  // Motion and finishing are global: the whole composition moves together and
  // gets the same color treatment. These values used to be hardcoded here, so
  // play/pause, speed and complexity had no effect at all in multi-layer mode.
  const globals = useGradientStore(
    useShallow((state) => ({
      complexity: state.complexity,
      grainAmount: state.grainAmount,
      grainScale: state.grainScale,
      vibrance: state.vibrance,
      blendSpace: state.blendSpace,
      loopDuration: state.loopDuration,
    }))
  )

  const { quality, pixelRatio, antialias } = useDeviceOptimizations()

  const glConfig = useMemo(
    () => ({
      preserveDrawingBuffer: true,
      antialias,
      powerPreference: (quality === "high"
        ? "high-performance"
        : "low-power") as WebGLPowerPreference,
      depth: false,
      stencil: false,
    }),
    [quality, antialias]
  )

  if (!multiLayerMode) {
    return null
  }

  return (
    <Canvas
      gl={glConfig}
      camera={{ position: [0, 0, 5] }}
      dpr={[1, pixelRatio]}
      frameloop={isPlaying ? "always" : "demand"}
    >
      <LayeredComposition layers={layers} globals={globals} colorSchemes={colorSchemes} />
      <CaptureHelper />
    </Canvas>
  )
}
