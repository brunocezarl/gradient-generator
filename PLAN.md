# Gradient Generator — Roadmap

The original plan (keyboard shortcuts, undo/redo, richer color picker, layer
drag and drop, CSS export, more color stops, randomizer) is done, and three
further passes went in on top of it.

## Shipped

### Render fidelity
- Camera reprojected to the output aspect ratio on export — a 1080×1920 story
  exported from a 16:9 window is no longer squeezed
- Color pipeline: sRGB → linear → interpolation (Oklab or linear) → sRGB, so the
  HEX from the picker is exactly the exported pixel
- Triangular dither at ±0.5 LSB against 8-bit banding
- One GLSL source shared by the single-layer scene and every layer

### Tool behavior
- Artboard at the output ratio with safe area guides; export inherits it
- Timeline with scrubbing, frame stepping and frame freezing, driven by a single
  animation clock outside React
- Seamless loop: a closed circular path through the noise field
- Multi-layer compositing in one WebGL context through render targets, with the
  Compositing and Blending Level 1 formulas in the shader
- Deterministic video export (WebCodecs): exact frame rate and duration,
  independent of GPU performance

### Effects
- Bloom in a progressive-downsample chain, summed in linear light with half-float
  headroom above 1.0, shared by the single-layer scene, the layer compositor and
  the thumbnail renderer
- ASCII over the same chain: a runtime glyph atlas, glyphs chosen by Oklab
  lightness, density set in columns so the export matches the preview

### Color
- OKLCH engine: conversions, gamut clamping on chroma, harmonies, WCAG contrast
- Tone controls: exposure (linear, in stops) plus brightness and contrast on
  Oklab lightness, neutral by default and skipped while neutral
- 2 to 8 color stops with positions
- Palette extraction from a reference image (k-means in Oklab)
- Shader-rendered preset thumbnails and a portable JSON library
- Palette export as design tokens (JSON/CSS/Tailwind/SVG)

## Next

Ideas that came out of the codebase review and have not been built yet:

1. **Curated preset catalog** — the animation presets only touch speed,
   complexity, noise scale and scheme; a signed set of complete looks would sell
   the tool in the first minute.
2. **Batch export — shipped** — Image → Image kit produces a ZIP of square,
   portrait, story, cover/OG and wallpaper images in PNG/JPEG/WebP, with file
   naming, progress, cancellation and a single animation frame across sizes.
3. **PNG with alpha and mask output** — needed to composite the gradient into
   other artwork.
4. **Adaptive resolution scaling** with an FPS target, instead of the current
   fixed per-device pixel ratio.
5. **Golden-image tests in CI** — the `verify` skill already drives headless
   WebGL; turning it into a suite would catch color and composition regressions
   automatically.
6. **Dynamic OG image** rendering the shared gradient, so a pasted link previews
   the actual artwork.
