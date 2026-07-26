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
import { StopDots } from "@/components/gradient-swatch"
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

// ─── Draggable layer item ──────────────────────────────────────────────────

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
        isActive ? "bg-neutral-700" : "bg-neutral-900 hover:bg-neutral-800"
      }`}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-neutral-500 hover:text-neutral-300 mr-1 touch-none"
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* Visibility toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-neutral-400 hover:text-white"
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisibility()
        }}
        title={layer.visible ? "Hide layer" : "Show layer"}
        aria-label={layer.visible ? "Hide layer" : "Show layer"}
      >
        {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </Button>

      <div className="flex-1 mx-2 truncate">
        <span className="text-sm text-white">Layer {index + 1}</span>
      </div>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-neutral-400 hover:text-red-500"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        disabled={!canRemove}
        title="Remove layer"
        aria-label="Remove layer"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

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
      <div className="mt-4 pt-4 border-t border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Layers className="h-4 w-4 mr-2 text-neutral-400" />
            <Label className="text-white">Multi-layer Mode</Label>
            <TooltipHelp content="Turn on to build and manage several gradient layers." />
          </div>
          <Switch checked={multiLayerMode} onCheckedChange={setMultiLayerMode} />
        </div>
      </div>
    )
  }

  const activeLayer = layers.find((layer) => layer.id === activeLayerId) || layers[0]

  return (
    <div className="mt-4 pt-4 border-t border-neutral-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Layers className="h-4 w-4 mr-2 text-neutral-400" />
          <Label className="text-white">Multi-layer Mode</Label>
          <TooltipHelp content="Turn off to go back to a single layer." />
        </div>
        <Switch checked={multiLayerMode} onCheckedChange={setMultiLayerMode} />
      </div>

      <div className="space-y-4">
        {/* Layer list with drag and drop */}
        <div className="bg-neutral-800 rounded-md p-2">
          <div className="flex justify-between items-center mb-2">
            <Label className="text-white">Layers</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-neutral-400 hover:text-white"
              onClick={addLayer}
              title="Add layer"
              aria-label="Add layer"
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

        {/* Active layer settings */}
        {activeLayer && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">Layer Settings</h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">
                  Opacity: {Math.round(activeLayer.opacity * 100)}%
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
              <Label className="text-white">Blend Mode</Label>
              <Select
                value={activeLayer.blendMode}
                onValueChange={(value) => updateLayer(activeLayer.id, { blendMode: value })}
              >
                <SelectTrigger className="bg-neutral-900 border-neutral-700 text-white">
                  <SelectValue placeholder="Pick a blend mode" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                  {Object.entries(blendModes).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Color Scheme</Label>
              <Select
                value={activeLayer.colorScheme}
                onValueChange={(value) =>
                  updateLayer(activeLayer.id, { colorScheme: value, isCustomMode: false })
                }
              >
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">
                  Noise Scale: {activeLayer.noiseScale.toFixed(1)}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-neutral-400 hover:text-white"
                  onClick={() => updateLayer(activeLayer.id, { seed: generateSeed() })}
                  title="Roll another shape for this layer"
                >
                  <Waves className="h-3.5 w-3.5 mr-1" />
                  Shape
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
                  Flow Intensity: {activeLayer.flowIntensity.toFixed(2)}
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
