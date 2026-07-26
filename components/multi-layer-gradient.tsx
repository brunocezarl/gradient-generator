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

// Composição de N camadas em um único contexto WebGL.
//
// Antes cada camada tinha o próprio <Canvas> e a mesclagem era feita pelo
// `mix-blend-mode` do CSS: um contexto WebGL por camada (recurso escasso e
// caro), zero controle sobre a composição e uma segunda implementação — em
// canvas 2D — só para a exportação. Aqui cada camada é desenhada em um render
// target e as camadas são combinadas no shader, com o mesmo resultado na tela e
// no arquivo.
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

  // Ordem de desenho: de baixo para cima. layers[0] é a camada de cima na UI.
  const visibleLayers = useMemo(
    () => [...layers].reverse().filter((layer) => layer.visible),
    [layers]
  )

  // Uma cena por camada, alimentada por portal — assim cada camada continua
  // sendo o mesmo componente de shader usado no modo de camada única
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
    // O vertex shader da composição escreve gl_Position direto de `position`,
    // então qualquer câmera serve
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

    // Acompanha o tamanho do drawing buffer, inclusive quando a exportação o
    // redimensiona para a resolução final
    for (const target of [targets.layer, targets.accumulation, targets.swap]) {
      if (target.width !== width || target.height !== height) {
        target.setSize(width, height)
      }
    }

    const previousTarget = gl.getRenderTarget()
    const previousClear = gl.getClearColor(new THREE.Color())
    const previousClearAlpha = gl.getClearAlpha()

    // Fundo preto: as camadas mesclam contra ele, exatamente como faziam
    // contra o fundo da página no modo anterior
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

    // Resultado para a tela
    composite.material.uniforms.uBase.value = accumulation.texture
    composite.material.uniforms.uLayer.value = accumulation.texture
    composite.material.uniforms.uOpacity.value = 1
    composite.material.uniforms.uBlendMode.value = 0
    gl.setRenderTarget(null)
    gl.render(composite.scene, composite.camera)

    gl.setRenderTarget(previousTarget)
    gl.setClearColor(previousClear, previousClearAlpha)
  }, [gl, camera, visibleLayers, layerScenes, targets, composite])

  // Prioridade > 0 assume o render loop: o react-three-fiber para de desenhar
  // a cena raiz sozinho e a composição passa a controlar as passagens
  useFrame(renderComposition, 1)

  // Exportação de imagem e vídeo desenham por aqui, para receber a composição
  // completa em vez de uma única passagem
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

  // O movimento e o acabamento são globais: a composição inteira se move junta
  // e recebe o mesmo tratamento de cor. Antes estes valores eram fixos no
  // código, então play/pause, velocidade e complexidade não tinham efeito
  // nenhum no modo multi-camadas.
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
