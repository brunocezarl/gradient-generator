"use client"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Layers, Plus, Trash2, Eye, EyeOff, GripVertical, Waves } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useGradientStore } from "@/lib/store"
import { blendModes, generateSeed } from "@/lib/layer-utils"
import { TooltipHelp } from "@/components/tooltip-help"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GradientLayer } from "@/lib/layer-utils"

// ─── Item de camada arrastável ─────────────────────────────────────────────

interface SortableLayerItemProps {
  layer: GradientLayer
  index: number
  isActive: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onRemove: () => void
  canRemove: boolean
}

function SortableLayerItem({
  layer,
  index,
  isActive,
  onSelect,
  onToggleVisibility,
  onRemove,
  canRemove,
}: SortableLayerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: layer.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center p-2 rounded ${
        isActive ? "bg-gray-700" : "bg-gray-900 hover:bg-gray-800"
      }`}
      onClick={onSelect}
    >
      {/* Handle de arraste */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 mr-1 touch-none"
        onClick={(e) => e.stopPropagation()}
        title="Arrastar para reordenar"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* Botão visibilidade */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-gray-400 hover:text-white"
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisibility()
        }}
        title={layer.visible ? "Ocultar camada" : "Mostrar camada"}
        aria-label={layer.visible ? "Ocultar camada" : "Mostrar camada"}
      >
        {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </Button>

      <div className="flex-1 mx-2 truncate">
        <span className="text-sm text-white">Camada {index + 1}</span>
      </div>

      {/* Remover */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-gray-400 hover:text-red-500"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        disabled={!canRemove}
        title="Remover camada"
        aria-label="Remover camada"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────

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
    reorderLayers,
    colorSchemes,
  } = useGradientStore(
    useShallow((state) => ({
      multiLayerMode: state.multiLayerMode,
      setMultiLayerMode: state.setMultiLayerMode,
      layers: state.layers,
      activeLayerId: state.activeLayerId,
      setActiveLayer: state.setActiveLayer,
      addLayer: state.addLayer,
      removeLayer: state.removeLayer,
      updateLayer: state.updateLayer,
      reorderLayers: state.reorderLayers,
      colorSchemes: state.colorSchemes,
    }))
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = layers.findIndex((l) => l.id === active.id)
    const newIndex = layers.findIndex((l) => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(layers, oldIndex, newIndex).map((l) => l.id)
    reorderLayers(newOrder)
  }

  if (!multiLayerMode) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Layers className="h-4 w-4 mr-2 text-gray-400" />
            <Label className="text-white">Modo Multi-Camadas</Label>
            <TooltipHelp content="Ative para criar e gerenciar múltiplas camadas de gradiente." />
          </div>
          <Switch checked={multiLayerMode} onCheckedChange={setMultiLayerMode} />
        </div>
      </div>
    )
  }

  const activeLayer = layers.find((layer) => layer.id === activeLayerId) || layers[0]

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Layers className="h-4 w-4 mr-2 text-gray-400" />
          <Label className="text-white">Modo Multi-Camadas</Label>
          <TooltipHelp content="Desative para voltar ao modo de camada única." />
        </div>
        <Switch checked={multiLayerMode} onCheckedChange={setMultiLayerMode} />
      </div>

      <div className="space-y-4">
        {/* Lista de camadas com DnD */}
        <div className="bg-gray-800 rounded-md p-2">
          <div className="flex justify-between items-center mb-2">
            <Label className="text-white">Camadas</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={addLayer}
              title="Adicionar camada"
              aria-label="Adicionar camada"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="h-40 pr-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={layers.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {layers.map((layer, index) => (
                    <SortableLayerItem
                      key={layer.id}
                      layer={layer}
                      index={index}
                      isActive={layer.id === activeLayerId}
                      onSelect={() => setActiveLayer(layer.id)}
                      onToggleVisibility={() =>
                        updateLayer(layer.id, { visible: !layer.visible })
                      }
                      onRemove={() => removeLayer(layer.id)}
                      canRemove={layers.length > 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>
        </div>

        {/* Configurações da camada ativa */}
        {activeLayer && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">Configurações da Camada</h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">
                  Opacidade: {Math.round(activeLayer.opacity * 100)}%
                </Label>
              </div>
              <Slider
                value={[activeLayer.opacity]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(value) => updateLayer(activeLayer.id, { opacity: value[0] })}
              />
            </div>

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
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Esquema de Cores</Label>
              <Select
                value={activeLayer.colorScheme}
                onValueChange={(value) =>
                  updateLayer(activeLayer.id, { colorScheme: value, isCustomMode: false })
                }
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
                              backgroundColor: `rgb(${Math.round(scheme.color1[0] * 255)}, ${Math.round(scheme.color1[1] * 255)}, ${Math.round(scheme.color1[2] * 255)})`,
                            }}
                          />
                          <div
                            className="w-3 h-3 rounded-full mr-1"
                            style={{
                              backgroundColor: `rgb(${Math.round(scheme.color2[0] * 255)}, ${Math.round(scheme.color2[1] * 255)}, ${Math.round(scheme.color2[2] * 255)})`,
                            }}
                          />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: `rgb(${Math.round(scheme.color3[0] * 255)}, ${Math.round(scheme.color3[1] * 255)}, ${Math.round(scheme.color3[2] * 255)})`,
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">
                  Escala de Ruído: {activeLayer.noiseScale.toFixed(1)}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-gray-400 hover:text-white"
                  onClick={() => updateLayer(activeLayer.id, { seed: generateSeed() })}
                  title="Sortear outra forma para esta camada"
                >
                  <Waves className="h-3.5 w-3.5 mr-1" />
                  Forma
                </Button>
              </div>
              <Slider
                value={[activeLayer.noiseScale]}
                min={0.5}
                max={5.0}
                step={0.1}
                onValueChange={(value) => updateLayer(activeLayer.id, { noiseScale: value[0] })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">
                  Intensidade do Fluxo: {activeLayer.flowIntensity.toFixed(2)}
                </Label>
              </div>
              <Slider
                value={[activeLayer.flowIntensity]}
                min={0.1}
                max={1.0}
                step={0.01}
                onValueChange={(value) =>
                  updateLayer(activeLayer.id, { flowIntensity: value[0] })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
