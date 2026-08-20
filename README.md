# Gradient Generator

Animated organic gradients in WebGL, built for brand systems, backgrounds and
visual content. The animation comes from a GLSL shader with simplex and curl
noise, rendered through React Three Fiber.

## Features

- **Artboard at the output ratio** (Full HD, 4K, 4:3, story, 4:5 post, Open
  Graph, A4…) with safe area guides: the preview shows the real framing and the
  export inherits those dimensions. Ratio chips (Free, 16:9, 1:1, 4:3, 9:16)
  make the framing one click, and the full list keeps the exact pixel sizes —
  picking 4K leaves the 16:9 chip lit, because it is the same framing
- **Timeline** with scrubbing, frame-by-frame stepping and frame freezing — the
  instant of the animation is a visible, reproducible value
- **Seamless loop**: with a period set, the animation travels a closed path
  through the noise field and returns exactly to the start
- **Real-time animation** with controls for speed, complexity, noise scale,
  flow, grain and shape thresholds
- **Faithful color**: stops are interpolated in Oklab (perceptual) or linear RGB,
  with sRGB encoding on output — the HEX picked in the picker is exactly the
  exported pixel. Sub-quantization triangular dither removes the banding smooth
  8-bit gradients always produce
- **2 to 8 color stops**, each with its own position along the gradient, set by
  slider or typed as a percentage
- **Color picker in OKLCH**, RGB, HSL or HEX: adjusting lightness or chroma in
  OKLCH does not shift the hue (lightening a red in HSL pulls it toward pink),
  and the chroma slider respects the real sRGB ceiling for that color
- **Bloom**: light spilling past what emitted it, summed in linear space on
  unclamped values — raise exposure and the same intensity glows harder, because
  the bright end really is brighter. Threshold, intensity and spread; off by
  default, and off means the gradient draws straight to the screen with nothing
  in the way
- **Tone controls**: exposure in stops (a linear multiply, the way a camera
  works), plus brightness and contrast acting on Oklab lightness — moving L
  leaves hue and chroma where the picker put them, unlike scaling RGB channels,
  which turns a brightened red into orange. All neutral by default, and the
  shader skips the whole path while they are, so an untouched gradient is still
  bit for bit the colors you picked
- **Harmonies** (analogous, complementary, split complementary, triadic,
  monochromatic) derived from the first stop, keeping the positions
- **Palette extracted from a reference image**, clustered in Oklab
- **WCAG contrast** for white and black text, worst case along the gradient
- **Color schemes** out of the box, plus a custom mode that saves your own
- **Reproducible shape**: the noise field *seed* travels in presets, history and
  links — "Roll Shape" changes the drawing while keeping colors and rhythm
- **Multi-layer** in a single WebGL context: each layer renders into a render
  target and blending happens in the shader (the Compositing and Blending Level
  1 formulas), with drag-and-drop reordering. Motion and finishing come from
  global state; each layer owns its shape
- **Animation presets** and a randomizer with a **history of recent rolls**
  (click a thumbnail to bring a good result back)
- **Full presets** saved by the user: colors plus every animation parameter,
  with a gallery of **shader-rendered thumbnails** (two configurations with the
  same colors and different shapes look different) and a **portable library** in
  JSON (export/import)
- **Undo/redo** (Ctrl+Z / Ctrl+Y) with coalescing of continuous edits, covering
  creating, removing, editing and reordering layers as well
- **Export**: image (PNG/JPEG/WebP) at the current artboard, at a ready-made
  size or scaled up to 8×; deterministic video (MP4/H.264 or WebM/VP9) rendered
  frame by frame with explicit timestamps — exact frame rate and duration,
  independent of GPU performance — and **palette tokens** (design tokens JSON
  with OKLCH, CSS custom properties, Tailwind config and SVG)
- **Sharing** through a compact URL that reproduces the whole gradient,
  including advanced parameters (flow, grain, thresholds) and layers
- **Keyboard shortcuts**: `Space` play/pause, `R` reset, `S` save image,
  `F` full screen (clean preview)

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) / Three.js for the
  WebGL shader
- [Zustand](https://zustand.docs.pmnd.rs) (persisted to `localStorage`)
- [Tailwind CSS](https://tailwindcss.com) with
  [shadcn/ui](https://ui.shadcn.com) (Radix UI) components
- [dnd-kit](https://dndkit.com) for layer reordering
- [mediabunny](https://mediabunny.dev) + WebCodecs for video export

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build (includes type checking)
npm run start      # serve the production build
npm run lint       # lint
npm test           # unit tests (Vitest)
```

## Structure

```
app/          # routes and layout (App Router)
components/   # application components + components/ui (shadcn)
hooks/        # hooks (keyboard shortcuts, fullscreen, device optimizations)
lib/          # Zustand store, presets, color, capture and sharing
              # (color-stops, oklch, palette-extract, tokens, library)
lib/shaders/  # single source of the GLSL (gradient + layer compositing)
```

## Implementation notes

- **Color pipeline**: colors leave the picker in sRGB, are converted to linear in
  `lib/color.ts`, interpolated in the chosen space (Oklab or linear) and encoded
  back to sRGB at the end of the fragment shader. Vibrance defaults to 0 so the
  round trip stays exact; the exported CSS uses `in oklab` / `in srgb-linear` to
  interpolate in the same space as the render.
- **Export**: each layer is re-rendered natively at the final resolution and the
  camera is reprojected to the output aspect ratio, so exporting 1080×1920 from a
  16:9 window produces the same image as viewing the scene in a 9:16 window — no
  distortion, no upscaling.
- **Persistence**: the store is versioned (`PERSIST_VERSION`) and normalized on
  hydration. Since zustand only calls `migrate` when the stored JSON has a
  numeric `version`, normalization runs in `merge`, which always executes.
- **Post-processing**: with an effect on, the gradient stops encoding and hands
  the chain raw linear light (`uOutputLinear`); the sRGB encode, grain and dither
  move to the far end, in the resolve pass. Bloom has to sum energy rather than
  encoded values, and grain blurred into a halo would be grain no longer. Both
  ends share one copy of the conversions (`colorSpaceChunk`, `simplexNoiseChunk`,
  `ditherChunk`), so the two paths cannot drift. The chain is a
  progressive-downsample pyramid — bright pass at half size, five levels down,
  summed back on the way up — and the resolve pass draws the gradient's own plane
  through the gradient's own camera, so grain lands in the same place with the
  chain running as without it (measured: one 8-bit step of difference, the
  half-float round trip). Its bright pass gates on the strongest channel rather
  than on Rec.709 luminance: a saturated blue scores 0.06 in luminance against a
  mid gray's 0.22, so a luminance gate would let dull grays glow while vivid
  blues never could. With the effect off the chain is not mounted at all, which
  is why the untouched path still exports pixels identical to the build from
  before any of it existed.
- **Tone**: exposure multiplies in linear space before the sRGB encode — the
  physical meaning of a stop of light. Brightness and contrast instead convert to
  Oklab and move `L` alone (contrast pivots at `L = 0.5`, the middle of the
  lightness axis), so hue and chroma survive; measured on in-gamut colors, hue
  moves under 2°, which is 8-bit quantization rather than the maths. Pushing a
  saturated color past the sRGB ceiling still clips, and clipping desaturates —
  that is the gamut, not the transform. The Oklab round trip is skipped entirely
  while brightness is 0 and contrast is 1, so the neutral pipeline is provably a
  no-op: the exported PNG is byte-identical to the build from before the controls
  existed.
- **Controls**: the panel is a set of collapsible sections (Canvas, Adjustments,
  Color, Presets, Shape, Grain, Motion, Layers) rather than tabs — the framing
  and the palette are what a session opens with, and everything else stays
  folded until it is needed. Framing lives in the panel, not the top bar, so the
  ratio sits next to the colors it frames.
- **Time**: the animation clock lives in `lib/playback.ts`, outside React and
  outside the render loop — each canvas used to accumulate its own time, which
  made speed in multi-layer mode depend on how many layers were visible. The
  exporter drives that clock: every frame is drawn at an exact instant.
- **Loop**: with `loopDuration > 0` the shader swaps linear drift for a circular
  path through the noise field (`theta = 2π·t/T`), periodic by construction. The
  frame that would close the cycle is identical to the first one and is therefore
  not recorded — avoiding a duplicated frame at the seam.
- **Color stops**: the shader receives arrays of up to 8 stops (linear colors +
  positions). Sorting happens when writing the uniforms, not in state:
  re-sorting the list mid-drag would make the slider jump to another stop under
  the user's cursor, while the shader needs ascending positions.
- **OKLCH**: `lib/oklch.ts` handles the conversions, gamut clamping by binary
  search on chroma (preserving hue and lightness), the harmonies and WCAG
  contrast. The randomizer draws on those axes — drawing R, G and B
  independently almost always produces desaturated, unrelated colors.
