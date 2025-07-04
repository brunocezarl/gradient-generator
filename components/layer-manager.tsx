"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Layers, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react"
import { useGradientStore } from "@/lib/store"
import { blendModes, blendModeToCSS } from "@/lib/layer-utils"
import { TooltipHelp } from "@/components/tooltip-help"
import { ScrollArea } from "@/components/ui/scroll-area"

export function LayerManager() {
  const {
    multiLayerMode,
    setMultiLayerMode,
    layers,
    activeLayerId,
    setActiveLayer,
    addLayer,
    removeLayer,
    updateLayer,
    moveLayer,
    colorSchemes
  } = useGradientStore()
  
  if (!multiLayerMode) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Layers className="h-4 w-4 mr-2 text-gray-400" />
            <Label className="text-white">Modo Multi-Camadas</Label>
            <TooltipHelp content="Ative para criar e gerenciar múltiplas camadas de gradiente." />
          </div>
          <Switch 
            checked={multiLayerMode} 
            onCheckedChange={setMultiLayerMode} 
          />
        </div>
      </div>
    )
  }
  
  // Get the active layer
  const activeLayer = layers.find(layer => layer.id === activeLayerId) || layers[0]
  
  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Layers className="h-4 w-4 mr-2 text-gray-400" />
          <Label className="text-white">Modo Multi-Camadas</Label>
          <TooltipHelp content="Desative para voltar ao modo de camada única." />
        </div>
        <Switch 
          checked={multiLayerMode} 
          onCheckedChange={setMultiLayerMode} 
        />
      </div>
      
      <div className="space-y-4">
        {/* Layer List */}
        <div className="bg-gray-800 rounded-md p-2">
          <div className="flex justify-between items-center mb-2">
            <Label className="text-white">Camadas</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={addLayer}
              title="Adicionar camada"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="h-40 pr-4">
            <div className="space-y-1">
              {layers.map((layer, index) => (
                <div 
                  key={layer.id}
                  className={`flex items-center p-2 rounded ${layer.id === activeLayerId ? 'bg-gray-700' : 'bg-gray-900 hover:bg-gray-800'}`}
                  onClick={() => setActiveLayer(layer.id)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation()
                      updateLayer(layer.id, { visible: !layer.visible })
                    }}
                    title={layer.visible ? "Ocultar camada" : "Mostrar camada"}
                  >
                    {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                  
                  <div className="flex-1 mx-2 truncate">
                    <span className="text-sm text-white">
                      Camada {index + 1}
                    </span>
                  </div>
                  
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveLayer(layer.id, 'up')
                      }}
                      disabled={index === 0}
                      title="Mover para cima"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveLayer(layer.id, 'down')
                      }}
                      disabled={index === layers.length - 1}
                      title="Mover para baixo"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-white hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeLayer(layer.id)
                      }}
                      disabled={layers.length <= 1}
                      title="Remover camada"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        {/* Active Layer Settings */}
        {activeLayer && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">Configurações da Camada</h4>
            
            {/* Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">Opacidade: {Math.round(activeLayer.opacity * 100)}%</Label>
              </div>
              <Slider
                value={[activeLayer.opacity]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(value) => updateLayer(activeLayer.id, { opacity: value[0] })}
              />
            </div>
            
            {/* Blend Mode */}
            <div className="space-y-2">
              <Label className="text-white">Modo de Mesclagem</Label>
              <Select 
                value={activeLayer.blendMode} 
                onValueChange={(value) => updateLayer(activeLayer.id, { blendMode: value })}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione o modo de mesclagem" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {Object.entries(blendModes).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Color Scheme */}
            <div className="space-y-2">
              <Label className="text-white">Esquema de Cores</Label>
              <Select 
                value={activeLayer.colorScheme} 
                onValueChange={(value) => updateLayer(activeLayer.id, { 
                  colorScheme: value,
                  isCustomMode: false
                })}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione o esquema de cores" />
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
            
            {/* Noise Scale */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">Escala de Ruído: {activeLayer.noiseScale.toFixed(1)}</Label>
              </div>
              <Slider
                value={[activeLayer.noiseScale]}
                min={0.5}
                max={5.0}
                step={0.1}
                onValueChange={(value) => updateLayer(activeLayer.id, { noiseScale: value[0] })}
              />
            </div>
            
            {/* Flow Intensity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">Intensidade do Fluxo: {activeLayer.flowIntensity.toFixed(2)}</Label>
              </div>
              <Slider
                value={[activeLayer.flowIntensity]}
                min={0.1}
                max={1.0}
                step={0.01}
                onValueChange={(value) => updateLayer(activeLayer.id, { flowIntensity: value[0] })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
