"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { batchSizes, exportImageBatch, exportName } from "@/lib/batch-export"
import { Download, Loader2 } from "lucide-react"

export function BatchExport({ containerRef, onBusyChange }: {
  containerRef: React.RefObject<HTMLDivElement | null>
  onBusyChange: (busy: boolean) => void
}) {
  const [name, setName] = useState("gradient")
  const [selected, setSelected] = useState<string[]>(["square", "story", "cover"])
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("png")
  const [quality, setQuality] = useState("0.9")
  const [progress, setProgress] = useState<{ completed: number; total: number; label: string } | null>(null)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; controller.current?.abort() }
  }, [])
  const busy = progress !== null
  const download = async () => {
    if (controller.current || !selected.length) return
    const container = containerRef.current
    if (!container) { setError("The preview is not ready. Close this dialog and try again."); return }
    const abort = new AbortController()
    controller.current = abort
    setError("")
    setDone(false)
    onBusyChange(true)
    setProgress({ completed: 0, total: selected.length, label: "Preparing images" })
    try {
      const blob = await exportImageBatch(container, { name, sizes: selected, format,
        quality: Number(quality), signal: abort.signal,
        onProgress: (completed, total, label) => {
          if (mounted.current) setProgress({ completed, total, label })
        },
      })
      if (abort.signal.aborted || !mounted.current) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${exportName(name)}-image-kit.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setDone(true)
    } catch (error) {
      if (mounted.current) setError(error instanceof DOMException && error.name === "AbortError"
        ? "Export cancelled. Your composition is unchanged."
        : error instanceof Error ? error.message : "Could not export. Try fewer sizes.")
    } finally {
      controller.current = null
      if (mounted.current) { setProgress(null); onBusyChange(false) }
    }
  }
  return <section className="flex flex-col flex-1 min-h-0 gap-3" aria-label="Image kit">
    <div className="min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1">
    <p className="text-sm text-neutral-300">One composition, ready for every destination. Download all selected sizes in a single ZIP.</p>
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <div className="space-y-2">
        <Label htmlFor="kit-name">File name</Label>
        <Input id="kit-name" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setDone(false) }} className="bg-neutral-800 border-neutral-700" />
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium mb-2">Destinations</legend>
        {batchSizes.map((size) => <label key={size.id} className="flex min-h-12 items-center gap-3 rounded-md px-2 hover:bg-neutral-800 cursor-pointer">
          <input type="checkbox" checked={selected.includes(size.id)} className="h-4 w-4 accent-blue-500"
            onChange={(e) => { setDone(false); setSelected((current) => e.target.checked ? [...current, size.id] : current.filter((id) => id !== size.id)) }} />
          <span className="flex-1 text-sm">{size.label}</span>
          <span className="text-xs tabular-nums text-neutral-400">{size.width} × {size.height}</span>
        </label>)}
      </fieldset>
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="kit-format">Format</Label>
          <select id="kit-format" value={format} onChange={(e) => { setFormat(e.target.value as typeof format); setDone(false) }} className="w-full h-11 rounded-md bg-neutral-800 border border-neutral-700 px-3 text-sm">
            <option value="png">PNG · lossless</option><option value="jpeg">JPEG</option><option value="webp">WebP</option>
          </select>
        </div>
        {format !== "png" && <div className="flex-1 space-y-2">
          <Label htmlFor="kit-quality">Quality</Label>
          <select id="kit-quality" value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full h-11 rounded-md bg-neutral-800 border border-neutral-700 px-3 text-sm">
            <option value="0.8">80%</option><option value="0.9">90%</option><option value="1">100%</option>
          </select>
        </div>}
      </div>
    </fieldset>
    <p className="text-xs text-neutral-400">Each size reframes the same animation frame to its own aspect ratio. Your editor dimensions stay unchanged.</p>
    <p className="text-xs text-neutral-400 break-all">{exportName(name)}-image-kit.zip · {selected.length} image{selected.length === 1 ? "" : "s"}</p>
    </div>
    <div role="status" aria-live="polite" className="text-sm shrink-0">
      {progress && <><p>{progress.label} · {progress.completed}/{progress.total}</p><progress className="w-full mt-2 accent-blue-500" value={progress.completed} max={progress.total} aria-label="Images rendered" /></>}
      {error && <p className="text-amber-300">{error}</p>}
      {done && <p className="text-green-400">Your image kit is ready. Download started.</p>}
    </div>
    {busy ? <Button className="w-full shrink-0" variant="outline" onClick={() => controller.current?.abort()}><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancel export</Button>
      : <Button className="w-full shrink-0 bg-blue-600 hover:bg-blue-700 text-white min-h-11" disabled={!selected.length} onClick={download}><Download className="mr-2 h-4 w-4" />Download {selected.length || ""} images as ZIP</Button>}
  </section>
}
