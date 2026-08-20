import { describe, expect, it } from "vitest"
import {
  activeRatioChip,
  artboardAspect,
  artboards,
  getArtboard,
  isFreeArtboard,
  ratioChips,
  sameAspect,
} from "@/lib/artboards"

describe("getArtboard", () => {
  it("returns the artboard with the given id", () => {
    expect(getArtboard("story").width).toBe(1080)
    expect(getArtboard("story").height).toBe(1920)
  })

  it("falls back to the first artboard for an unknown id", () => {
    expect(getArtboard("does-not-exist")).toBe(artboards[0])
  })
})

describe("artboardAspect", () => {
  it("is null in free mode, where the available area decides", () => {
    expect(artboardAspect(getArtboard("free"))).toBeNull()
    expect(isFreeArtboard(getArtboard("free"))).toBe(true)
  })

  it("comes from the dimensions", () => {
    expect(artboardAspect(getArtboard("classic43"))).toBeCloseTo(4 / 3, 5)
    expect(artboardAspect(getArtboard("story"))).toBeCloseTo(9 / 16, 5)
  })
})

describe("sameAspect", () => {
  it("matches different sizes of the same framing", () => {
    expect(sameAspect(getArtboard("fullhd"), getArtboard("uhd4k"))).toBe(true)
    expect(sameAspect(getArtboard("fullhd"), getArtboard("qhd"))).toBe(true)
  })

  it("separates framings that are close but not equal", () => {
    // 4:5 (0.8) against 9:16 (0.5625)
    expect(sameAspect(getArtboard("portrait45"), getArtboard("story"))).toBe(false)
  })

  it("only ever matches free with free", () => {
    expect(sameAspect(getArtboard("free"), getArtboard("free"))).toBe(true)
    expect(sameAspect(getArtboard("free"), getArtboard("square"))).toBe(false)
  })
})

describe("activeRatioChip", () => {
  it("lights the chip for its own artboard", () => {
    for (const chip of ratioChips) {
      expect(activeRatioChip(chip.id)).toBe(chip.id)
    }
  })

  it("keeps the 16:9 chip lit for a bigger size of the same framing", () => {
    expect(activeRatioChip("uhd4k")).toBe("fullhd")
    expect(activeRatioChip("qhd")).toBe("fullhd")
  })

  it("lights nothing for a framing no chip covers", () => {
    expect(activeRatioChip("portrait45")).toBeNull()
    expect(activeRatioChip("og")).toBeNull()
    expect(activeRatioChip("a4")).toBeNull()
  })

  it("every chip points at an artboard that exists", () => {
    for (const chip of ratioChips) {
      expect(artboards.some((artboard) => artboard.id === chip.id)).toBe(true)
    }
  })
})
