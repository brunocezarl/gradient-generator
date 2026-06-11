import * as THREE from "three"

// Registro dos renderers WebGL ativos (um por <Canvas> do react-three-fiber),
// permitindo re-renderizar a cena na resolução de exportação em vez de
// apenas redimensionar os pixels exibidos na tela (que gera borrão).
export interface CaptureContext {
  gl: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
}

const contexts = new Map<HTMLCanvasElement, CaptureContext>()

export function registerCaptureContext(canvas: HTMLCanvasElement, context: CaptureContext) {
  contexts.set(canvas, context)
}

export function unregisterCaptureContext(canvas: HTMLCanvasElement) {
  contexts.delete(canvas)
}

export function getCaptureContext(canvas: HTMLCanvasElement): CaptureContext | null {
  return contexts.get(canvas) ?? null
}

// ─── Controle de tempo da animação ───────────────────────────────────────────

// Cada shader registra como ler/escrever seu relógio de animação (uTime),
// permitindo que a exportação offline avance o tempo de forma determinística
// (frame a frame) em vez de seguir o relógio de parede
export interface TimeControl {
  getTime(): number
  getSpeed(): number
  apply(time: number): void
}

const timeControls = new Map<HTMLCanvasElement, TimeControl>()
const timeOverrides = new Set<HTMLCanvasElement>()

export function registerTimeControl(canvas: HTMLCanvasElement, control: TimeControl) {
  timeControls.set(canvas, control)
}

export function unregisterTimeControl(canvas: HTMLCanvasElement) {
  timeControls.delete(canvas)
  timeOverrides.delete(canvas)
}

export function getTimeControl(canvas: HTMLCanvasElement): TimeControl | null {
  return timeControls.get(canvas) ?? null
}

// Enquanto ativo, o loop de animação do shader não deve avançar nem
// sobrescrever uTime — a exportação offline é dona do relógio
export function setTimeOverride(canvas: HTMLCanvasElement, active: boolean) {
  if (active) timeOverrides.add(canvas)
  else timeOverrides.delete(canvas)
}

export function isTimeOverridden(canvas: HTMLCanvasElement): boolean {
  return timeOverrides.has(canvas)
}

// Renderiza um frame imediatamente (síncrono) no canvas registrado
export function renderFrame(canvas: HTMLCanvasElement): boolean {
  const context = contexts.get(canvas)
  if (!context) return false
  context.gl.render(context.scene, context.camera)
  return true
}

// ─── Helpers puros ────────────────────────────────────────────────────────────

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

// Converte um valor CSS de mix-blend-mode para o globalCompositeOperation
// equivalente do canvas 2D (os nomes coincidem, exceto "normal")
export function cssBlendToComposite(blend: string | undefined): GlobalCompositeOperation {
  if (blend && COMPOSITE_BLEND_MODES.has(blend)) {
    return blend as GlobalCompositeOperation
  }
  return "source-over"
}

// Limita as dimensões ao tamanho máximo suportado pela GPU, preservando a proporção
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

// Bitrate recomendado (Mbps) para vídeo: gradientes com ruído orgânico têm
// alta entropia e precisam de mais bits por pixel que vídeo comum
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

// ─── Composição de camadas ───────────────────────────────────────────────────

// Lê a opacidade e o blend mode efetivos de um canvas subindo até `root`
// (no modo multi-camadas cada canvas fica dentro de um div com opacity e
// mix-blend-mode aplicados via CSS)
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

// Redimensiona o drawing buffer do renderer para a resolução alvo sem alterar
// o tamanho CSS do canvas. Retorna uma função que restaura o estado original,
// ou null se o canvas não tem renderer registrado.
export function overrideRenderSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): (() => void) | null {
  const context = contexts.get(canvas)
  if (!context) return null

  const { gl, scene, camera } = context
  const prevSize = gl.getSize(new THREE.Vector2())
  const prevPixelRatio = gl.getPixelRatio()
  const maxSize = gl.capabilities.maxTextureSize || 8192
  const target = clampToMaxSize(width, height, maxSize)

  gl.setPixelRatio(1)
  gl.setSize(target.width, target.height, false)
  gl.render(scene, camera)

  return () => {
    gl.setPixelRatio(prevPixelRatio)
    gl.setSize(prevSize.x, prevSize.y, false)
    gl.render(scene, camera)
  }
}

// Alvo de exportação: múltiplo do tamanho da tela ou dimensões exatas
export type ImageExportTarget =
  | { kind: "scale"; scale: number }
  | { kind: "dimensions"; width: number; height: number }

export interface ExportImageOptions {
  target: ImageExportTarget
  mimeType: string
  quality: number
  // Fator de supersampling: renderiza em resolução maior e reduz com filtro,
  // suavizando o grão e as bordas das formas orgânicas
  supersample?: number
}

export function resolveTargetDimensions(
  target: ImageExportTarget,
  baseWidth: number,
  baseHeight: number,
): { width: number; height: number } {
  if (target.kind === "dimensions") {
    return {
      width: Math.max(1, Math.round(target.width)),
      height: Math.max(1, Math.round(target.height)),
    }
  }
  return {
    width: Math.max(1, Math.round(baseWidth * target.scale)),
    height: Math.max(1, Math.round(baseHeight * target.scale)),
  }
}

// Exporta a composição de todos os canvases dentro de `container` como Blob,
// re-renderizando cada camada nativamente na resolução final e aplicando
// opacidade e blend modes (equivalente ao que o CSS faz na tela)
export async function exportCompositeImage(
  container: HTMLElement,
  { target, mimeType, quality, supersample = 1 }: ExportImageOptions,
): Promise<Blob> {
  const canvases = Array.from(container.querySelectorAll("canvas"))
  if (canvases.length === 0) {
    throw new Error("No canvas found to export")
  }

  const base = canvases[0]
  const { width, height } = resolveTargetDimensions(target, base.width, base.height)
  const renderWidth = width * supersample
  const renderHeight = height * supersample

  const output = document.createElement("canvas")
  output.width = width
  output.height = height
  const ctx = output.getContext("2d")
  if (!ctx) throw new Error("Could not get 2D context")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // Fundo preto: replica o backdrop da página para blend modes e evita
  // resultados indefinidos em JPEG (que não tem canal alfa)
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, width, height)

  for (const canvas of canvases) {
    const { opacity, blend } = getLayerCompositing(canvas, container)
    const restore = overrideRenderSize(canvas, renderWidth, renderHeight)
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
