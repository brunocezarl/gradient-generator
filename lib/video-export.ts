"use client"

import { overrideRenderSize, renderFrameAtTime } from "@/lib/capture"

// Deterministic video export.
//
// The previous recording used MediaRecorder over the live canvas: the file ended
// up with whatever frames the GPU managed to deliver whenever the browser called
// rAF. At 4K, or on a busy laptop, that means duplicated frames, the wrong
// duration and no chance of a seamless loop.
//
// Here time is driven by the exporter: for each frame the scene is drawn at an
// exact instant and the frame is handed to the encoder with an explicit
// timestamp. Recording slower than real time does not affect the result — it
// just takes longer.

export type VideoFormat = "mp4" | "webm"

export interface VideoExportPlan {
  /** How many frames to render */
  frameCount: number
  /** Animation seconds per frame */
  animationStep: number
  /** File duration in seconds */
  videoDuration: number
  /** true when the file closes a whole number of loops */
  loopExact: boolean
}

export interface PlanVideoExportOptions {
  requestedDuration: number
  fps: number
  /** Loop duration in animation seconds (0 = free animation) */
  loopDuration: number
  /** Preview speed: keeps the on-screen rhythm in the file */
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
    // A loop lasts `loopDuration` animation seconds; at preview speed that is
    // `loopDuration / speed` seconds of video. The requested duration is rounded
    // to a whole number of loops, otherwise the cut would land mid-cycle and the
    // seam would show.
    const singleLoopVideo = loopDuration / safeSpeed
    const loops = Math.max(1, Math.round(safeDuration / singleLoopVideo))
    const videoDuration = singleLoopVideo * loops
    const frameCount = Math.max(1, Math.round(videoDuration * safeFps))
    return {
      frameCount,
      // The last rendered frame is the one before the cycle closes: the closing
      // frame is identical to the first and would duplicate at the seam
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
  /** Element holding the artboard canvases */
  container: HTMLElement
  /** Canvas to encode (the first one in the artboard) */
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

// Codecs per container. AVC for MP4 (works with editors and social platforms),
// VP9 for WebM.
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

  // Renders at output resolution (and reprojects the camera to the target aspect
  // ratio) for the whole recording
  const restoreSize = overrideRenderSize(canvas, width, height)

  try {
    await output.start()

    for (let frame = 0; frame < plan.frameCount; frame++) {
      if (shouldCancel?.()) {
        await output.cancel()
        throw new DOMException("Recording cancelled", "AbortError")
      }

      const drawn = renderFrameAtTime(container, frame * plan.animationStep)
      if (drawn === 0) {
        throw new Error("No scene registered to render the frames")
      }

      await source.add(frame / fps, 1 / fps)
      onProgress?.((frame + 1) / plan.frameCount)
    }

    source.close()
    await output.finalize()

    const buffer = output.target.buffer
    if (!buffer) throw new Error("Failed to produce the video file")

    return new Blob([buffer], { type: format === "mp4" ? "video/mp4" : "video/webm" })
  } finally {
    restoreSize?.()
  }
}
