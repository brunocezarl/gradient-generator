// Artboards: the aspect ratio the gradient is composed and exported in.
//
// The preview used to be the whole window, with the output ratio showing up
// only in the export dialog — the designer discovered the framing after
// downloading the file. With an artboard, what is on screen is what ships.

export interface Artboard {
  id: string
  label: string
  // 0 × 0 = follows the available area (free mode)
  width: number
  height: number
  group: string
}

export const artboards: Artboard[] = [
  { id: "free", label: "Free (available area)", width: 0, height: 0, group: "Free" },
  { id: "fullhd", label: "Full HD · 1920×1080", width: 1920, height: 1080, group: "Screen" },
  { id: "qhd", label: "QHD · 2560×1440", width: 2560, height: 1440, group: "Screen" },
  { id: "uhd4k", label: "4K · 3840×2160", width: 3840, height: 2160, group: "Screen" },
  { id: "classic43", label: "4:3 · 2048×1536", width: 2048, height: 1536, group: "Screen" },
  { id: "square", label: "Square post · 1080×1080", width: 1080, height: 1080, group: "Social" },
  { id: "portrait45", label: "Portrait 4:5 · 1080×1350", width: 1080, height: 1350, group: "Social" },
  { id: "story", label: "Story / Reels · 1080×1920", width: 1080, height: 1920, group: "Social" },
  { id: "og", label: "Open Graph · 1200×630", width: 1200, height: 630, group: "Social" },
  { id: "a4", label: "A4 at 300dpi · 2480×3508", width: 2480, height: 3508, group: "Print" },
]

export const defaultArtboardId = "free"

export function getArtboard(id: string): Artboard {
  return artboards.find((artboard) => artboard.id === id) ?? artboards[0]
}

export function isFreeArtboard(artboard: Artboard): boolean {
  return artboard.width <= 0 || artboard.height <= 0
}

export function artboardAspect(artboard: Artboard): number | null {
  return isFreeArtboard(artboard) ? null : artboard.width / artboard.height
}

// Safe area used as a composition guide: an inset proportional to the shorter
// side, roughly covering what story UIs overlay
export const SAFE_AREA_INSET = 0.06

// ─── Quick ratios ────────────────────────────────────────────────────────────
//
// The framing decision comes before the pixel dimensions: a designer picks
// "story" or "square" long before caring whether it ships at 1080 or 4K. The
// chips make that first choice one click; the full list keeps the exact sizes.

export interface RatioChip {
  // Artboard the chip selects
  id: string
  // Ratio as it is spoken, not as it is measured
  label: string
}

export const ratioChips: RatioChip[] = [
  { id: "free", label: "Free" },
  { id: "fullhd", label: "16:9" },
  { id: "square", label: "1:1" },
  { id: "classic43", label: "4:3" },
  { id: "story", label: "9:16" },
]

// Aspect ratios are compared, not ids: 4K and Full HD are both 16:9, and the
// chip should not go dark just because a bigger size of the same framing was
// picked from the list.
const RATIO_EPSILON = 1e-3

export function sameAspect(a: Artboard, b: Artboard): boolean {
  const aspectA = artboardAspect(a)
  const aspectB = artboardAspect(b)
  // Free has no ratio to compare — it only ever matches free
  if (aspectA === null || aspectB === null) return aspectA === aspectB
  return Math.abs(aspectA - aspectB) < RATIO_EPSILON
}

// The chip to light up for the current artboard, or null when the artboard has
// a framing no chip covers (4:5, Open Graph, A4)
export function activeRatioChip(artboardId: string): string | null {
  const current = getArtboard(artboardId)
  const chip = ratioChips.find((candidate) => sameAspect(getArtboard(candidate.id), current))
  return chip ? chip.id : null
}
