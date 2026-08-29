"use client"

import { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { rgbToHex, hexToRgb, rgbToHsl, hslToRgb } from "@/lib/utils"
import { maxChroma, oklchToSrgb, srgbToOklch } from "@/lib/oklch"

interface ColorPickerProps {
  label: string
  color: [number, number, number]
  onChange: (color: [number, number, number]) => void
}

type Mode = "rgb" | "hsl" | "oklch"

export function ColorPicker({ label, color, onChange }: ColorPickerProps) {
  const toR = () => Math.round(color[0] * 255)
  const toG = () => Math.round(color[1] * 255)
  const toB = () => Math.round(color[2] * 255)

  const [r, setR] = useState(toR)
  const [g, setG] = useState(toG)
  const [b, setB] = useState(toB)
  const [mode, setMode] = useState<Mode>("oklch")
  const [hexInput, setHexInput] = useState(() => rgbToHex(toR(), toG(), toB()))
  const [hexError, setHexError] = useState(false)

  // Keep in sync with the external prop
  useEffect(() => {
    const nr = toR()
    const ng = toG()
    const nb = toB()
    setR(nr)
    setG(ng)
    setB(nb)
    setHexInput(rgbToHex(nr, ng, nb))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  const emitRgb = useCallback(
    (red: number, green: number, blue: number) => {
      onChange([red / 255, green / 255, blue / 255])
    },
    [onChange]
  )

  // ─── RGB handlers ─────────────────────────────────────────────────────────

  const handleRgbChange = (red: number, green: number, blue: number) => {
    setR(red)
    setG(green)
    setB(blue)
    setHexInput(rgbToHex(red, green, blue))
    setHexError(false)
    emitRgb(red, green, blue)
  }

  // ─── HSL handlers ─────────────────────────────────────────────────────────

  const [hsl, setHsl] = useState<[number, number, number]>(() =>
    rgbToHsl(toR(), toG(), toB())
  )

  useEffect(() => {
    setHsl(rgbToHsl(toR(), toG(), toB()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  const handleHslChange = (h: number, s: number, l: number) => {
    const [nr, ng, nb] = hslToRgb(h, s, l)
    setHsl([h, s, l])
    setR(nr)
    setG(ng)
    setB(nb)
    setHexInput(rgbToHex(nr, ng, nb))
    setHexError(false)
    emitRgb(nr, ng, nb)
  }

  // ─── OKLCH handlers ───────────────────────────────────────────────────────
  // Adjusting lightness or chroma in OKLCH does not shift the hue, unlike HSL:
  // lightening a red in HSL pulls it toward pink, here it stays red.

  const [oklch, setOklch] = useState(() => srgbToOklch(color))

  useEffect(() => {
    setOklch(srgbToOklch(color))
  }, [color])

  const handleOklchChange = (l: number, c: number, h: number) => {
    const next = { l, c, h }
    const [nr, ng, nb] = oklchToSrgb(next).map((channel) => Math.round(channel * 255))
    setOklch(next)
    setR(nr)
    setG(ng)
    setB(nb)
    setHsl(rgbToHsl(nr, ng, nb))
    setHexInput(rgbToHex(nr, ng, nb))
    setHexError(false)
    emitRgb(nr, ng, nb)
  }

  // ─── HEX handler ──────────────────────────────────────────────────────────

  const handleHexChange = (value: string) => {
    setHexInput(value)
    const parsed = hexToRgb(value)
    if (parsed) {
      const [nr, ng, nb] = parsed
      setR(nr)
      setG(ng)
      setB(nb)
      setHsl(rgbToHsl(nr, ng, nb))
      setOklch(srgbToOklch([nr / 255, ng / 255, nb / 255]))
      setHexError(false)
      emitRgb(nr, ng, nb)
    } else {
      setHexError(true)
    }
  }

  const hexColor = rgbToHex(r, g, b)

  return (
    <div className="space-y-3">
      {/* Header: label + preview + mode toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-white">{label}</Label>
        <div className="flex items-center gap-2">
          {/* OKLCH / RGB / HSL toggle */}
          <div className="flex rounded-md overflow-hidden border border-white/10 text-xs">
            {(["oklch", "rgb", "hsl"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                  mode === option
                    ? "bg-neutral-600 text-white"
                    : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                }`}
                onClick={() => setMode(option)}
              >
                {option === "oklch" ? "OKLCH" : option.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Preview */}
          <div
            className="w-7 h-7 rounded-full ring-1 ring-inset ring-white/20 flex-shrink-0"
            style={{ backgroundColor: hexColor }}
          />
        </div>
      </div>

      {/* HEX input */}
      <div>
        <Input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#rrggbb"
          className={`bg-neutral-900 border-neutral-700 text-white font-mono text-sm h-8 ${
            hexError ? "border-red-500" : ""
          }`}
          maxLength={7}
        />
      </div>

      {/* OKLCH sliders */}
      {mode === "oklch" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-neutral-400">L (lightness)</Label>
              <span className="text-xs text-neutral-400">{Math.round(oklch.l * 100)}%</span>
            </div>
            <Slider
              value={[oklch.l * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(val) => handleOklchChange(val[0] / 100, oklch.c, oklch.h)}
              className="h-2"
              thumbLabel={`${label}: lightness`}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-neutral-400">C (chroma)</Label>
              <span className="text-xs text-neutral-400">{oklch.c.toFixed(3)}</span>
            </div>
            <Slider
              value={[oklch.c]}
              min={0}
              // Real chroma ceiling for this lightness and hue: above it the color
              // does not exist in sRGB and the slider would be lying
              max={Math.max(maxChroma(oklch.l, oklch.h), 0.01)}
              step={0.002}
              onValueChange={(val) => handleOklchChange(oklch.l, val[0], oklch.h)}
              className="h-2"
              thumbLabel={`${label}: chroma`}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-neutral-400">H (hue)</Label>
              <span className="text-xs text-neutral-400">{Math.round(oklch.h)}°</span>
            </div>
            <Slider
              value={[oklch.h]}
              min={0}
              max={360}
              step={1}
              onValueChange={(val) => handleOklchChange(oklch.l, oklch.c, val[0])}
              className="h-2"
              thumbLabel={`${label}: hue`}
            />
          </div>
        </div>
      )}

      {/* RGB sliders */}
      {mode === "rgb" && (
        <div className="space-y-3">
          {(
            [
              { label: "R", value: r, onChange: (v: number) => handleRgbChange(v, g, b), color: "rgb(220,50,50)" },
              { label: "G", value: g, onChange: (v: number) => handleRgbChange(r, v, b), color: "rgb(50,200,50)" },
              { label: "B", value: b, onChange: (v: number) => handleRgbChange(r, g, v), color: "rgb(50,100,220)" },
            ] as const
          ).map(({ label: ch, value, onChange: onCh }) => (
            <div key={ch} className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs text-neutral-400">{ch}</Label>
                <span className="text-xs text-neutral-400">{value}</span>
              </div>
              <Slider
                value={[value]}
                min={0}
                max={255}
                step={1}
                onValueChange={(val) => onCh(val[0])}
                className="h-2"
              />
            </div>
          ))}
        </div>
      )}

      {/* HSL sliders */}
      {mode === "hsl" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-neutral-400">H (hue)</Label>
              <span className="text-xs text-neutral-400">{hsl[0]}°</span>
            </div>
            <Slider
              value={[hsl[0]]}
              min={0}
              max={360}
              step={1}
              onValueChange={(val) => handleHslChange(val[0], hsl[1], hsl[2])}
              className="h-2"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-neutral-400">S (saturation)</Label>
              <span className="text-xs text-neutral-400">{hsl[1]}%</span>
            </div>
            <Slider
              value={[hsl[1]]}
              min={0}
              max={100}
              step={1}
              onValueChange={(val) => handleHslChange(hsl[0], val[0], hsl[2])}
              className="h-2"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs text-neutral-400">L (lightness)</Label>
              <span className="text-xs text-neutral-400">{hsl[2]}%</span>
            </div>
            <Slider
              value={[hsl[2]]}
              min={0}
              max={100}
              step={1}
              onValueChange={(val) => handleHslChange(hsl[0], hsl[1], val[0])}
              className="h-2"
            />
          </div>
        </div>
      )}
    </div>
  )
}
