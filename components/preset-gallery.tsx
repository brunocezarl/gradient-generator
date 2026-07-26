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
import { stopsToCss } from "@/lib/color-stops"
import { disposeThumbnailRenderer, renderThumbnail } from "@/lib/thumbnail"
import { useToast } from "@/components/ui/use-toast"

// Gradiente CSS das paradas de um snapshot, no mesmo espaço de interpolação do
// render. Usado como preview instantâneo enquanto a miniatura renderizada pelo
// shader não está pronta.
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
 * Miniaturas renderizadas pelo shader, com o CSS como preview imediato.
 *
 * O render acontece uma vez por preset e fica em cache: a galeria é uma lista de
 * imagens estáticas, não N canvases vivos.
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

    // Um frame por preset, cedendo o controle entre eles: abrir a galeria com
    // 30 presets não pode travar a interface
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

// ─── Galeria de presets completos ────────────────────────────────────────────
// Diferente dos esquemas de cores (só 3 cores), um preset salva o visual
// inteiro: cores + velocidade, complexidade, ruído, fluxo, grão e limiares.

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
    link.download = `biblioteca-gradientes-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast({
      title: "Biblioteca exportada",
      description: `${savedPresets.length} preset(s) e ${Object.keys(colorSchemes).length} esquema(s).`,
    })
  }

  const handleImportLibrary = async (file: File) => {
    try {
      const { presets, schemes } = importLibrary(await file.text())
      toast({
        title: "Biblioteca importada",
        description: `${presets} preset(s) e ${schemes} esquema(s) adicionados.`,
      })
    } catch (error) {
      toast({
        title: "Não foi possível importar",
        description: error instanceof Error ? error.message : "Arquivo inválido.",
        variant: "destructive",
      })
    }
  }

  const handleSave = () => {
    const name = presetName.trim()
    if (!name) {
      toast({
        title: "Nome Obrigatório",
        description: "Por favor, forneça um nome para o preset.",
        variant: "destructive",
      })
      return
    }
    saveCurrentPreset(name)
    setPresetName("")
    setSaveDialogOpen(false)
    toast({
      title: "Preset Salvo",
      description: `"${name}" guarda cores e todos os parâmetros de animação.`,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white">Meus Presets</Label>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-white"
            onClick={handleExportLibrary}
            disabled={savedPresets.length === 0}
            title="Exportar biblioteca (JSON)"
            aria-label="Exportar biblioteca"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-white"
            onClick={() => importRef.current?.click()}
            title="Importar biblioteca (JSON)"
            aria-label="Importar biblioteca"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white h-8"
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            Salvar atual
          </Button>
        </div>
      </div>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Arquivo de biblioteca para importar"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleImportLibrary(file)
          event.target.value = ""
        }}
      />

      {savedPresets.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Nenhum preset salvo ainda. Um preset guarda o visual completo do
          gradiente — cores e todos os parâmetros de animação.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {savedPresets.map((preset) => (
            <div
              key={preset.id}
              className="group relative rounded-md overflow-hidden border border-neutral-700 hover:border-neutral-500 transition-colors"
            >
              <button
                type="button"
                onClick={() => {
                  applyPreset(preset.id)
                  toast({ title: "Preset Aplicado", description: preset.name })
                }}
                className="w-full text-left"
                aria-label={`Aplicar preset ${preset.name}`}
              >
                {/* Miniatura renderizada pelo shader; o gradiente CSS aparece
                    antes dela ficar pronta e serve de fallback se o navegador
                    não conceder outro contexto WebGL */}
                <div
                  className="h-16 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: thumbnails[preset.id]
                      ? `url(${thumbnails[preset.id]})`
                      : undefined,
                    background: thumbnails[preset.id]
                      ? `url(${thumbnails[preset.id]}) center/cover`
                      : snapshotToGradientCSS(preset.snapshot, colorSchemes),
                  }}
                />
                <div className="px-2 py-1.5 bg-neutral-900">
                  <p className="text-xs text-white truncate">{preset.name}</p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  deletePreset(preset.id)
                  toast({ title: "Preset Removido", description: preset.name })
                }}
                className="absolute top-1 right-1 h-6 w-6 bg-black/60 text-neutral-300 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label={`Remover preset ${preset.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-neutral-900 text-white border-neutral-700">
          <DialogHeader>
            <DialogTitle>Salvar Preset</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="preset-name" className="text-white mb-2 block">
              Nome do Preset
            </Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Meu Gradiente Favorito"
              className="bg-neutral-800 border-neutral-700 text-white"
            />
            <p className="text-xs text-neutral-400 mt-2">
              Salva cores, velocidade, complexidade, ruído, fluxo, grão e limiares.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Histórico do randomizador ───────────────────────────────────────────────
// Cada clique em "Randomizar" guarda o resultado aqui; clicar numa miniatura
// restaura aquele sorteio.

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
        <Label className="text-xs text-neutral-400">Últimos sorteios</Label>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {randomHistory.map((snapshot, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              applySnapshot(snapshot)
              toast({
                title: "Sorteio Restaurado",
                description: "As configurações deste resultado foram reaplicadas.",
              })
            }}
            className="h-8 w-8 rounded-md border border-neutral-700 hover:border-white hover:scale-110 transition-all"
            style={{ background: snapshotToGradientCSS(snapshot, colorSchemes) }}
            aria-label={`Restaurar sorteio ${index + 1}`}
            title={`Restaurar sorteio ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
