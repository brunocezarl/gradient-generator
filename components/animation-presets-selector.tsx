"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
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

  // Reference to the preview timer
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null)

  // State and actions from the store
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
    // Current values, to restore after the preview
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

  // Keep the original values so the preview can be rolled back
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

  // Refresh the original values when the dialog opens
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

  // Clear the preview timer when the component unmounts
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current)
      }
    }
  }, [])

  // Apply the preset and close the dialog
  const handleSelectPreset = (presetId: string) => {
    applyAnimationPreset(presetId)
    setOpen(false)

    toast({
      title: "Preset aplicado",
      description: `O preset "${animationPresets[presetId].name}" foi aplicado com sucesso.`,
    })
  }

  // Start the preview
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

    // Restore the original values after five seconds
    previewTimerRef.current = setTimeout(() => {
      stopPreview()
    }, 5000)
  }

  // Stop the preview
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

  // Save the custom preset
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
        className="w-full h-9 bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600"
      >
        <Wand2 className="mr-2 h-4 w-4" />
        Animation Presets
      </Button>

      <Dialog open={open} onOpenChange={(isOpen) => {
        // Closing the dialog while a preview runs stops the preview
        if (!isOpen && previewActive) {
          stopPreview()
        }
        setOpen(isOpen)
      }}>
        <DialogContent className="bg-neutral-900 text-white border-neutral-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Animation Presets</DialogTitle>
          </DialogHeader>

          {/* The tab strip stays put and the active panel takes the leftover
              height, so the list scrolls within the dialog instead of pushing
              the footer off screen. */}
          <Tabs
            defaultValue="presets"
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="grid w-full shrink-0 grid-cols-2 bg-neutral-800">
              <TabsTrigger value="presets" className="text-white data-[state=active]:bg-neutral-700">
                Presets
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-white data-[state=active]:bg-neutral-700">
                Custom
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="presets"
              className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
            >
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(animationPresets).map(([id, preset]) => (
                  <div
                    key={id}
                    className="bg-neutral-800 rounded-lg border border-white/5 p-4 cursor-pointer hover:bg-neutral-700 hover:border-white/15 transition-colors"
                    onClick={() => handleSelectPreset(id)}
                  >
                    <h3 className="font-medium text-lg mb-1">{preset.name}</h3>
                    <p className="text-sm text-neutral-400 mb-2">{preset.description}</p>

                    <div className="grid grid-cols-3 gap-2 text-xs text-neutral-400">
                      <div>
                        <span className="font-medium">Speed:</span> {preset.speed}
                      </div>
                      <div>
                        <span className="font-medium">Complexity:</span> {preset.complexity}
                      </div>
                      <div>
                        <span className="font-medium">Scale:</span> {preset.noiseScale}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent
              value="custom"
              className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="preset-name">Preset name</Label>
                  <Input
                    id="preset-name"
                    value={customPreset.name}
                    onChange={(e) => updateCustomPreset("name", e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Speed: {customPreset.speed.toFixed(1)}</Label>
                  <Slider
                    value={[customPreset.speed]}
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    onValueChange={(value) => updateCustomPreset("speed", value[0])}
                    thumbLabel="Preset speed"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Complexity: {customPreset.complexity}</Label>
                  <Slider
                    value={[customPreset.complexity]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(value) => updateCustomPreset("complexity", value[0])}
                    thumbLabel="Preset complexity"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Noise Scale: {customPreset.noiseScale.toFixed(1)}</Label>
                  <Slider
                    value={[customPreset.noiseScale]}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    onValueChange={(value) => updateCustomPreset("noiseScale", value[0])}
                    thumbLabel="Preset noise scale"
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
                        Stop preview
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
                    Apply
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
              className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
