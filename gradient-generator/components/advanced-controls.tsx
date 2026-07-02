"use client"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ChevronDown, ChevronUp, Sliders } from "lucide-react"
import { useState } from "react"
import { useGradientStore } from "@/lib/store"
import { TooltipHelp } from "@/components/tooltip-help"
import { useMediaQuery } from "@/hooks/use-media-query"

export function AdvancedControls() {
  const [expanded, setExpanded] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const {
    advancedMode,
    flowIntensity,
    grainAmount,
    thresholdMin,
    thresholdMax,
    setAdvancedMode,
    setFlowIntensity,
    setGrainAmount,
    setThresholdMin,
    setThresholdMax
  } = useGradientStore()
  
  if (!advancedMode) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Sliders className="h-4 w-4 mr-2 text-gray-400" />
            <Label className="text-white">Modo Avançado</Label>
            <TooltipHelp content="Ative para acessar controles avançados que permitem ajustes finos no gradiente." />
          </div>
          <Switch 
            checked={advancedMode} 
            onCheckedChange={setAdvancedMode} 
          />
        </div>
      </div>
    )
  }
  
  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Sliders className="h-4 w-4 mr-2 text-gray-400" />
          <Label className="text-white">Modo Avançado</Label>
          <TooltipHelp content="Desative para ocultar os controles avançados." />
        </div>
        <div className="flex items-center space-x-2">
          <Switch 
            checked={advancedMode} 
            onCheckedChange={setAdvancedMode} 
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-white"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {expanded && (
        <div className="space-y-4 mt-2 animate-in fade-in-50 duration-300">
          {/* Flow Intensity */}
          <div className="space-y-2">
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
              <Label className="text-white">Quantidade de Grão: {grainAmount.toFixed(2)}</Label>
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
          
          {/* Threshold Controls */}
          <div className="space-y-2">
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
        </div>
      )}
    </div>
  )
}
