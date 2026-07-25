"use client"

import { useState } from "react"
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
import { Save, Trash2, Dices } from "lucide-react"
import {
  useGradientStore,
  resolveActiveColors,
  StateSnapshot,
  GradientStore,
} from "@/lib/store"
import { rgbToHex } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

// Gera a pré-visualização CSS de um snapshot (aproximação estática do shader)
export function snapshotToGradientCSS(
  snapshot: StateSnapshot,
  colorSchemes: GradientStore["colorSchemes"],
): string {
  const { color1, color2, color3 } = resolveActiveColors({
    isCustomMode: snapshot.isCustomMode,
    customColors: snapshot.customColors,
    colorScheme: snapshot.colorScheme,
    colorSchemes,
  })
  const hex = (c: number[]) =>
    rgbToHex(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255))
  // Mesmo espaço de interpolação do render, para a miniatura não mentir
  const interpolation = snapshot.blendSpace === "linear" ? " in srgb-linear" : " in oklab"
  return `linear-gradient(135deg${interpolation}, ${hex(color1)}, ${hex(color2)}, ${hex(color3)})`
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
        <Button
          size="sm"
          onClick={() => setSaveDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white h-8"
        >
          <Save className="mr-2 h-3.5 w-3.5" />
          Salvar atual
        </Button>
      </div>

      {savedPresets.length === 0 ? (
        <p className="text-xs text-gray-500">
          Nenhum preset salvo ainda. Um preset guarda o visual completo do
          gradiente — cores e todos os parâmetros de animação.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {savedPresets.map((preset) => (
            <div
              key={preset.id}
              className="group relative rounded-md overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors"
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
                <div
                  className="h-12 w-full"
                  style={{ background: snapshotToGradientCSS(preset.snapshot, colorSchemes) }}
                />
                <div className="px-2 py-1.5 bg-gray-900">
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
                className="absolute top-1 right-1 h-6 w-6 bg-black/60 text-gray-300 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
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
        <DialogContent className="bg-gray-900 text-white border-gray-700">
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
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-xs text-gray-400 mt-2">
              Salva cores, velocidade, complexidade, ruído, fluxo, grão e limiares.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
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
        <Dices className="h-3.5 w-3.5 text-gray-400" />
        <Label className="text-xs text-gray-400">Últimos sorteios</Label>
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
            className="h-8 w-8 rounded-md border border-gray-700 hover:border-white hover:scale-110 transition-all"
            style={{ background: snapshotToGradientCSS(snapshot, colorSchemes) }}
            aria-label={`Restaurar sorteio ${index + 1}`}
            title={`Restaurar sorteio ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
