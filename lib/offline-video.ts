import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer"
import { Muxer as WebMMuxer, ArrayBufferTarget as WebMTarget } from "webm-muxer"
import {
  getCaptureContext,
  getTimeControl,
  getLayerCompositing,
  overrideRenderSize,
  renderFrame,
  setTimeOverride,
} from "@/lib/capture"

// Renderização de vídeo offline (frame a frame) com WebCodecs:
//
// Em vez de gravar a tela em tempo real (MediaRecorder), que descarta frames
// quando a renderização atrasa e usa um encoder otimizado para streaming,
// cada frame é renderizado exatamente no instante certo da animação — o
// relógio do shader é avançado manualmente em passos de 1/fps — e codificado
// individualmente. O resultado é determinístico: nenhum frame perdido,
// cadência perfeita e qualidade máxima mesmo em 4K/60fps em máquinas lentas.

export type OfflineVideoFormat = "mp4" | "webm"

export interface OfflineVideoOptions {
  container: HTMLElement
  width: number
  height: number
  fps: number
  duration: number // segundos
  format: OfflineVideoFormat
  bitrate: number // bits por segundo
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined"
}

// Codecs em ordem de preferência (níveis mais altos primeiro para suportar
// 4K/60fps; isConfigSupported decide o que o hardware aceita)
export function codecCandidates(format: OfflineVideoFormat): string[] {
  return format === "mp4"
    ? ["avc1.640034", "avc1.640033", "avc1.64002A", "avc1.4D402A"]
    : ["vp09.00.51.08", "vp09.00.41.08", "vp8"]
}

// Encoders de vídeo (yuv420) exigem dimensões pares
export function evenDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  return {
    width: Math.max(2, Math.floor(width / 2) * 2),
    height: Math.max(2, Math.floor(height / 2) * 2),
  }
}

async function pickSupportedCodec(
  format: OfflineVideoFormat,
  width: number,
  height: number,
  fps: number,
  bitrate: number,
): Promise<string | null> {
  for (const codec of codecCandidates(format)) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
      })
      if (supported) return codec
    } catch {
      // Codec desconhecido pelo navegador — tentar o próximo
    }
  }
  return null
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Exportação cancelada", "AbortError")
}

// Cede o event loop para a UI (barra de progresso) pintar entre frames
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function renderOfflineVideo({
  container,
  width: rawWidth,
  height: rawHeight,
  fps,
  duration,
  format,
  bitrate,
  onProgress,
  signal,
}: OfflineVideoOptions): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error("WebCodecs não é suportado neste navegador")
  }

  const canvases = Array.from(container.querySelectorAll("canvas")).filter(
    (canvas) => getCaptureContext(canvas) !== null,
  )
  if (canvases.length === 0) {
    throw new Error("Nenhum canvas com renderer registrado para exportar")
  }

  const { width, height } = evenDimensions(rawWidth, rawHeight)

  const codec = await pickSupportedCodec(format, width, height, fps, bitrate)
  if (!codec) {
    throw new Error(
      `Nenhum codec ${format.toUpperCase()} disponível para ${width}x${height}@${fps}fps`,
    )
  }

  // Muxer + encoder
  const mp4Target = format === "mp4" ? new Mp4Target() : null
  const webmTarget = format === "webm" ? new WebMTarget() : null
  const muxer =
    format === "mp4"
      ? new Mp4Muxer({
          target: mp4Target!,
          video: { codec: "avc", width, height },
          fastStart: "in-memory",
        })
      : new WebMMuxer({
          target: webmTarget!,
          video: {
            codec: codec === "vp8" ? "V_VP8" : "V_VP9",
            width,
            height,
            frameRate: fps,
          },
        })

  let encoderError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
    error: (error) => {
      encoderError = error
    },
  })
  encoder.configure({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
    latencyMode: "quality",
    ...(format === "mp4" ? { avc: { format: "avc" as const } } : {}),
  })

  // Canvas de composição (camadas com opacidade/blend modes)
  const composite = document.createElement("canvas")
  composite.width = width
  composite.height = height
  const ctx = composite.getContext("2d")
  if (!ctx) throw new Error("Could not get 2D context")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  const layerStyles = canvases.map((canvas) => getLayerCompositing(canvas, container))
  const timeControls = canvases.map((canvas) => getTimeControl(canvas))
  const baseTimes = timeControls.map((control) => control?.getTime() ?? 0)
  const speeds = timeControls.map((control) => control?.getSpeed() ?? 1)

  // Assumir o controle do relógio e da resolução de cada camada
  canvases.forEach((canvas) => setTimeOverride(canvas, true))
  const restoreRenderers = canvases
    .map((canvas) => overrideRenderSize(canvas, width, height))
    .filter((restore): restore is () => void => restore !== null)

  // Frame direto do canvas WebGL quando há uma única camada no tamanho exato
  // (evita uma cópia por frame)
  const singleDirect =
    canvases.length === 1 &&
    canvases[0].width === width &&
    canvases[0].height === height &&
    layerStyles[0].opacity === 1 &&
    layerStyles[0].blend === "source-over"

  const totalFrames = Math.max(1, Math.round(duration * fps))
  const frameDuration = 1_000_000 / fps // microssegundos

  try {
    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal)
      if (encoderError) throw encoderError

      // Avançar o relógio de cada camada deterministicamente e renderizar
      canvases.forEach((canvas, index) => {
        timeControls[index]?.apply(baseTimes[index] + (i / fps) * speeds[index])
        renderFrame(canvas)
      })

      let source: HTMLCanvasElement
      if (singleDirect) {
        source = canvases[0]
      } else {
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, width, height)
        canvases.forEach((canvas, index) => {
          ctx.globalAlpha = layerStyles[index].opacity
          ctx.globalCompositeOperation = layerStyles[index].blend
          ctx.drawImage(canvas, 0, 0, width, height)
        })
        source = composite
      }

      const frame = new VideoFrame(source, {
        timestamp: Math.round(i * frameDuration),
        duration: Math.round(frameDuration),
      })
      // Keyframe a cada 2 segundos
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()

      // Backpressure: não deixar a fila do encoder crescer sem limite
      while (encoder.encodeQueueSize > 4) {
        if (encoderError) throw encoderError
        await yieldToBrowser()
      }

      onProgress?.((i + 1) / totalFrames)
      await yieldToBrowser()
    }

    await encoder.flush()
    if (encoderError) throw encoderError
    muxer.finalize()
  } finally {
    if (encoder.state !== "closed") encoder.close()
    canvases.forEach((canvas) => setTimeOverride(canvas, false))
    restoreRenderers.forEach((restore) => restore())
  }

  const buffer = format === "mp4" ? mp4Target!.buffer : webmTarget!.buffer
  return new Blob([buffer], { type: format === "mp4" ? "video/mp4" : "video/webm" })
}
