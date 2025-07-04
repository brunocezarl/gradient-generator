"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

interface ColorPickerProps {
  label: string
  color: [number, number, number]
  onChange: (color: [number, number, number]) => void
}

export function ColorPicker({ label, color, onChange }: ColorPickerProps) {
  const [r, setR] = useState(Math.round(color[0] * 255))
  const [g, setG] = useState(Math.round(color[1] * 255))
  const [b, setB] = useState(Math.round(color[2] * 255))
  
  // Update local state when color prop changes
  useEffect(() => {
    setR(Math.round(color[0] * 255))
    setG(Math.round(color[1] * 255))
    setB(Math.round(color[2] * 255))
  }, [color])
  
  // Convert RGB to hex for preview
  const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  
  // Update parent component when sliders change
  const updateColor = (red: number, green: number, blue: number) => {
    onChange([red / 255, green / 255, blue / 255])
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-white">{label}</Label>
        <div 
          className="w-8 h-8 rounded-full border border-gray-600" 
          style={{ backgroundColor: hexColor }}
        />
      </div>
      
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs text-gray-400">R</Label>
            <span className="text-xs text-gray-400">{r}</span>
          </div>
          <Slider 
            value={[r]} 
            min={0} 
            max={255} 
            step={1} 
            onValueChange={(value) => {
              setR(value[0])
              updateColor(value[0], g, b)
            }}
            className="h-2"
          />
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs text-gray-400">G</Label>
            <span className="text-xs text-gray-400">{g}</span>
          </div>
          <Slider 
            value={[g]} 
            min={0} 
            max={255} 
            step={1} 
            onValueChange={(value) => {
              setG(value[0])
              updateColor(r, value[0], b)
            }}
            className="h-2"
          />
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs text-gray-400">B</Label>
            <span className="text-xs text-gray-400">{b}</span>
          </div>
          <Slider 
            value={[b]} 
            min={0} 
            max={255} 
            step={1} 
            onValueChange={(value) => {
              setB(value[0])
              updateColor(r, g, value[0])
            }}
            className="h-2"
          />
        </div>
      </div>
    </div>
  )
}
