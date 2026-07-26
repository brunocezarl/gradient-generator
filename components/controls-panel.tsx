"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageIcon, RefreshCw, Save, Palette, Shuffle, Waves } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { colorBlendSpaces, type ColorBlendSpace } from "@/lib/color"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { useGradientStore } from "@/lib/store"
import { StopsEditor } from "@/components/stops-editor"
import { StopDots } from "@/components/gradient-swatch"
import { TooltipHelp } from "@/components/tooltip-help"
import { AnimationPresetsSelector } from "@/components/animation-presets-selector"
import { PresetGallery, RandomHistoryStrip } from "@/components/preset-gallery"
import { LayerManager } from "@/components/layer-manager"
import { useToast } from "@/components/ui/use-toast"
import { useMediaQuery } from "@/hooks/use-media-query"

interface ControlsPanelProps {
  onCaptureImage: () => void
}

export function ControlsPanel({ onCaptureImage }: ControlsPanelProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [schemeName, setSchemeName] = useState("")
  const { toast } = useToast()
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Seletor explícito em vez do store inteiro: o painel não precisa
  // re-renderizar quando histórico, presets ou camadas mudam
  const {
    speed,
    complexity,
    noiseScale,
    colorScheme,
    isCustomMode,
    customStops,
    colorSchemes,
    flowIntensity,
    grainAmount,
    grainScale,
    thresholdMin,
    thresholdMax,
    vibrance,
    blendSpace,
    multiLayerMode,
    setSpeed,
    setComplexity,
    setNoiseScale,
    setColorScheme,
    setCustomMode,
    setStops,
    saveCustomScheme,
    resetToDefaults,
    randomize,
    setFlowIntensity,
    setGrainAmount,
    setGrainScale,
    setThresholdMin,
    setThresholdMax,
    setVibrance,
    setBlendSpace,
    shuffleSeed,
  } = useGradientStore(
    useShallow((state) => ({
      speed: state.speed,
      complexity: state.complexity,
      noiseScale: state.noiseScale,
      colorScheme: state.colorScheme,
      isCustomMode: state.isCustomMode,
      customStops: state.customStops,
      colorSchemes: state.colorSchemes,
      flowIntensity: state.flowIntensity,
      grainAmount: state.grainAmount,
      grainScale: state.grainScale,
      thresholdMin: state.thresholdMin,
      thresholdMax: state.thresholdMax,
      vibrance: state.vibrance,
      blendSpace: state.blendSpace,
      multiLayerMode: state.multiLayerMode,
      setSpeed: state.setSpeed,
      setComplexity: state.setComplexity,
      setNoiseScale: state.setNoiseScale,
      setColorScheme: state.setColorScheme,
      setCustomMode: state.setCustomMode,
      setStops: state.setStops,
      saveCustomScheme: state.saveCustomScheme,
      resetToDefaults: state.resetToDefaults,
      randomize: state.randomize,
      setFlowIntensity: state.setFlowIntensity,
      setGrainAmount: state.setGrainAmount,
      setGrainScale: state.setGrainScale,
      setThresholdMin: state.setThresholdMin,
      setThresholdMax: state.setThresholdMax,
      setVibrance: state.setVibrance,
      setBlendSpace: state.setBlendSpace,
      shuffleSeed: state.shuffleSeed,
    }))
  )

  return (
    <div className="p-3 space-y-4">
      <Tabs defaultValue="basic" className="w-full">

              {/* Updated TabsList for more tabs */}
              <TabsList className={`grid w-full ${multiLayerMode ? 'grid-cols-5' : 'grid-cols-4'} bg-neutral-800 text-xs h-auto p-1`}>
                <TabsTrigger value="basic" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Básico</TabsTrigger>
                <TabsTrigger value="colors" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Cores</TabsTrigger>
                <TabsTrigger value="advanced" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Avançado</TabsTrigger>
                <TabsTrigger value="presets" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Presets</TabsTrigger>
                {multiLayerMode && (
                  <TabsTrigger value="layers" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Camadas</TabsTrigger>
                )}
              </TabsList>

              {/* Basic Controls Tab */}
              <TabsContent value="basic" className="mt-4 space-y-4">
                {/* Animation Speed */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Velocidade da Animação: {speed.toFixed(1)}</Label>
                    <TooltipHelp content="Controla a velocidade da animação do gradiente. Valores mais altos resultam em movimento mais rápido." />
                  </div>
                  <Slider
                    value={[speed]}
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    onValueChange={(value) => setSpeed(value[0])}
                    thumbLabel="Velocidade da animação"
                  />
                </div>

                {/* Complexity */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Complexidade: {complexity}</Label>
                    <TooltipHelp content="Define a quantidade de detalhes no gradiente. Valores mais altos criam padrões mais complexos, mas podem reduzir o desempenho em dispositivos mais lentos." />
                  </div>
                  <Slider
                    value={[complexity]}
                    min={1}
                    max={isMobile ? 6 : 10} // Limit max complexity on mobile devices
                    step={1}
                    onValueChange={(value) => setComplexity(value[0])}
                    thumbLabel="Complexidade"
                  />
                </div>

                {/* Noise Scale */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Escala de Ruído: {noiseScale.toFixed(1)}</Label>
                    <TooltipHelp content="Controla o tamanho dos padrões no gradiente. Valores mais baixos criam padrões maiores e mais suaves, enquanto valores mais altos criam padrões menores e mais detalhados." />
                  </div>
                  <Slider
                    value={[noiseScale]}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    onValueChange={(value) => setNoiseScale(value[0])}
                    thumbLabel="Escala de ruído"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-3">
                  <Button
                    onClick={onCaptureImage}
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Capturar Imagem
                  </Button>

                  <Button
                    onClick={() => {
                      randomize()
                      toast({
                        title: "Randomizado!",
                        description: "Cores, forma e parâmetros gerados aleatoriamente."
                      })
                    }}
                    variant="outline"
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <Shuffle className="mr-2 h-4 w-4" />
                    Randomizar
                  </Button>

                  <Button
                    onClick={() => {
                      shuffleSeed()
                      toast({
                        title: "Nova Forma",
                        description: "Mesmas cores e parâmetros, outro desenho do ruído."
                      })
                    }}
                    variant="outline"
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <Waves className="mr-2 h-4 w-4" />
                    Sortear Forma
                  </Button>

                  <RandomHistoryStrip />

                  <Button
                    onClick={() => {
                      resetToDefaults()
                      toast({
                        title: "Configurações Resetadas",
                        description: "Todas as configurações foram restauradas para os valores padrão."
                      })
                    }}
                    variant="outline"
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Restaurar Padrões
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="colors" className="mt-4 space-y-4">
                {/* Espaço de mistura das paradas de cor */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Espaço de Mistura</Label>
                    <TooltipHelp content="Como as cores são interpoladas. Oklab é perceptualmente uniforme e evita o meio escuro entre matizes opostos; Linear é a mistura física de luz. Em ambos, as cores escolhidas aparecem exatamente como no picker." />
                  </div>
                  <Select
                    value={blendSpace}
                    onValueChange={(value) => setBlendSpace(value as ColorBlendSpace)}
                  >
                    <SelectTrigger className="bg-neutral-900 border-neutral-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                      {Object.entries(colorBlendSpaces).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Colors Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label className="text-white">Modo Personalizado</Label>
                    <TooltipHelp content="Ative para criar e personalizar suas próprias combinações de cores." />
                  </div>
                  <Switch
                    checked={isCustomMode}
                    onCheckedChange={setCustomMode}
                  />
                </div>

                {isCustomMode ? (
                  <div className="mt-4">
                    <StopsEditor />
                    <Button
                      onClick={() => setSaveDialogOpen(true)}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Esquema
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Color Scheme Selector */}
                    <div className="space-y-2">
                      <Label className="text-white">Esquema de Cores</Label>
                      <Select value={colorScheme} onValueChange={setColorScheme}>
                        <SelectTrigger className="bg-neutral-900 border-neutral-700 text-white">
                          <SelectValue placeholder="Selecione um esquema de cores" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-700 text-white max-h-60">
                          {Object.entries(colorSchemes).map(([key, scheme]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center">
                                <StopDots stops={scheme.stops} />
                                {scheme.name || key}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => {
                        // Levar o esquema atual para o modo personalizado, para
                        // editar a partir dele em vez de começar do zero
                        const currentScheme = colorSchemes[colorScheme]
                        if (currentScheme) setStops(currentScheme.stops)
                        setCustomMode(true)
                      }}
                      className="w-full mt-4 bg-neutral-700 hover:bg-neutral-600 text-white"
                    >
                      <Palette className="mr-2 h-4 w-4" />
                      Editar Cores
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="presets" className="mt-4 space-y-4">
                <PresetGallery />

                <div className="border-t border-neutral-800 pt-4 space-y-2">
                  <p className="text-sm text-neutral-400 mb-2">
                    Selecione um preset de animação para aplicar configurações pré-definidas ao seu gradiente.
                  </p>
                  <AnimationPresetsSelector />
                </div>
              </TabsContent>

              {/* Advanced Controls Tab - Added responsive grid */}
              <TabsContent value="advanced" className="mt-4 space-y-4 lg:grid lg:grid-cols-2 lg:gap-x-4 lg:gap-y-4">
                {/* Flow Intensity */}
                <div className="space-y-2 lg:col-span-2"> {/* Span full width on large screens */}
                  <div className="flex items-center">
                    <Label className="text-white">Intensidade do Fluxo: {flowIntensity.toFixed(2)}</Label>
                    <TooltipHelp content="Controla a intensidade do movimento do fluxo no gradiente. Valores mais altos criam movimentos mais intensos." />
                  </div>
                  <Slider
                    value={[flowIntensity]}
                    min={0.1}
                    max={1.0}
                    step={0.01}
                    onValueChange={(value) => setFlowIntensity(value[0])}
                    thumbLabel="Intensidade do fluxo"
                  />
                </div>

                {/* Vibrance */}
                <div className="space-y-2 lg:col-span-2">
                  <div className="flex items-center">
                    <Label className="text-white">Vibrância: {vibrance.toFixed(2)}</Label>
                    <TooltipHelp content="Afasta as cores do cinza de mesma luminosidade. Em 0.00 o gradiente entrega exatamente as cores escolhidas — valores altos saturam e podem estourar canais." />
                  </div>
                  <Slider
                    value={[vibrance]}
                    min={-0.5}
                    max={1.0}
                    step={0.05}
                    onValueChange={(value) => setVibrance(value[0])}
                    thumbLabel="Vibrância"
                  />
                </div>

                {/* Grain Amount */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Intensidade do Grão: {grainAmount.toFixed(2)}</Label> {/* Renamed Label */}
                    <TooltipHelp content="Controla a quantidade de ruído granular adicionado ao gradiente. Valores mais altos criam uma textura mais granulada." />
                  </div>
                  <Slider
                    value={[grainAmount]}
                    min={0}
                    max={0.2}
                    step={0.01}
                    onValueChange={(value) => setGrainAmount(value[0])}
                    thumbLabel="Intensidade do grão"
                  />
                </div>

                {/* Grain Scale */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Escala do Grão: {grainScale.toFixed(0)}</Label> {/* Use selected state */}
                    <TooltipHelp content="Controla o tamanho do padrão de grão. Valores menores criam grãos maiores, valores maiores criam grãos menores/mais finos." />
                  </div>
                  <Slider
                    value={[grainScale]} // Use selected state
                    min={50}  // Define appropriate min/max/step
                    max={1500}
                    step={10}
                    onValueChange={(value) => setGrainScale(value[0])} // Use selected setter
                  />
                </div>


                {/* Threshold Controls */}
                <div className="space-y-2 lg:col-span-2"> {/* Span full width on large screens */}
                  <div className="flex items-center">
                    <Label className="text-white">Limiar de Transição: {thresholdMin.toFixed(2)} - {thresholdMax.toFixed(2)}</Label>
                    <TooltipHelp content="Controla os limites de transição entre as cores. Um intervalo menor cria bordas mais nítidas, enquanto um intervalo maior cria transições mais suaves." />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Label className="text-xs text-neutral-400 mb-1 block">Mínimo</Label>
                      <Slider
                        value={[thresholdMin]}
                        min={0.1}
                        max={thresholdMax - 0.1}
                        step={0.01}
                        onValueChange={(value) => setThresholdMin(value[0])}
                        thumbLabel="Limiar mínimo"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-neutral-400 mb-1 block">Máximo</Label>
                      <Slider
                        value={[thresholdMax]}
                        min={thresholdMin + 0.1}
                        max={0.9}
                        step={0.01}
                        onValueChange={(value) => setThresholdMax(value[0])}
                        thumbLabel="Limiar máximo"
                      />
                    </div>
                  </div>
                </div>
                 <p className="text-xs text-neutral-500 mt-2">
                   Estes controles permitem ajustes finos no comportamento do gradiente. Experimente diferentes combinações para criar efeitos únicos.
                 </p>
              </TabsContent>

              {/* Layers Tab - Conditionally rendered */}
              {multiLayerMode && (
                <TabsContent value="layers" className="mt-4 space-y-4">
                   <LayerManager />
                </TabsContent>
              )}
            </Tabs>

             {/* Save Custom Scheme Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogContent className="bg-neutral-900 text-white border-neutral-700">
                <DialogHeader>
                  <DialogTitle>Salvar Esquema de Cores</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="scheme-name" className="text-white mb-2 block">Nome do Esquema</Label>
                  <Input
                    id="scheme-name"
                    value={schemeName}
                    onChange={(e) => setSchemeName(e.target.value)}
                    placeholder="Meu Esquema Personalizado"
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={() => {
                      if (schemeName.trim()) {
                        saveCustomScheme(schemeName.trim())
                        setSchemeName("")
                        setSaveDialogOpen(false)
                        toast({
                          title: "Esquema Salvo",
                          description: `O esquema "${schemeName.trim()}" foi salvo com sucesso.`
                        })
                      } else {
                        toast({
                          title: "Nome Obrigatório",
                          description: "Por favor, forneça um nome para o esquema de cores.",
                          variant: "destructive"
                        })
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
    </div>
  )
}
