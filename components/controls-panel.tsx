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

  // Explicit selector instead of the whole store: the panel does not need to
  // re-render when history, presets or layers change
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

              {/* Tab bar */}
              <TabsList className={`grid w-full ${multiLayerMode ? 'grid-cols-5' : 'grid-cols-4'} bg-neutral-800 text-xs h-auto p-1`}>
                <TabsTrigger value="basic" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Basic</TabsTrigger>
                <TabsTrigger value="colors" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Colors</TabsTrigger>
                <TabsTrigger value="advanced" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Advanced</TabsTrigger>
                <TabsTrigger value="presets" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Presets</TabsTrigger>
                {multiLayerMode && (
                  <TabsTrigger value="layers" className="text-white data-[state=active]:bg-neutral-700 px-2 py-1.5">Layers</TabsTrigger>
                )}
              </TabsList>

              {/* Basic Controls Tab */}
              <TabsContent value="basic" className="mt-4 space-y-4">
                {/* Animation Speed */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Animation Speed: {speed.toFixed(1)}</Label>
                    <TooltipHelp content="How fast the gradient animates. Higher values move faster." />
                  </div>
                  <Slider
                    value={[speed]}
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    onValueChange={(value) => setSpeed(value[0])}
                    thumbLabel="Animation speed"
                  />
                </div>

                {/* Complexity */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Complexity: {complexity}</Label>
                    <TooltipHelp content="How much detail the gradient carries. Higher values create more intricate patterns but cost performance on slower devices." />
                  </div>
                  <Slider
                    value={[complexity]}
                    min={1}
                    max={isMobile ? 6 : 10} // Cap complexity on mobile devices
                    step={1}
                    onValueChange={(value) => setComplexity(value[0])}
                    thumbLabel="Complexity"
                  />
                </div>

                {/* Noise Scale */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Noise Scale: {noiseScale.toFixed(1)}</Label>
                    <TooltipHelp content="The size of the patterns in the gradient. Lower values give larger, softer shapes; higher values give smaller, busier ones." />
                  </div>
                  <Slider
                    value={[noiseScale]}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    onValueChange={(value) => setNoiseScale(value[0])}
                    thumbLabel="Noise scale"
                  />
                </div>

                {/* Action buttons */}
                <div className="pt-2 space-y-3">
                  <Button
                    onClick={onCaptureImage}
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Capture Image
                  </Button>

                  <Button
                    onClick={() => {
                      randomize()
                      toast({
                        title: "Randomized",
                        description: "Colors, shape and parameters rolled at random."
                      })
                    }}
                    variant="outline"
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <Shuffle className="mr-2 h-4 w-4" />
                    Randomize
                  </Button>

                  <Button
                    onClick={() => {
                      shuffleSeed()
                      toast({
                        title: "New shape",
                        description: "Same colors and parameters, a different noise drawing."
                      })
                    }}
                    variant="outline"
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <Waves className="mr-2 h-4 w-4" />
                    Roll Shape
                  </Button>

                  <RandomHistoryStrip />

                  <Button
                    onClick={() => {
                      resetToDefaults()
                      toast({
                        title: "Settings reset",
                        description: "Every setting is back to its default value."
                      })
                    }}
                    variant="outline"
                    className="w-full bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Restore Defaults
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="colors" className="mt-4 space-y-4">
                {/* Interpolation space for the color stops */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Blend Space</Label>
                    <TooltipHelp content="How colors are interpolated. Oklab is perceptually uniform and avoids the dark middle between opposing hues; Linear is the physical mixing of light. In both, the colors you picked appear exactly as picked." />
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

                {/* Custom colors toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Label className="text-white">Custom Mode</Label>
                    <TooltipHelp content="Turn on to build and edit your own color combinations." />
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
                      Save Scheme
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Color scheme selector */}
                    <div className="space-y-2">
                      <Label className="text-white">Color Scheme</Label>
                      <Select value={colorScheme} onValueChange={setColorScheme}>
                        <SelectTrigger className="bg-neutral-900 border-neutral-700 text-white">
                          <SelectValue placeholder="Pick a color scheme" />
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
                        // Carry the current scheme into custom mode, so editing
                        // starts from it instead of from scratch
                        const currentScheme = colorSchemes[colorScheme]
                        if (currentScheme) setStops(currentScheme.stops)
                        setCustomMode(true)
                      }}
                      className="w-full mt-4 bg-neutral-700 hover:bg-neutral-600 text-white"
                    >
                      <Palette className="mr-2 h-4 w-4" />
                      Edit Colors
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="presets" className="mt-4 space-y-4">
                <PresetGallery />

                <div className="border-t border-neutral-800 pt-4 space-y-2">
                  <p className="text-sm text-neutral-400 mb-2">
                    Pick an animation preset to apply a ready-made set of parameters.
                  </p>
                  <AnimationPresetsSelector />
                </div>
              </TabsContent>

              {/* Advanced controls tab */}
              <TabsContent value="advanced" className="mt-4 space-y-4 lg:grid lg:grid-cols-2 lg:gap-x-4 lg:gap-y-4">
                {/* Flow intensity */}
                <div className="space-y-2 lg:col-span-2">
                  <div className="flex items-center">
                    <Label className="text-white">Flow Intensity: {flowIntensity.toFixed(2)}</Label>
                    <TooltipHelp content="How strongly the flow field distorts the gradient. Higher values move more." />
                  </div>
                  <Slider
                    value={[flowIntensity]}
                    min={0.1}
                    max={1.0}
                    step={0.01}
                    onValueChange={(value) => setFlowIntensity(value[0])}
                    thumbLabel="Flow intensity"
                  />
                </div>

                {/* Vibrance */}
                <div className="space-y-2 lg:col-span-2">
                  <div className="flex items-center">
                    <Label className="text-white">Vibrance: {vibrance.toFixed(2)}</Label>
                    <TooltipHelp content="Pushes colors away from the gray of equal lightness. At 0.00 the gradient delivers exactly the colors you picked — high values saturate and can clip channels." />
                  </div>
                  <Slider
                    value={[vibrance]}
                    min={-0.5}
                    max={1.0}
                    step={0.05}
                    onValueChange={(value) => setVibrance(value[0])}
                    thumbLabel="Vibrance"
                  />
                </div>

                {/* Grain amount */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Grain Amount: {grainAmount.toFixed(2)}</Label>
                    <TooltipHelp content="How much granular noise is laid over the gradient. Higher values give a coarser texture." />
                  </div>
                  <Slider
                    value={[grainAmount]}
                    min={0}
                    max={0.2}
                    step={0.01}
                    onValueChange={(value) => setGrainAmount(value[0])}
                    thumbLabel="Grain amount"
                  />
                </div>

                {/* Grain scale */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label className="text-white">Grain Scale: {grainScale.toFixed(0)}</Label>
                    <TooltipHelp content="The size of the grain pattern. Lower values give coarser grain, higher values finer grain." />
                  </div>
                  <Slider
                    value={[grainScale]}
                    min={50}
                    max={1500}
                    step={10}
                    onValueChange={(value) => setGrainScale(value[0])}
                  />
                </div>


                {/* Threshold controls */}
                <div className="space-y-2 lg:col-span-2">
                  <div className="flex items-center">
                    <Label className="text-white">Shape Threshold: {thresholdMin.toFixed(2)} – {thresholdMax.toFixed(2)}</Label>
                    <TooltipHelp content="Where the transition between colors happens. A narrow range gives crisp edges, a wide range gives soft blends." />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Label className="text-xs text-neutral-400 mb-1 block">Minimum</Label>
                      <Slider
                        value={[thresholdMin]}
                        min={0.1}
                        max={thresholdMax - 0.1}
                        step={0.01}
                        onValueChange={(value) => setThresholdMin(value[0])}
                        thumbLabel="Threshold minimum"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-neutral-400 mb-1 block">Maximum</Label>
                      <Slider
                        value={[thresholdMax]}
                        min={thresholdMin + 0.1}
                        max={0.9}
                        step={0.01}
                        onValueChange={(value) => setThresholdMax(value[0])}
                        thumbLabel="Threshold maximum"
                      />
                    </div>
                  </div>
                </div>
                 <p className="text-xs text-neutral-500 mt-2">
                   These controls fine-tune how the gradient behaves. Combinations are worth
                   experimenting with.
                 </p>
              </TabsContent>

              {/* Layers tab */}
              {multiLayerMode && (
                <TabsContent value="layers" className="mt-4 space-y-4">
                   <LayerManager />
                </TabsContent>
              )}
            </Tabs>

             {/* Save custom scheme dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogContent className="bg-neutral-900 text-white border-neutral-700">
                <DialogHeader>
                  <DialogTitle>Save Color Scheme</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="scheme-name" className="text-white mb-2 block">Scheme name</Label>
                  <Input
                    id="scheme-name"
                    value={schemeName}
                    onChange={(e) => setSchemeName(e.target.value)}
                    placeholder="My custom scheme"
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={() => {
                      if (schemeName.trim()) {
                        saveCustomScheme(schemeName.trim())
                        setSchemeName("")
                        setSaveDialogOpen(false)
                        toast({
                          title: "Scheme saved",
                          description: `"${schemeName.trim()}" was added to your schemes.`
                        })
                      } else {
                        toast({
                          title: "Name required",
                          description: "Give the color scheme a name first.",
                          variant: "destructive"
                        })
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
    </div>
  )
}
