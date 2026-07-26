"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VideoIcon, Info, Repeat } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore } from "@/lib/store"
import { getArtboard, isFreeArtboard } from "@/lib/artboards"
import { clampToMaxSize, recommendBitrateMbps } from "@/lib/capture"
import {
  exportVideo,
  isWebCodecsAvailable,
  planVideoExport,
  supportedVideoFormats,
  type VideoFormat,
} from "@/lib/video-export"

interface VideoExportProps {
  containerRef: React.RefObject<HTMLDivElement | null>
}

const RESOLUTIONS = [
  { value: "artboard", label: "Artboard" },
  { value: "720", label: "720p" },
  { value: "1080", label: "1080p" },
  { value: "1440", label: "1440p" },
  { value: "2160", label: "2160p (4K)" },
]

export function VideoExport({ containerRef }: VideoExportProps) {
  const [open, setOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(6)
  const [fps, setFps] = useState(30)
  const [resolution, setResolution] = useState("artboard")
  const [format, setFormat] = useState<VideoFormat>("mp4")
  const [availableFormats, setAvailableFormats] = useState<VideoFormat[] | null>(null)
  const [filename, setFilename] = useState("gradient-animation")
  const cancelRef = useRef(false)
  const { toast } = useToast()

  const { loopDuration, speed, artboardId } = useGradientStore(
    useShallow((state) => ({
      loopDuration: state.loopDuration,
      speed: state.speed,
      artboardId: state.artboardId,
    }))
  )

  // Which containers this browser can encode — discovered at runtime
  useEffect(() => {
    let active = true
    supportedVideoFormats().then((formats) => {
      if (!active) return
      setAvailableFormats(formats)
      setFormat((current) =>
        formats.length > 0 && !formats.includes(current) ? formats[0] : current
      )
    })
    return () => {
      active = false
    }
  }, [])

  const plan = useMemo(
    () => planVideoExport({ requestedDuration: duration, fps, loopDuration, speed }),
    [duration, fps, loopDuration, speed]
  )

  const size = useMemo(() => {
    const canvas = containerRef.current?.querySelector("canvas")
    const artboard = getArtboard(artboardId)
    const free = isFreeArtboard(artboard)

    if (resolution === "artboard") {
      const raw = free
        ? { width: canvas?.width ?? 1920, height: canvas?.height ?? 1080 }
        : { width: artboard.width, height: artboard.height }
      return clampToMaxSize(raw.width, raw.height, 4096)
    }

    const targetHeight = Number(resolution)
    const aspect = free
      ? (canvas?.width ?? 16) / (canvas?.height ?? 9)
      : artboard.width / artboard.height
    // Even width: required by several encoders
    const width = Math.round((targetHeight * aspect) / 2) * 2
    return clampToMaxSize(width, targetHeight, 4096)
    // `open` is a dependency so the canvas gets re-measured when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, artboardId, containerRef, open])

  const bitrate = recommendBitrateMbps(size.width, size.height, fps, "high")
  const unsupported = availableFormats !== null && availableFormats.length === 0
  const loopCycles =
    loopDuration > 0
      ? Math.round(plan.videoDuration / (loopDuration / Math.max(speed, 0.05)))
      : 0

  const handleExport = async () => {
    const container = containerRef.current
    const canvas = container?.querySelector("canvas")
    if (!container || !canvas) {
      toast({
        title: "Error",
        description: "Could not find a canvas to record.",
        variant: "destructive",
      })
      return
    }

    cancelRef.current = false
    setIsRecording(true)
    setProgress(0)

    try {
      const blob = await exportVideo({
        container,
        canvas,
        width: size.width,
        height: size.height,
        fps,
        bitrateMbps: bitrate,
        format,
        plan,
        onProgress: setProgress,
        shouldCancel: () => cancelRef.current,
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename || "gradient-animation"}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setOpen(false)
      toast({
        title: "Video exported",
        description: `${plan.frameCount} frames at ${fps} fps · ${plan.videoDuration.toFixed(
          1
        )}s${plan.loopExact ? " · closed loop" : ""}`,
      })
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        toast({ title: "Recording cancelled" })
      } else {
        console.error("Video export error:", error)
        toast({
          title: "Recording failed",
          description:
            error instanceof Error ? error.message : "Something went wrong while recording.",
          variant: "destructive",
        })
      }
    } finally {
      setIsRecording(false)
      setProgress(0)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-label="Export Video"
        size="sm"
        disabled={unsupported}
        className="w-full sm:w-auto h-8 bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800"
      >
        <VideoIcon className="mr-2 h-4 w-4" />
        Video
      </Button>

      <Dialog open={open} onOpenChange={(next) => !isRecording && setOpen(next)}>
        <DialogContent className="bg-neutral-900 text-white border-neutral-700">
          <DialogHeader>
            <DialogTitle>Export Video</DialogTitle>
          </DialogHeader>

          <DialogBody>
            {unsupported ? (
              <p className="text-sm text-neutral-300">
  This browser does not expose the WebCodecs API, which is required to record with
                an exact frame rate and duration. Update the browser, or export images instead.
              </p>
            ) : isRecording ? (
              <div className="py-2 space-y-4">
                <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-[width] duration-150"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-neutral-300 text-center">
                  Rendering frame {Math.round(progress * plan.frameCount)} of{" "}
                  {plan.frameCount}
                </p>
                <p className="text-xs text-neutral-500 text-center">
  Each frame is drawn at an exact instant of the animation: recording can take
                  longer than the video lasts, without dropping a single frame.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="video-filename" className="text-white">
                    File name
                  </Label>
                  <Input
                    id="video-filename"
                    value={filename}
                    onChange={(event) => setFilename(event.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="video-resolution" className="text-white">
                      Resolution
                    </Label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger
                        id="video-resolution"
                        className="bg-neutral-800 border-neutral-700 text-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                        {RESOLUTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video-format" className="text-white">
                      Format
                    </Label>
                    <Select
                      value={format}
                      onValueChange={(value) => setFormat(value as VideoFormat)}
                    >
                      <SelectTrigger
                        id="video-format"
                        className="bg-neutral-800 border-neutral-700 text-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                        {(availableFormats ?? (["mp4", "webm"] as VideoFormat[])).map(
                          (value) => (
                            <SelectItem key={value} value={value}>
                              {value === "mp4" ? "MP4 (H.264)" : "WebM (VP9)"}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Duration: {duration}s</Label>
                  <Slider
                    value={[duration]}
                    min={1}
                    max={30}
                    step={1}
                    onValueChange={(value) => setDuration(value[0])}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Frame rate: {fps} fps</Label>
                  <Slider
                    value={[fps]}
                    min={12}
                    max={60}
                    step={6}
                    onValueChange={(value) => setFps(value[0])}
                  />
                </div>

                <div className="rounded-md bg-neutral-800/60 p-3 space-y-1.5 text-xs text-neutral-300">
                  <p className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {size.width}×{size.height} · {plan.frameCount} frames ·{" "}
                    {plan.videoDuration.toFixed(1)}s · ~{bitrate} Mbps
                  </p>
                  {plan.loopExact ? (
                    <p className="flex items-center gap-1.5 text-green-400">
                      <Repeat className="h-3.5 w-3.5 shrink-0" />
  Closed loop: {loopCycles} complete cycle(s), the seam does not show.
                    </p>
                  ) : (
                    <p className="text-neutral-400">
  With no loop set the animation drifts without repeating, so the seam in the
                      video shows. Set a loop on the timeline for a file that runs continuously.
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            {isRecording ? (
              <Button
                variant="outline"
                className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
                onClick={() => {
                  cancelRef.current = true
                }}
              >
                Cancel recording
              </Button>
            ) : (
              <>
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
                  >
                    Close
                  </Button>
                </DialogClose>
                <Button
                  onClick={handleExport}
                  disabled={unsupported || !isWebCodecsAvailable()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <VideoIcon className="mr-2 h-4 w-4" />
                  Record
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
