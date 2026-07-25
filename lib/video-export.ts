"use client"

import { overrideRenderSize, renderFrameAtTime } from "@/lib/capture"

// Exportação de vídeo determinística.
//
// A gravação anterior usava MediaRecorder sobre o canvas em tempo real: o
// arquivo ficava com os frames que a GPU conseguiu entregar no tempo em que o
// navegador chamou o rAF. Em 4K, ou num notebook ocupado, isso significa frames
// repetidos, duração errada e nenhuma chance de loop perfeito.
//
// Aqui o tempo é dirigido pelo exportador: para cada frame, a cena é desenhada
// em um instante exato e o quadro é entregue ao encoder com timestamp
// explícito. A gravação pode ser mais lenta que o tempo real sem afetar o
// resultado — só demora mais.

export type VideoFormat = "mp4" | "webm"

export interface VideoExportPlan {
  /** Quantidade de frames a renderizar */
  frameCount: number
  /** Segundos de animação por frame */
  animationStep: number
  /** Duração do arquivo em segundos */
  videoDuration: number
  /** true quando o arquivo fecha um número inteiro de loops */
  loopExact: boolean
}

export interface PlanVideoExportOptions {
  requestedDuration: number
  fps: number
  /** Duração do loop em segundos de animação (0 = animação livre) */
  loopDuration: number
  /** Velocidade de preview: mantém no arquivo o ritmo que se vê na tela */
  speed: number
}

export function planVideoExport({
  requestedDuration,
  fps,
  loopDuration,
  speed,
}: PlanVideoExportOptions): VideoExportPlan {
  const safeFps = Math.min(Math.max(Math.round(fps) || 30, 1), 120)
  const safeSpeed = Math.min(Math.max(speed || 1, 0.05), 10)
  const safeDuration = Math.min(Math.max(requestedDuration || 1, 1 / safeFps), 600)

  if (loopDuration > 0) {
    // Um loop dura `loopDuration` segundos de animação; na velocidade de
    // preview isso equivale a `loopDuration / speed` segundos de vídeo. A
    // duração pedida é arredondada para um número inteiro de loops, senão o
    // corte cairia no meio do ciclo e o loop apareceria.
    const singleLoopVideo = loopDuration / safeSpeed
    const loops = Math.max(1, Math.round(safeDuration / singleLoopVideo))
    const videoDuration = singleLoopVideo * loops
    const frameCount = Math.max(1, Math.round(videoDuration * safeFps))
    return {
      frameCount,
      // O último frame renderizado é o anterior ao fechamento do ciclo: o
      // frame do fechamento é idêntico ao primeiro e duplicaria na emenda
      animationStep: (loopDuration * loops) / frameCount,
      videoDuration,
      loopExact: true,
    }
  }

  const frameCount = Math.max(1, Math.round(safeDuration * safeFps))
  return {
    frameCount,
    animationStep: safeSpeed / safeFps,
    videoDuration: frameCount / safeFps,
    loopExact: false,
  }
}

export interface ExportVideoOptions {
  /** Elemento que contém os canvases da prancheta */
  container: HTMLElement
  /** Canvas a codificar (o primeiro da prancheta) */
  canvas: HTMLCanvasElement
  width: number
  height: number
  fps: number
  bitrateMbps: number
  format: VideoFormat
  plan: VideoExportPlan
  onProgress?: (progress: number) => void
  shouldCancel?: () => boolean
}

export function isWebCodecsAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.VideoEncoder === "function"
}

// Codecs por container. AVC para MP4 (compatível com edição e redes sociais),
// VP9 para WebM.
const CODEC_BY_FORMAT: Record<VideoFormat, "avc" | "vp9"> = {
  mp4: "avc",
  webm: "vp9",
}

export async function supportedVideoFormats(): Promise<VideoFormat[]> {
  if (!isWebCodecsAvailable()) return []
  const { canEncodeVideo } = await import("mediabunny")
  const formats: VideoFormat[] = []
  for (const format of ["mp4", "webm"] as VideoFormat[]) {
    if (await canEncodeVideo(CODEC_BY_FORMAT[format])) formats.push(format)
  }
  return formats
}

export async function exportVideo({
  container,
  canvas,
  width,
  height,
  fps,
  bitrateMbps,
  format,
  plan,
  onProgress,
  shouldCancel,
}: ExportVideoOptions): Promise<Blob> {
  const { Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, CanvasSource } =
    await import("mediabunny")

  const output = new Output({
    format: format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  })

  const source = new CanvasSource(canvas, {
    codec: CODEC_BY_FORMAT[format],
    bitrate: Math.round(bitrateMbps * 1_000_000),
    keyFrameInterval: 2,
  })

  output.addVideoTrack(source, { frameRate: fps })

  // Renderiza na resolução de saída (e reprojeta a câmera na proporção alvo)
  // durante toda a gravação
  const restoreSize = overrideRenderSize(canvas, width, height)

  try {
    await output.start()

    for (let frame = 0; frame < plan.frameCount; frame++) {
      if (shouldCancel?.()) {
        await output.cancel()
        throw new DOMException("Gravação cancelada", "AbortError")
      }

      const drawn = renderFrameAtTime(container, frame * plan.animationStep)
      if (drawn === 0) {
        throw new Error("Nenhuma cena registrada para renderizar os frames")
      }

      await source.add(frame / fps, 1 / fps)
      onProgress?.((frame + 1) / plan.frameCount)
    }

    source.close()
    await output.finalize()

    const buffer = output.target.buffer
    if (!buffer) throw new Error("Falha ao gerar o arquivo de vídeo")

    return new Blob([buffer], { type: format === "mp4" ? "video/mp4" : "video/webm" })
  } finally {
    restoreSize?.()
  }
}
