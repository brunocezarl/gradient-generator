"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, ImageIcon, ChevronUp, Settings, RefreshCw, Save, Palette } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { useGradientStore } from "@/lib/store"
import { ColorPicker } from "@/components/color-picker"
import { TooltipHelp } from "@/components/tooltip-help"
import { AnimationPresetsSelector } from "@/components/animation-presets-selector"
// import { AdvancedControls } from "@/components/advanced-controls" // No longer needed here
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

  // Get state and actions from store
  const {
    isPlaying,
    speed,
    complexity,
    noiseScale,
    colorScheme,
    menuOpen,
    isCustomMode,
    customColors,
    colorSchemes,
    // Import advanced state and setters
    flowIntensity,
    grainAmount,
    thresholdMin,
    thresholdMax,
    multiLayerMode, // Import multiLayerMode
    setIsPlaying,
    setSpeed,
    setComplexity,
    setNoiseScale,
    setColorScheme,
    toggleMenu,
    setCustomMode,
    setCustomColor1,
    setCustomColor2,
    saveCustomScheme,
    resetToDefaults,
    // Import advanced setters
    setFlowIntensity,
    setGrainAmount,
    setThresholdMin,
    setThresholdMax,
    // Get grainScale state and setter
    grainScale,
    setGrainScale
  } = useGradientStore()

  return (
    <>
      {/* Menu Button */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          className="bg-black/50 border-gray-700 hover:bg-black/70 text-white"
          onClick={toggleMenu}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Controls Panel - Made width responsive */}
      {menuOpen && (
        <div className="absolute top-16 left-4 z-50 w-72 md:w-80 lg:w-96 bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-white font-medium">Gradient Controls</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={toggleMenu}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto"> {/* Added max-height and scroll */}
            <Tabs defaultValue="basic" className="w-full">
              {/* Updated TabsList for more tabs */}
              <TabsList className={`grid w-full ${multiLayerMode ? 'grid-cols-5' : 'grid-cols-4'} bg-gray-800 text-xs h-auto p-1`}>
                <TabsTrigger value="basic" className="text-white data-[state=active]:bg-gray-700 px-2 py-1.5">Básico</TabsTrigger>
                <TabsTrigger value="colors" className="text-white data-[state=active]:bg-gray-700 px-2 py-1.5">Cores</TabsTrigger>
                <TabsTrigger value="advanced" className="text-white data-[state=active]:bg-gray-700 px-2 py-1.5">Avançado</TabsTrigger>
                <TabsTrigger value="presets" className="text-white data-[state=active]:bg-gray-700 px-2 py-1.5">Presets</TabsTrigger>
                {multiLayerMode && (
                  <TabsTrigger value="layers" className="text-white data-[state=active]:bg-gray-700 px-2 py-1.5">Camadas</TabsTrigger>
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
                  <Slider value={[speed]} min={0.1} max={3.0} step={0.1} onValueChange={(value) => setSpeed(value[0])} />
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
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
                  >
                    {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {isPlaying ? "Pausar Animação" : "Iniciar Animação"}
                  </Button>

                  <Button
                    onClick={onCaptureImage}
                    className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Capturar Imagem
                  </Button>

                  <Button
                    onClick={() => {
                      resetToDefaults()
                      toast({
                        title: "Configurações Resetadas",
                        description: "Todas as configurações foram restauradas para os valores padrão."
                      })
                    }}
                    variant="outline"
                    className="w-full bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Restaurar Padrões
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="colors" className="mt-4 space-y-4">
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
                  <>
                    {/* Custom Color Pickers */}
                    <div className="space-y-4 mt-4">
                      <ColorPicker
                        label="Cor 1"
                        color={customColors.color1}
                        onChange={setCustomColor1}
                      />

                      <ColorPicker
                        label="Cor 2"
                        color={customColors.color2}
                        onChange={setCustomColor2}
                      />

                      <Button
                        onClick={() => setSaveDialogOpen(true)}
                        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Salvar Esquema
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Color Scheme Selector */}
                    <div className="space-y-2">
                      <Label className="text-white">Esquema de Cores</Label>
                      <Select value={colorScheme} onValueChange={setColorScheme}>
                        <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                          <SelectValue placeholder="Selecione um esquema de cores" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700 text-white max-h-60">
                          {Object.entries(colorSchemes).map(([key, scheme]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center">
                                <div className="flex mr-2">
                                  <div
                                    className="w-3 h-3 rounded-full mr-1"
                                    style={{
                                      backgroundColor: `rgb(${Math.round(scheme.color1[0] * 255)}, ${Math.round(scheme.color1[1] * 255)}, ${Math.round(scheme.color1[2] * 255)})`
                                    }}
                                  />
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor: `rgb(${Math.round(scheme.color2[0] * 255)}, ${Math.round(scheme.color2[1] * 255)}, ${Math.round(scheme.color2[2] * 255)})`
                                    }}
                                  />
                                </div>
                                {scheme.name || key}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => {
                        // Copy current scheme to custom colors
                        const currentScheme = colorSchemes[colorScheme]
                        setCustomColor1(currentScheme.color1)
                        setCustomColor2(currentScheme.color2)
                        setCustomMode(true)
                      }}
                      className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      <Palette className="mr-2 h-4 w-4" />
                      Editar Cores
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="presets" className="mt-4 space-y-4">
                {/* Removed duplicate opening p tag */}
                <p className="text-sm text-gray-400 mb-2">
                  Selecione um preset de animação para aplicar configurações pré-definidas ao seu gradiente.
                </p>
                <AnimationPresetsSelector />
                {/* Removed AdvancedControls and LayerManager from here */}
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
                      <Label className="text-xs text-gray-400 mb-1 block">Mínimo</Label>
                      <Slider
                        value={[thresholdMin]}
                        min={0.1}
                        max={thresholdMax - 0.1}
                        step={0.01}
                        onValueChange={(value) => setThresholdMin(value[0])}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-gray-400 mb-1 block">Máximo</Label>
                      <Slider
                        value={[thresholdMax]}
                        min={thresholdMin + 0.1}
                        max={0.9}
                        step={0.01}
                        onValueChange={(value) => setThresholdMax(value[0])}
                      />
                    </div>
                  </div>
                </div>
                 <p className="text-xs text-gray-500 mt-2">
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
              <DialogContent className="bg-gray-900 text-white border-gray-700">
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
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
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
        </div>
      )}
    </>
  )
}
