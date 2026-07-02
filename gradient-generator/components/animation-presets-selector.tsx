"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wand2, Play, Pause, Save } from "lucide-react"
import { useGradientStore } from "@/lib/store"
import { animationPresets } from "@/lib/animation-presets"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Interface para o preset personalizado
interface CustomPreset {
  name: string;
  speed: number;
  complexity: number;
  noiseScale: number;
  colorScheme: string;
  flowIntensity?: number;
  grainAmount?: number;
  thresholdMin?: number;
  thresholdMax?: number;
}

export function AnimationPresetsSelector() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("presets")
  const [previewActive, setPreviewActive] = useState(false)
  const [customPreset, setCustomPreset] = useState<CustomPreset>({
    name: "Meu Preset",
    speed: 1.0,
    complexity: 3,
    noiseScale: 2.0,
    colorScheme: "redBlue",
    flowIntensity: 0.3,
    grainAmount: 0.05,
    thresholdMin: 0.3,
    thresholdMax: 0.7
  })

  // Referência para o timer de preview
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Obter estado e ações do store
  const {
    applyAnimationPreset,
    saveCustomScheme,
    setSpeed,
    setComplexity,
    setNoiseScale,
    setColorScheme,
    setFlowIntensity,
    setGrainAmount,
    setThresholdMin,
    setThresholdMax,
    // Valores atuais para restaurar após o preview
    speed: currentSpeed,
    complexity: currentComplexity,
    noiseScale: currentNoiseScale,
    colorScheme: currentColorScheme,
    flowIntensity: currentFlowIntensity,
    grainAmount: currentGrainAmount,
    thresholdMin: currentThresholdMin,
    thresholdMax: currentThresholdMax
  } = useGradientStore()

  const { toast } = useToast()

  // Salvar os valores originais para restaurar após o preview
  const originalValuesRef = useRef({
    speed: currentSpeed,
    complexity: currentComplexity,
    noiseScale: currentNoiseScale,
    colorScheme: currentColorScheme,
    flowIntensity: currentFlowIntensity,
    grainAmount: currentGrainAmount,
    thresholdMin: currentThresholdMin,
    thresholdMax: currentThresholdMax
  })

  // Atualizar valores originais quando o diálogo é aberto
  useEffect(() => {
    if (open) {
      originalValuesRef.current = {
        speed: currentSpeed,
        complexity: currentComplexity,
        noiseScale: currentNoiseScale,
        colorScheme: currentColorScheme,
        flowIntensity: currentFlowIntensity,
        grainAmount: currentGrainAmount,
        thresholdMin: currentThresholdMin,
        thresholdMax: currentThresholdMax
      }
    }
  }, [open, currentSpeed, currentComplexity, currentNoiseScale, currentColorScheme,
      currentFlowIntensity, currentGrainAmount, currentThresholdMin, currentThresholdMax])

  // Limpar o timer de preview quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current)
      }
    }
  }, [])

  // Aplicar preset e fechar o diálogo
  const handleSelectPreset = (presetId: string) => {
    applyAnimationPreset(presetId)
    setOpen(false)

    toast({
      title: "Preset aplicado",
      description: `O preset "${animationPresets[presetId].name}" foi aplicado com sucesso.`,
    })
  }

  // Função para iniciar o preview
  const startPreview = () => {
    // Salvar os valores atuais
    originalValuesRef.current = {
      speed: currentSpeed,
      complexity: currentComplexity,
      noiseScale: currentNoiseScale,
      colorScheme: currentColorScheme,
      flowIntensity: currentFlowIntensity,
      grainAmount: currentGrainAmount,
      thresholdMin: currentThresholdMin,
      thresholdMax: currentThresholdMax
    }

    // Aplicar os valores do preset personalizado
    setSpeed(customPreset.speed)
    setComplexity(customPreset.complexity)
    setNoiseScale(customPreset.noiseScale)
    setColorScheme(customPreset.colorScheme)

    if (customPreset.flowIntensity !== undefined) {
      setFlowIntensity(customPreset.flowIntensity)
    }

    if (customPreset.grainAmount !== undefined) {
      setGrainAmount(customPreset.grainAmount)
    }

    if (customPreset.thresholdMin !== undefined) {
      setThresholdMin(customPreset.thresholdMin)
    }

    if (customPreset.thresholdMax !== undefined) {
      setThresholdMax(customPreset.thresholdMax)
    }

    setPreviewActive(true)

    // Configurar um timer para restaurar os valores originais após 5 segundos
    previewTimerRef.current = setTimeout(() => {
      stopPreview()
    }, 5000)
  }

  // Função para parar o preview
  const stopPreview = () => {
    // Restaurar os valores originais
    setSpeed(originalValuesRef.current.speed)
    setComplexity(originalValuesRef.current.complexity)
    setNoiseScale(originalValuesRef.current.noiseScale)
    setColorScheme(originalValuesRef.current.colorScheme)
    setFlowIntensity(originalValuesRef.current.flowIntensity)
    setGrainAmount(originalValuesRef.current.grainAmount)
    setThresholdMin(originalValuesRef.current.thresholdMin)
    setThresholdMax(originalValuesRef.current.thresholdMax)

    setPreviewActive(false)

    // Limpar o timer
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
  }

  // Função para salvar o preset personalizado
  const saveCustomPreset = () => {
    // Aplicar os valores do preset personalizado permanentemente
    setSpeed(customPreset.speed)
    setComplexity(customPreset.complexity)
    setNoiseScale(customPreset.noiseScale)
    setColorScheme(customPreset.colorScheme)

    if (customPreset.flowIntensity !== undefined) {
      setFlowIntensity(customPreset.flowIntensity)
    }

    if (customPreset.grainAmount !== undefined) {
      setGrainAmount(customPreset.grainAmount)
    }

    if (customPreset.thresholdMin !== undefined) {
      setThresholdMin(customPreset.thresholdMin)
    }

    if (customPreset.thresholdMax !== undefined) {
      setThresholdMax(customPreset.thresholdMax)
    }

    setOpen(false)

    toast({
      title: "Preset personalizado aplicado",
      description: `O preset "${customPreset.name}" foi aplicado com sucesso.`,
    })
  }

  // Atualizar um campo do preset personalizado
  const updateCustomPreset = (field: keyof CustomPreset, value: any) => {
    setCustomPreset(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
      >
        <Wand2 className="mr-2 h-4 w-4" />
        Presets de Animação
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => {
        // Se estiver fechando o diálogo e o preview estiver ativo, pare o preview
        if (!isOpen && previewActive) {
          stopPreview()
        }
        setOpen(isOpen)
      }}>
        <DialogContent className="bg-gray-900 text-white border-gray-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Presets de Animação</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="presets" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="presets" className="text-white data-[state=active]:bg-gray-700">
                Presets
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-white data-[state=active]:bg-gray-700">
                Personalizado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="mt-4">
              <ScrollArea className="h-[60vh] md:h-[400px] pr-4">
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(animationPresets).map(([id, preset]) => (
                    <div
                      key={id}
                      className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => handleSelectPreset(id)}
                    >
                      <h3 className="font-medium text-lg mb-1">{preset.name}</h3>
                      <p className="text-sm text-gray-400 mb-2">{preset.description}</p>

                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                        <div>
                          <span className="font-medium">Velocidade:</span> {preset.speed}
                        </div>
                        <div>
                          <span className="font-medium">Complexidade:</span> {preset.complexity}
                        </div>
                        <div>
                          <span className="font-medium">Escala:</span> {preset.noiseScale}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="custom" className="mt-4 space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preset-name">Nome do Preset</Label>
                  <Input
                    id="preset-name"
                    value={customPreset.name}
                    onChange={(e) => updateCustomPreset("name", e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preset-speed">Velocidade: {customPreset.speed.toFixed(1)}</Label>
                  <Input
                    id="preset-speed"
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={customPreset.speed}
                    onChange={(e) => updateCustomPreset("speed", parseFloat(e.target.value))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preset-complexity">Complexidade: {customPreset.complexity}</Label>
                  <Input
                    id="preset-complexity"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={customPreset.complexity}
                    onChange={(e) => updateCustomPreset("complexity", parseInt(e.target.value))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preset-noiseScale">Escala de Ruído: {customPreset.noiseScale.toFixed(1)}</Label>
                  <Input
                    id="preset-noiseScale"
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={customPreset.noiseScale}
                    onChange={(e) => updateCustomPreset("noiseScale", parseFloat(e.target.value))}
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div className="pt-4 flex space-x-2">
                  <Button
                    onClick={previewActive ? stopPreview : startPreview}
                    className={previewActive ? "bg-red-600 hover:bg-red-700 flex-1" : "bg-blue-600 hover:bg-blue-700 flex-1"}
                  >
                    {previewActive ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Parar Preview
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Preview (5s)
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={saveCustomPreset}
                    className="bg-green-600 hover:bg-green-700 flex-1"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Aplicar
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              onClick={() => {
                if (previewActive) {
                  stopPreview()
                }
                setOpen(false)
              }}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
