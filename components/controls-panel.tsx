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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { useGradientStore } from "@/lib/store"
import { CanvasSection } from "@/components/canvas-section"
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

// Sections open on first paint: the framing and the colors are what a session
// starts with. Everything else is a refinement and stays folded away.
const DEFAULT_OPEN = ["canvas", "color"]

export function ControlsPanel({ onCaptureImage }: ControlsPanelProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [schemeName, setSchemeName] = useState("")
  const [openSections, setOpenSections] = useState<string[]>(DEFAULT_OPEN)
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
    <div className="p-3">
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="w-full"
      >
        {/* ─── Canvas ──────────────────────────────────────────────────── */}
        <AccordionItem value="canvas">
          <AccordionTrigger>Canvas</AccordionTrigger>
          <AccordionContent>
            <CanvasSection />
          </AccordionContent>
        </AccordionItem>

        {/* ─── Adjustments ─────────────────────────────────────────────── */}
        <AccordionItem value="adjustments">
          <AccordionTrigger>Adjustments</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* ─── Color ───────────────────────────────────────────────────── */}
        <AccordionItem value="color">
          <AccordionTrigger>Color</AccordionTrigger>
          <AccordionContent className="space-y-4">
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
              <div>
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
                  className="w-full bg-neutral-700 hover:bg-neutral-600 text-white"
                >
                  <Palette className="mr-2 h-4 w-4" />
                  Edit Colors
                </Button>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ─── Presets ─────────────────────────────────────────────────── */}
        <AccordionItem value="presets">
          <AccordionTrigger>Presets</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <PresetGallery />

            <div className="border-t border-neutral-800 pt-4 space-y-2">
              <p className="text-sm text-neutral-400 mb-2">
                Pick an animation preset to apply a ready-made set of parameters.
              </p>
              <AnimationPresetsSelector />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Shape ───────────────────────────────────────────────────── */}
        <AccordionItem value="shape">
          <AccordionTrigger>Shape</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {/* Noise scale */}
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

            {/* Threshold controls */}
            <div className="space-y-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* ─── Grain ───────────────────────────────────────────────────── */}
        <AccordionItem value="grain">
          <AccordionTrigger>Grain</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="text-white">Amount: {grainAmount.toFixed(2)}</Label>
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

            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="text-white">Scale: {grainScale.toFixed(0)}</Label>
                <TooltipHelp content="The size of the grain pattern. Lower values give coarser grain, higher values finer grain." />
              </div>
              <Slider
                value={[grainScale]}
                min={50}
                max={1500}
                step={10}
                onValueChange={(value) => setGrainScale(value[0])}
                thumbLabel="Grain scale"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Motion ──────────────────────────────────────────────────── */}
        <AccordionItem value="motion">
          <AccordionTrigger>Motion</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="text-white">Speed: {speed.toFixed(1)}</Label>
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

            <div className="space-y-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* ─── Layers ──────────────────────────────────────────────────── */}
        {multiLayerMode && (
          <AccordionItem value="layers">
            <AccordionTrigger>Layers</AccordionTrigger>
            <AccordionContent>
              <LayerManager />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* ─── Actions ───────────────────────────────────────────────────── */}
      <div className="pt-4 space-y-3">
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
