"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Save, Trash2, Dices, Download, Upload } from "lucide-react"
import {
  useGradientStore,
  resolveActiveStops,
  StateSnapshot,
  GradientStore,
} from "@/lib/store"
import { curatedPresets } from "@/lib/curated-presets"
import { stopsToCss } from "@/lib/color-stops"
import { disposeThumbnailRenderer, renderThumbnail } from "@/lib/thumbnail"
import { useToast } from "@/components/ui/use-toast"

// CSS gradient of a snapshot's stops, in the same interpolation space as the
// render. Used as an instant preview while the shader-rendered thumbnail is not
// ready yet.
export function snapshotToGradientCSS(
  snapshot: StateSnapshot,
  colorSchemes: GradientStore["colorSchemes"],
): string {
  const stops = resolveActiveStops({
    isCustomMode: snapshot.isCustomMode,
    customStops: snapshot.customStops,
    colorScheme: snapshot.colorScheme,
    colorSchemes,
  })
  return stopsToCss(stops, snapshot.blendSpace)
}

/**
 * Shader-rendered thumbnails, with CSS as the immediate preview.
 *
 * Each preset renders once and is cached: the gallery is a list of static images,
 * not N live canvases.
 */
function useSnapshotThumbnails(
  presets: readonly { id: string; snapshot: StateSnapshot }[],
  colorSchemes: GradientStore["colorSchemes"]
) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const cache = useRef<Map<string, string>>(new Map())

  const signature = presets.map((preset) => preset.id).join("|")

  useEffect(() => {
    let cancelled = false
    const pending = presets.filter((preset) => !cache.current.has(preset.id))
    if (pending.length === 0) return

    // One frame per preset, yielding in between: opening the gallery with 30
    // presets must not lock up the interface
    const render = (index: number) => {
      if (cancelled || index >= pending.length) return
      const preset = pending[index]
      const snapshot = preset.snapshot
      const dataUrl = renderThumbnail({
        stops: resolveActiveStops({
          isCustomMode: snapshot.isCustomMode,
          customStops: snapshot.customStops,
          colorScheme: snapshot.colorScheme,
          colorSchemes,
        }),
        complexity: snapshot.complexity,
        noiseScale: snapshot.noiseScale,
        flowIntensity: snapshot.flowIntensity,
        grainAmount: snapshot.grainAmount,
        grainScale: snapshot.grainScale,
        thresholdMin: snapshot.thresholdMin,
        thresholdMax: snapshot.thresholdMax,
        vibrance: snapshot.vibrance,
        exposure: snapshot.exposure,
        brightness: snapshot.brightness,
        contrast: snapshot.contrast,
        effect: snapshot.effect,
        bloomThreshold: snapshot.bloomThreshold,
        bloomIntensity: snapshot.bloomIntensity,
        bloomRadius: snapshot.bloomRadius,
        asciiColumns: snapshot.asciiColumns,
        asciiBackground: snapshot.asciiBackground,
        asciiRampContrast: snapshot.asciiRampContrast,
        blendSpace: snapshot.blendSpace,
        seed: snapshot.seed,
        loopDuration: snapshot.loopDuration,
      })

      if (dataUrl) {
        cache.current.set(preset.id, dataUrl)
        setThumbnails((current) => ({ ...current, [preset.id]: dataUrl }))
      }
      requestAnimationFrame(() => render(index + 1))
    }

    requestAnimationFrame(() => render(0))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, colorSchemes])

  useEffect(() => () => disposeThumbnailRenderer(), [])

  return thumbnails
}

// ─── Gallery of full presets ─────────────────────────────────────────────────
// Unlike a color scheme (colors only), a preset saves the whole look: colors plus
// speed, complexity, noise, flow, grain and thresholds.

export function PresetGallery() {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const { toast } = useToast()

  const savedPresets = useGradientStore((state) => state.savedPresets)
  const colorSchemes = useGradientStore((state) => state.colorSchemes)
  const saveCurrentPreset = useGradientStore((state) => state.saveCurrentPreset)
  const applyPreset = useGradientStore((state) => state.applyPreset)
  const deletePreset = useGradientStore((state) => state.deletePreset)
  const exportLibrary = useGradientStore((state) => state.exportLibrary)
  const importLibrary = useGradientStore((state) => state.importLibrary)

  const thumbnails = useSnapshotThumbnails(savedPresets, colorSchemes)
  const importRef = useRef<HTMLInputElement>(null)

  const handleExportLibrary = () => {
    const blob = new Blob([exportLibrary()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `gradient-library-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast({
      title: "Library exported",
      description: `${savedPresets.length} preset(s) and ${Object.keys(colorSchemes).length} scheme(s).`,
    })
  }

  const handleImportLibrary = async (file: File) => {
    try {
      const { presets, schemes } = importLibrary(await file.text())
      toast({
        title: "Library imported",
        description: `${presets} preset(s) and ${schemes} scheme(s) added.`,
      })
    } catch (error) {
      toast({
        title: "Could not import",
        description: error instanceof Error ? error.message : "Invalid file.",
        variant: "destructive",
      })
    }
  }

  const handleSave = () => {
    const name = presetName.trim()
    if (!name) {
      toast({
        title: "Name required",
        description: "Give the preset a name first.",
        variant: "destructive",
      })
      return
    }
    saveCurrentPreset(name)
    setPresetName("")
    setSaveDialogOpen(false)
    toast({
      title: "Preset saved",
      description: `"${name}" holds the colors and every animation parameter.`,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white">My Presets</Label>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-white"
            onClick={handleExportLibrary}
            disabled={savedPresets.length === 0}
            title="Export library (JSON)"
            aria-label="Export library"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-white"
            onClick={() => importRef.current?.click()}
            title="Import library (JSON)"
            aria-label="Import library"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white h-8"
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            Save current
          </Button>
        </div>
      </div>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Library file to import"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleImportLibrary(file)
          event.target.value = ""
        }}
      />

      {savedPresets.length === 0 ? (
        <p className="text-xs text-neutral-500">
No presets yet. A preset stores the gradient's whole look — colors and every
          animation parameter.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {savedPresets.map((preset) => (
            <div
              key={preset.id}
              className="group relative rounded-lg overflow-hidden border border-white/10 hover:border-white/25 transition-colors"
            >
              <button
                type="button"
                onClick={() => {
                  applyPreset(preset.id)
                  toast({ title: "Preset applied", description: preset.name })
                }}
                className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                aria-label={`Apply preset ${preset.name}`}
              >
                {/* Shader-rendered thumbnail; the CSS gradient shows until it is
                    ready and serves as the fallback when the browser refuses
                    another WebGL context */}
                <div
                  className="h-20 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: thumbnails[preset.id]
                      ? `url(${thumbnails[preset.id]})`
                      : undefined,
                    background: thumbnails[preset.id]
                      ? `url(${thumbnails[preset.id]}) center/cover`
                      : snapshotToGradientCSS(preset.snapshot, colorSchemes),
                  }}
                />
                <div className="px-2.5 py-2 bg-neutral-900">
                  <p className="text-xs text-white truncate">{preset.name}</p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  deletePreset(preset.id)
                  toast({ title: "Preset removed", description: preset.name })
                }}
                className="absolute top-1 right-1 h-6 w-6 bg-black/60 text-neutral-300 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label={`Remove preset ${preset.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Save preset dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-neutral-900 text-white border-neutral-700">
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="preset-name" className="text-white mb-2 block">
              Preset name
            </Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="My favorite gradient"
              className="bg-neutral-800 border-neutral-700 text-white"
            />
            <p className="text-xs text-neutral-400 mt-2">
Saves colors, speed, complexity, noise, flow, grain and thresholds.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Randomizer history ──────────────────────────────────────────────────────
// Every click on "Randomize" stores its result here; clicking a thumbnail
// restores that roll.

export function RandomHistoryStrip() {
  const { toast } = useToast()
  const randomHistory = useGradientStore((state) => state.randomHistory)
  const colorSchemes = useGradientStore((state) => state.colorSchemes)
  const applySnapshot = useGradientStore((state) => state.applySnapshot)

  if (randomHistory.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Dices className="h-3.5 w-3.5 text-neutral-400" />
        <Label className="text-xs text-neutral-400">Recent rolls</Label>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {randomHistory.map((snapshot, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              applySnapshot(snapshot)
              toast({
                title: "Roll restored",
                description: "The settings from this result were reapplied.",
              })
            }}
            className="h-8 w-8 rounded-lg ring-1 ring-inset ring-white/15 hover:ring-white/40 hover:scale-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            style={{ background: snapshotToGradientCSS(snapshot, colorSchemes) }}
            aria-label={`Restore roll ${index + 1}`}
            title={`Restore roll ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

export function CuratedLooks() {
  const colorSchemes = useGradientStore((state) => state.colorSchemes)
  const applySnapshot = useGradientStore((state) => state.applySnapshot)
  const thumbnails = useSnapshotThumbnails(curatedPresets, colorSchemes)
  return <section aria-label="Starting looks" className="mb-5">
    <h2 className="text-sm font-medium text-white">Start with a look</h2>
    <p className="mt-1 mb-3 text-xs text-neutral-400">A complete palette, texture and movement. Make it yours.</p>
    <div className="grid grid-cols-2 gap-2">
      {curatedPresets.map((preset) => <button key={preset.id}
        className="overflow-hidden rounded-md border border-neutral-800 text-left hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        onClick={() => applySnapshot(preset.snapshot)} aria-label={`Apply ${preset.name} look`}>
        <span className="block aspect-[2/1] bg-cover bg-center" style={{ backgroundImage: thumbnails[preset.id] ? `url(${thumbnails[preset.id]})` : snapshotToGradientCSS(preset.snapshot, colorSchemes) }} />
        <span className="block px-2 py-2 text-xs text-neutral-200">{preset.name}</span>
      </button>)}
    </div>
  </section>
}
