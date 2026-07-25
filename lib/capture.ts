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

// Consumidores de tempo: cada material de shader registra como aplicar um
// instante da animação. Fora do render loop, é isto que permite desenhar um
// instante *específico* em vez do instante em que o navegador chamou o rAF.
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

// Renderizador do canvas. Cenas com múltiplas passagens (composição de
// camadas) registram o próprio; uma cena simples usa o fallback gl.render.
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

// Desenha o instante `time` em todos os canvases de um container. Retorna
// quantos canvases responderam — zero significa que nada está registrado e o
// chamador deve cair para o caminho em tempo real.
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

// Ajusta a projeção da câmera para a proporção de saída, retornando uma função
// que restaura a projeção original (ou null quando nada precisou mudar).
//
// Sem isso, exportar numa proporção diferente da tela renderiza o
// enquadramento da tela esticado dentro do buffer alvo: um "story" 1080×1920
// gerado a partir de uma janela 16:9 sai horizontalmente comprimido, porque a
// câmera continua projetando em 16:9. A proporção da câmera é normalmente
// atualizada pelo react-three-fiber no resize do container — e a exportação
// redimensiona o drawing buffer sem passar por lá.
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
    // Preserva a altura visível e recalcula a largura pela nova proporção,
    // mantendo o centro do enquadramento
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

// Redimensiona o drawing buffer do renderer para a resolução alvo sem alterar
// o tamanho CSS do canvas, reprojetando a câmera na proporção alvo. Retorna uma
// função que restaura o estado original, ou null se o canvas não tem renderer
// registrado.
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
  // Passa pelo renderizador do canvas: cenas com composição de camadas têm
  // várias passagens e alvos intermediários que precisam acompanhar o tamanho
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
  // Dimensões fixas de saída (ex.: presets 1920×1080, 1080×1920). Quando
  // presentes, têm precedência sobre `scale` — o gradiente é re-renderizado
  // nesse tamanho exato, independente da proporção da tela
  width?: number
  height?: number
  mimeType: string
  quality: number
}

// Exporta a composição de todos os canvases dentro de `container` como Blob,
// re-renderizando cada camada nativamente na resolução final e aplicando
// opacidade e blend modes (equivalente ao que o CSS faz na tela)
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

  // Fundo preto: replica o backdrop da página para blend modes e evita
  // resultados indefinidos em JPEG (que não tem canal alfa)
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
