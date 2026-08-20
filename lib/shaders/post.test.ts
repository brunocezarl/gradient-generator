import { describe, expect, it } from "vitest"
import {
  colorSpaceChunk,
  createGradientUniforms,
  ditherChunk,
  organicGradientFragmentShader,
  simplexNoiseChunk,
} from "@/lib/shaders/organic-gradient"
import { asciiResolveFragmentShader, resolveFragmentShader } from "@/lib/shaders/post"

// The gradient shader and the chain's resolve pass both finish an image, and
// they have to finish it the same way. These guard the single-source property
// the shader file exists to hold: a copy of the sRGB encode drifting between the
// two ends is exactly the bug that would make bloom-on and bloom-off render
// different colors.
describe("shared GLSL chunks", () => {
  it("puts one definition of each conversion in both shaders", () => {
    for (const chunk of [colorSpaceChunk, ditherChunk]) {
      for (const shader of [organicGradientFragmentShader, resolveFragmentShader, asciiResolveFragmentShader]) {
        expect(shader).toContain(chunk.trim())
      }
    }
    expect(organicGradientFragmentShader).toContain(simplexNoiseChunk.trim())
    // Grain is simplex noise, so the resolve pass needs it too
    expect(resolveFragmentShader).toContain(simplexNoiseChunk.trim())
  })

  it("defines each shared function exactly once per shader", () => {
    const count = (source: string, needle: string) => source.split(needle).length - 1
    for (const shader of [
      organicGradientFragmentShader,
      resolveFragmentShader,
      asciiResolveFragmentShader,
    ]) {
      expect(count(shader, "vec3 linearToSrgb(")).toBe(1)
      expect(count(shader, "float snoise(")).toBe(1)
      expect(count(shader, "float triangularDither(")).toBe(1)
    }
  })

  it("finishes the image in the same order at both ends", () => {
    // encode → grain → dither. A different order is a different picture: grain
    // added before the encode would be shaped by the transfer curve.
    for (const shader of [
      organicGradientFragmentShader,
      resolveFragmentShader,
      asciiResolveFragmentShader,
    ]) {
      const encode = shader.lastIndexOf("color = linearToSrgb(color)")
      const grain = shader.indexOf("uGrainScale) * uGrainAmount")
      const dither = shader.indexOf("triangularDither(gl_FragCoord.xy)")
      expect(encode).toBeGreaterThan(-1)
      expect(grain).toBeGreaterThan(encode)
      expect(dither).toBeGreaterThan(grain)
    }
  })
})

describe("gradient shader linear output", () => {
  it("leaves before the encode when it feeds a chain", () => {
    const branch = organicGradientFragmentShader.indexOf("if (uOutputLinear > 0.5)")
    const encode = organicGradientFragmentShader.lastIndexOf("color = linearToSrgb(color)")
    expect(branch).toBeGreaterThan(-1)
    // The early return has to come first, or the chain would receive an encoded,
    // clamped image and bloom would have no headroom to feed on
    expect(branch).toBeLessThan(encode)
  })
})

describe("createGradientUniforms", () => {
  // The uniform list used to be written out by hand in two places, and a uniform
  // added to the shader but missed in one of them threw only once something
  // reached that code path — a saved preset drawing a thumbnail, in the case
  // that got through. Reading the names out of the GLSL closes that gap.
  const declared = [
    ...organicGradientFragmentShader.matchAll(/uniform\s+\w+\s+(u\w+)/g),
  ].map((match) => match[1])

  it("covers every uniform the shader declares", () => {
    const provided = createGradientUniforms()
    expect(declared.length).toBeGreaterThan(10)
    for (const name of declared) {
      expect(provided, `missing uniform ${name}`).toHaveProperty(name)
    }
  })

  it("provides nothing the shader does not declare", () => {
    for (const name of Object.keys(createGradientUniforms())) {
      expect(declared, `unused uniform ${name}`).toContain(name)
    }
  })

  it("hands out fresh objects, not a shared one", () => {
    // Two materials sharing a uniform object would move together — every
    // thumbnail in the gallery would show the last one rendered
    const a = createGradientUniforms()
    const b = createGradientUniforms()
    a.uComplexity.value = 9
    expect(b.uComplexity.value).not.toBe(9)
  })
})

describe("ascii resolve pass", () => {
  it("sizes cells from the column count, never from a pixel value", () => {
    // A cell fixed in pixels would give a 4K export four times the characters
    // the designer composed with, which is a different picture
    expect(asciiResolveFragmentShader).toContain("uResolution.x / uColumns")
  })

  it("picks the glyph by Oklab lightness", () => {
    // Not luminance and not the strongest channel: on the strongest channel a
    // saturated red and a saturated blue score the same and the grid comes out
    // at flat density
    expect(asciiResolveFragmentShader).toContain("linearToOklab(cellColor).x")
  })

  it("averages the cell rather than sampling its centre", () => {
    // One tap per cell makes the character flicker as the noise field drifts
    expect(asciiResolveFragmentShader).toContain("sum * 0.25")
  })
})
