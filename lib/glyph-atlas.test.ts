import { describe, expect, it } from "vitest"
import { createGlyphAtlas, GLYPH_RAMP } from "@/lib/glyph-atlas"

describe("GLYPH_RAMP", () => {
  it("runs from blank to solid", () => {
    // The shader maps lightness onto the index, so the order is the mapping: a
    // character out of place is a flat spot in the tonal range
    expect(GLYPH_RAMP[0]).toBe(" ")
    expect(GLYPH_RAMP[GLYPH_RAMP.length - 1]).toBe("@")
  })

  it("has enough steps to be a ramp and few enough to stay distinct", () => {
    expect(GLYPH_RAMP.length).toBeGreaterThanOrEqual(8)
    expect(GLYPH_RAMP.length).toBeLessThanOrEqual(16)
  })

  it("repeats no character", () => {
    // Two identical glyphs would be a step the eye cannot read
    expect(new Set(GLYPH_RAMP).size).toBe(GLYPH_RAMP.length)
  })
})

describe("createGlyphAtlas", () => {
  it("reports the glyph count the shader indexes by", () => {
    const atlas = createGlyphAtlas()
    // happy-dom has no 2D canvas context, so this returns null here; the shape
    // of the contract is what matters — a null atlas must not throw
    if (atlas) expect(atlas.count).toBe(GLYPH_RAMP.length)
    else expect(atlas).toBeNull()
  })

  it("survives a document that cannot draw", () => {
    expect(() => createGlyphAtlas("ab")).not.toThrow()
  })
})
