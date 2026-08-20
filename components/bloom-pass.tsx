"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore } from "@/lib/store"
import { BloomChain } from "@/lib/post-chain"
import { registerFrameRenderer } from "@/lib/capture"

// Drives the bloom chain over the single-layer scene.
//
// Mounted only while the effect is on. That is the whole reason the "none" path
// stays byte for byte what it always was: with this component unmounted nothing
// in the render path has changed — react-three-fiber draws the root scene
// straight to the screen, as before.
export function BloomPass() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const params = useGradientStore(
    useShallow((state) => ({
      threshold: state.bloomThreshold,
      intensity: state.bloomIntensity,
      radius: state.bloomRadius,
      grainAmount: state.grainAmount,
      grainScale: state.grainScale,
      seed: state.seed,
    }))
  )

  const chain = useMemo(() => new BloomChain(gl), [gl])
  useEffect(() => () => chain.dispose(), [chain])

  const renderWithBloom = useCallback(() => {
    const previousTarget = gl.getRenderTarget()

    // Size the targets first: rendering into a target that `apply` is about to
    // resize would throw the frame away
    chain.prepare(gl)

    // The gradient draws into the chain's own target rather than the screen; the
    // shader knows to hand over linear light because `outputLinear` is on for as
    // long as this component is mounted
    gl.setRenderTarget(chain.sceneRenderTarget)
    gl.clear(true, false, false)
    gl.render(scene, camera)

    chain.apply(gl, camera, params)

    gl.setRenderTarget(previousTarget)
  }, [gl, scene, camera, chain, params])

  // Priority > 0 takes the render loop away from react-three-fiber, the same way
  // the layer compositor does — the passes have to run in order
  useFrame(renderWithBloom, 1)

  // Image and video export re-render at the output resolution through here, so
  // the file gets the halo the preview shows
  useEffect(
    () => registerFrameRenderer(gl.domElement, renderWithBloom),
    [gl, renderWithBloom]
  )

  return null
}
