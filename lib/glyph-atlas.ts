import * as THREE from "three"

// The character ramp, built at runtime into a texture the shader can index.
//
// Rasterized here rather than shipped as an image because the ramp is data, not
// artwork: it is a string, and a different string is a different atlas with no
// asset pipeline in between.

// Ordered by how much ink each glyph lays down, sparse to dense. The shader maps
// lightness onto this index, so the order *is* the mapping — a character out of
// place shows up as a flat spot in the tonal range.
export const GLYPH_RAMP = " .:-=+*#%@"

// Size each glyph is rasterized at. The atlas is sampled with linear filtering,
// so this sets how large a cell can get before the glyphs go soft: at 20 columns
// on a 4K export a cell is 192px, which 128 still carries.
const GLYPH_SIZE = 128

export interface GlyphAtlas {
  texture: THREE.Texture
  count: number
}

/**
 * Draws the ramp into a horizontal strip, one glyph per cell, white on black.
 *
 * Returns null where there is no DOM to draw on — the module is imported by the
 * store's type graph and must not assume a browser.
 */
export function createGlyphAtlas(ramp: string = GLYPH_RAMP): GlyphAtlas | null {
  if (typeof document === "undefined") return null

  const canvas = document.createElement("canvas")
  canvas.width = GLYPH_SIZE * ramp.length
  canvas.height = GLYPH_SIZE
  const context = canvas.getContext("2d")
  if (!context) return null

  context.fillStyle = "#000000"
  context.fillRect(0, 0, canvas.width, canvas.height)

  // A monospace stack, and the glyph centred in its cell: the shader indexes
  // cells by position, so anything drawn outside its own cell would bleed into
  // the neighbouring character
  context.fillStyle = "#ffffff"
  context.font = `${Math.floor(GLYPH_SIZE * 0.78)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
  context.textAlign = "center"
  context.textBaseline = "middle"

  for (let index = 0; index < ramp.length; index++) {
    context.fillText(
      ramp[index],
      index * GLYPH_SIZE + GLYPH_SIZE / 2,
      GLYPH_SIZE / 2
    )
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  // Clamped, not wrapped: a glyph sampled a hair past its cell edge should find
  // the edge again, not the far side of the strip
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.needsUpdate = true

  return { texture, count: ramp.length }
}
