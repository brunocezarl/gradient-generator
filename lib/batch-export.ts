import { exportCompositeImage, renderFrameAtTime } from "@/lib/capture"
import { playback } from "@/lib/playback"
import { useGradientStore } from "@/lib/store"
import { createZip } from "@/lib/zip"

export const batchSizes = [
  { id: "square", label: "Square post", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait post", width: 1080, height: 1350 },
  { id: "story", label: "Story / Reels", width: 1080, height: 1920 },
  { id: "cover", label: "Cover / Open Graph", width: 1200, height: 630 },
  { id: "wallpaper", label: "Wallpaper", width: 2560, height: 1440 },
] as const

export function exportName(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "gradient"
}

export interface BatchExportOptions {
  name: string
  sizes: string[]
  format: "png" | "jpeg" | "webp"
  quality: number
  signal: AbortSignal
  onProgress: (completed: number, total: number, label: string) => void
}

export async function exportImageBatch(container: HTMLElement, options: BatchExportOptions): Promise<Blob> {
  const sizes = batchSizes.filter((size) => options.sizes.includes(size.id))
  if (!sizes.length) throw new Error("Select at least one size")
  const checkCancelled = () => {
    if (options.signal.aborted) throw new DOMException("Export cancelled", "AbortError")
  }
  checkCancelled()
  const wasPlaying = useGradientStore.getState().isPlaying
  const time = playback.time
  useGradientStore.getState().setIsPlaying(false)
  const files: { name: string; blob: Blob }[] = []
  try {
    // Let React stop the animation driver before the first render.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    for (const size of sizes) {
      checkCancelled()
      options.onProgress(files.length, sizes.length, size.label)
      if (!renderFrameAtTime(container, time)) throw new Error("The preview is not ready. Try again.")
      const blob = await exportCompositeImage(container, {
        width: size.width, height: size.height,
        mimeType: `image/${options.format}`, quality: options.quality,
      })
      checkCancelled()
      if (blob.type !== `image/${options.format}`) throw new Error("This image format is not supported by your browser")
      files.push({ name: `${exportName(options.name)}-${size.id}-${size.width}x${size.height}.${options.format}`, blob })
    }
    options.onProgress(files.length, sizes.length, "Preparing ZIP")
    const zip = await createZip(files)
    checkCancelled()
    return zip
  } finally {
    try {
      playback.set(time)
      renderFrameAtTime(container, time)
    } finally {
      useGradientStore.getState().setIsPlaying(wasPlaying)
    }
  }
}
