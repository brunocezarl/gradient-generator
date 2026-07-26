import * as THREE from "three"

// Registry of live WebGL renderers (one per react-three-fiber <Canvas>), so the
// scene can be re-rendered at export resolution instead of just resizing the
// pixels already on screen (which blurs).
export interface CaptureContext {
  gl: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
}

const contexts = new Map<HTMLCanvasElement, CaptureContext>()

// Time consumers: each shader material registers how to apply an instant of the
// animation. Outside the render loop, this is what allows drawing a *specific*
// instant instead of whichever one the browser happened to call rAF on.
export type TimeConsumer = (time: number) => void

const timeConsumers = new Map<HTMLCanvasElement, Set<TimeConsumer>>()

export function registerTimeConsumer(
  canvas: HTMLCanvasElement,
  consumer: TimeConsumer,
): () => void {
  const set = timeConsumers.get(canvas) ?? new Set<TimeConsumer>()
  set.add(consumer)
  timeConsumers.set(canvas, set)
  return () => {
    set.delete(consumer)
    if (set.size === 0) timeConsumers.delete(canvas)
  }
}

// Canvas renderer. Multi-pass scenes (layer compositing) register their own; a
// simple scene falls back to gl.render.
export type FrameRenderer = () => void

const frameRenderers = new Map<HTMLCanvasElement, FrameRenderer>()

export function registerFrameRenderer(
  canvas: HTMLCanvasElement,
  render: FrameRenderer,
): () => void {
  frameRenderers.set(canvas, render)
  return () => {
    if (frameRenderers.get(canvas) === render) frameRenderers.delete(canvas)
  }
}

function renderCanvas(canvas: HTMLCanvasElement): boolean {
  const renderer = frameRenderers.get(canvas)
  if (renderer) {
    renderer()
    return true
  }
  const context = contexts.get(canvas)
  if (context) {
    context.gl.render(context.scene, context.camera)
    return true
  }
  return false
}

// Draws instant `time` on every canvas inside a container. Returns how many
// canvases responded — zero means nothing is registered and the caller should
// fall back to the real-time path.
export function renderFrameAtTime(container: HTMLElement, time: number): number {
  const canvases = Array.from(container.querySelectorAll("canvas"))
  let rendered = 0
  for (const canvas of canvases) {
    timeConsumers.get(canvas)?.forEach((consumer) => consumer(time))
    if (renderCanvas(canvas)) rendered++
  }
  return rendered
}

export function registerCaptureContext(canvas: HTMLCanvasElement, context: CaptureContext) {
  contexts.set(canvas, context)
}

export function unregisterCaptureContext(canvas: HTMLCanvasElement) {
  contexts.delete(canvas)
}

export function getCaptureContext(canvas: HTMLCanvasElement): CaptureContext | null {
  return contexts.get(canvas) ?? null
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const COMPOSITE_BLEND_MODES: ReadonlySet<string> = new Set([
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
])

// Converts a CSS mix-blend-mode value to the equivalent canvas 2D
// globalCompositeOperation (names match, except "normal")
export function cssBlendToComposite(blend: string | undefined): GlobalCompositeOperation {
  if (blend && COMPOSITE_BLEND_MODES.has(blend)) {
    return blend as GlobalCompositeOperation
  }
  return "source-over"
}

// Clamps dimensions to the GPU maximum, preserving aspect ratio
export function clampToMaxSize(
  width: number,
  height: number,
  maxSize: number,
): { width: number; height: number } {
  const largest = Math.max(width, height)
  if (largest <= maxSize) return { width, height }
  const factor = maxSize / largest
  return {
    width: Math.max(1, Math.floor(width * factor)),
    height: Math.max(1, Math.floor(height * factor)),
  }
}

// Recommended video bitrate (Mbps): organic-noise gradients are high entropy and
// need more bits per pixel than ordinary footage
export function recommendBitrateMbps(
  width: number,
  height: number,
  fps: number,
  quality: string,
): number {
  const bitsPerPixel = quality === "high" ? 0.25 : quality === "medium" ? 0.15 : 0.08
  const mbps = (width * height * fps * bitsPerPixel) / 1_000_000
  return Math.min(50, Math.max(2, Math.round(mbps)))
}

// ─── Layer compositing ───────────────────────────────────────────────────────

// Reads the effective opacity and blend mode of a canvas by walking up to `root`
// (kept for canvases whose compositing comes from CSS rather than the shader)
export function getLayerCompositing(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
): { opacity: number; blend: GlobalCompositeOperation } {
  let opacity = 1
  let blend: GlobalCompositeOperation = "source-over"
  let el: HTMLElement | null = canvas

  while (el && el !== root) {
    const style = window.getComputedStyle(el)
    const elOpacity = Number.parseFloat(style.opacity)
    if (!Number.isNaN(elOpacity)) opacity *= elOpacity
    if (blend === "source-over" && style.mixBlendMode && style.mixBlendMode !== "normal") {
      blend = cssBlendToComposite(style.mixBlendMode)
    }
    el = el.parentElement
  }

  return { opacity, blend }
}

// Adjusts the camera projection to the output aspect ratio, returning a function
// that restores the original projection (or null when nothing had to change).
//
// Without this, exporting at an aspect ratio different from the screen renders
// the on-screen framing stretched into the target buffer: a 1080×1920 story
// generated from a 16:9 window comes out horizontally squeezed, because the
// camera keeps projecting at 16:9. Camera aspect is normally updated by
// react-three-fiber on container resize — and exporting resizes the drawing
// buffer without going through it.
export function overrideCameraAspect(
  camera: THREE.Camera,
  aspect: number,
): (() => void) | null {
  const perspective = camera as THREE.PerspectiveCamera
  if (perspective.isPerspectiveCamera) {
    const prevAspect = perspective.aspect
    if (prevAspect === aspect) return null
    perspective.aspect = aspect
    perspective.updateProjectionMatrix()
    return () => {
      perspective.aspect = prevAspect
      perspective.updateProjectionMatrix()
    }
  }

  const orthographic = camera as THREE.OrthographicCamera
  if (orthographic.isOrthographicCamera) {
    const { left, right, top, bottom } = orthographic
    // Keeps the visible height and recomputes width from the new aspect ratio,
    // holding the framing centered
    const halfHeight = (top - bottom) / 2
    const centerX = (left + right) / 2
    const halfWidth = halfHeight * aspect
    if (left === centerX - halfWidth && right === centerX + halfWidth) return null
    orthographic.left = centerX - halfWidth
    orthographic.right = centerX + halfWidth
    orthographic.updateProjectionMatrix()
    return () => {
      orthographic.left = left
      orthographic.right = right
      orthographic.updateProjectionMatrix()
    }
  }

  return null
}

// Resizes the renderer's drawing buffer to the target resolution without
// touching the canvas CSS size, reprojecting the camera to the target aspect
// ratio. Returns a function that restores the original state, or null if the
// canvas has no registered renderer.
export function overrideRenderSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): (() => void) | null {
  const context = contexts.get(canvas)
  if (!context) return null

  const { gl, camera } = context
  const prevSize = gl.getSize(new THREE.Vector2())
  const prevPixelRatio = gl.getPixelRatio()
  const maxSize = gl.capabilities.maxTextureSize || 8192
  const target = clampToMaxSize(width, height, maxSize)

  const restoreCamera = overrideCameraAspect(camera, target.width / target.height)

  gl.setPixelRatio(1)
  gl.setSize(target.width, target.height, false)
  // Goes through the canvas renderer: layer-compositing scenes have several
  // passes and intermediate targets that must follow the size
  renderCanvas(canvas)

  return () => {
    restoreCamera?.()
    gl.setPixelRatio(prevPixelRatio)
    gl.setSize(prevSize.x, prevSize.y, false)
    renderCanvas(canvas)
  }
}

export interface ExportImageOptions {
  scale?: number
  // Fixed output dimensions (e.g. the 1920×1080 or 1080×1920 presets). When
  // present they take precedence over `scale` — the gradient is re-rendered at
  // exactly that size, regardless of the screen's aspect ratio
  width?: number
  height?: number
  mimeType: string
  quality: number
}

// Exports the composition of every canvas inside `container` as a Blob,
// re-rendering each layer natively at the final resolution and applying opacity
// and blend modes
export async function exportCompositeImage(
  container: HTMLElement,
  options: ExportImageOptions,
): Promise<Blob> {
  const { mimeType, quality } = options
  const canvases = Array.from(container.querySelectorAll("canvas"))
  if (canvases.length === 0) {
    throw new Error("No canvas found to export")
  }

  const base = canvases[0]
  const scale = options.scale ?? 1
  const width = Math.max(1, Math.round(options.width ?? base.width * scale))
  const height = Math.max(1, Math.round(options.height ?? base.height * scale))

  const output = document.createElement("canvas")
  output.width = width
  output.height = height
  const ctx = output.getContext("2d")
  if (!ctx) throw new Error("Could not get 2D context")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // Black background: matches the page backdrop for blend modes and avoids
  // undefined results in JPEG (which has no alpha channel)
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, width, height)

  for (const canvas of canvases) {
    const { opacity, blend } = getLayerCompositing(canvas, container)
    const restore = overrideRenderSize(canvas, width, height)
    try {
      ctx.globalAlpha = opacity
      ctx.globalCompositeOperation = blend
      ctx.drawImage(canvas, 0, 0, width, height)
    } finally {
      restore?.()
    }
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"

  const blob = await new Promise<Blob | null>((resolve) =>
    output.toBlob(resolve, mimeType, quality),
  )
  if (!blob) throw new Error("Failed to encode image")
  return blob
}
