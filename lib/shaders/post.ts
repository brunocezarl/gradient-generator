// Post-processing chain.
//
// Bloom is light spilling past the edges of what emitted it, so it has to be
// summed in linear space, on unclamped values: a core at 3.0 has to spill three
// times as hard as one at 1.0, and once the image is encoded to sRGB and clamped
// that difference is gone. The gradient therefore hands this chain raw linear
// light (`uOutputLinear` in lib/shaders/organic-gradient.ts) and the finishing —
// sRGB encode, grain, dither — happens at the far end, in `bloomResolve`.
//
// The chain is the progressive-downsample kind: a bright pass at half size, then
// a pyramid of ever smaller blurred levels, added back on the way up. A single
// wide Gaussian at one size would need a huge tap count for the same spread and
// would still band; the pyramid gets a smooth, wide falloff out of a handful of
// small filters.

import {
  colorSpaceChunk,
  ditherChunk,
  simplexNoiseChunk,
} from "@/lib/shaders/organic-gradient"

// The intermediate passes only sample textures, so they run on a quad written
// straight in clip space — no camera involved.
export const postVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// The resolve pass is different: it draws the same plane, through the same
// camera, as the gradient itself. Grain is a function of the gradient's own uv,
// and reproducing that mapping from a clip-space quad would need the visible uv
// range threaded through as uniforms. Sharing the geometry gives it for free, so
// grain lands in exactly the same place whether or not the chain is running.
export const resolveVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Isolates what glows. A hard cutoff makes the bloom snap on as a region crosses
// the threshold; the soft knee ramps it in over a band around the threshold, so
// moving the slider fades the halo instead of switching it.
export const brightPassFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uScene;
  uniform float uThreshold;
  uniform float uSoftKnee;

  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(uScene, vUv).rgb;

    // Brightness as the strongest channel, not as Rec.709 luminance.
    //
    // Luminance is the physically correct answer and the wrong one here: it
    // weights green at 0.72 and blue at 0.07, so a fully saturated blue scores
    // 0.06 against a mid gray's 0.22 — gate on that and a vivid blue could never
    // glow while a dull gray would. In a tool whose whole subject is saturated
    // color, the strongest channel is what the eye is calling bright.
    float luma = max(color.r, max(color.g, color.b));

    float knee = uThreshold * uSoftKnee + 1e-5;
    float soft = clamp(luma - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-5);

    // Weight rather than subtract: scaling the color keeps its hue, while
    // subtracting the threshold from each channel would pull the result toward
    // whichever channel was smallest
    float weight = max(soft, luma - uThreshold) / max(luma, 1e-5);

    gl_FragColor = vec4(color * max(weight, 0.0), 1.0);
  }
`

// 13-tap downsample (the filter Jimenez described for Call of Duty). The centre
// cluster is what kills the flicker a plain box filter produces when a small
// bright spot drifts between texels — with an animated noise field, that
// flicker would be the first thing anyone noticed.
export const downsampleFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uSource;
  uniform vec2 uTexelSize; // of the source level

  varying vec2 vUv;

  void main() {
    vec2 t = uTexelSize;

    vec3 a = texture2D(uSource, vUv + vec2(-2.0 * t.x,  2.0 * t.y)).rgb;
    vec3 b = texture2D(uSource, vUv + vec2( 0.0,        2.0 * t.y)).rgb;
    vec3 c = texture2D(uSource, vUv + vec2( 2.0 * t.x,  2.0 * t.y)).rgb;
    vec3 d = texture2D(uSource, vUv + vec2(-2.0 * t.x,  0.0)).rgb;
    vec3 e = texture2D(uSource, vUv).rgb;
    vec3 f = texture2D(uSource, vUv + vec2( 2.0 * t.x,  0.0)).rgb;
    vec3 g = texture2D(uSource, vUv + vec2(-2.0 * t.x, -2.0 * t.y)).rgb;
    vec3 h = texture2D(uSource, vUv + vec2( 0.0,       -2.0 * t.y)).rgb;
    vec3 i = texture2D(uSource, vUv + vec2( 2.0 * t.x, -2.0 * t.y)).rgb;

    vec3 j = texture2D(uSource, vUv + vec2(-t.x,  t.y)).rgb;
    vec3 k = texture2D(uSource, vUv + vec2( t.x,  t.y)).rgb;
    vec3 l = texture2D(uSource, vUv + vec2(-t.x, -t.y)).rgb;
    vec3 m = texture2D(uSource, vUv + vec2( t.x, -t.y)).rgb;

    vec3 result = e * 0.125;
    result += (a + c + g + i) * 0.03125;
    result += (b + d + f + h) * 0.0625;
    result += (j + k + l + m) * 0.125;

    gl_FragColor = vec4(result, 1.0);
  }
`

// 9-tap tent on the way back up. uRadius scales the sample offsets, which is
// what the Spread control moves: wider taps, wider halo, at no extra cost.
export const upsampleFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uSource;
  uniform vec2 uTexelSize; // of the source level
  uniform float uRadius;

  varying vec2 vUv;

  void main() {
    vec2 t = uTexelSize * uRadius;

    vec3 result = texture2D(uSource, vUv + vec2(-t.x,  t.y)).rgb * 1.0;
    result += texture2D(uSource, vUv + vec2( 0.0,   t.y)).rgb * 2.0;
    result += texture2D(uSource, vUv + vec2( t.x,   t.y)).rgb * 1.0;
    result += texture2D(uSource, vUv + vec2(-t.x,   0.0)).rgb * 2.0;
    result += texture2D(uSource, vUv).rgb * 4.0;
    result += texture2D(uSource, vUv + vec2( t.x,   0.0)).rgb * 2.0;
    result += texture2D(uSource, vUv + vec2(-t.x,  -t.y)).rgb * 1.0;
    result += texture2D(uSource, vUv + vec2( 0.0,  -t.y)).rgb * 2.0;
    result += texture2D(uSource, vUv + vec2( t.x,  -t.y)).rgb * 1.0;

    gl_FragColor = vec4(result / 16.0, 1.0);
  }
`

// Where the image finally becomes pixels: the halo is added to the scene in
// linear light, and only then does the picture leave linear space, pick up grain
// and get dithered — the same three steps, in the same order, that the gradient
// shader performs when it draws straight to the screen.
export const resolveFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform float uIntensity;
  uniform float uGrainAmount;
  uniform float uGrainScale;
  uniform vec2 uSeed;
  uniform vec2 uResolution;
  // 1.0 = the scene texture holds sRGB, not linear light. The layer compositor
  // blends with the Compositing and Blending Level 1 formulas, which are defined
  // on encoded values, so its result arrives already encoded and has to be
  // decoded before the halo can be summed against it.
  uniform float uSceneIsSrgb;

  varying vec2 vUv;

  ${colorSpaceChunk}

  ${simplexNoiseChunk}

  ${ditherChunk}

  vec3 srgbToLinear(vec3 c) {
    c = max(c, vec3(0.0));
    vec3 low = c / 12.92;
    vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(high, low, step(c, vec3(0.04045)));
  }

  void main() {
    // The scene is sampled by screen position, not by vUv: this pass rides the
    // gradient's own geometry so vUv keeps the gradient's meaning, and the
    // render targets are the size of the drawing buffer.
    vec2 screenUv = gl_FragCoord.xy / uResolution;

    vec3 scene = texture2D(uScene, screenUv).rgb;
    if (uSceneIsSrgb > 0.5) scene = srgbToLinear(scene);

    vec3 bloom = texture2D(uBloom, screenUv).rgb;

    vec3 color = scene + bloom * uIntensity;

    vec2 noiseUv = vUv + uSeed;
    color = linearToSrgb(color);
    color += snoise(noiseUv * uGrainScale) * uGrainAmount;
    color += triangularDither(gl_FragCoord.xy) / 255.0;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

// The ASCII resolve pass: the image redrawn as a grid of characters.
//
// Density comes from Oklab lightness, not from luminance or from the strongest
// channel — a different question from the one the bright pass above asks, so a
// different answer. Bloom asks "is this emitting light?", and a saturated red
// and a saturated blue both are, which is why the strongest channel suits it.
// ASCII asks "how light does this look?", where those two differ: on the
// strongest channel they score identically (0.79 each) and a red-to-blue
// gradient would come out at flat density with no structure at all, while
// luminance crushes both into the bottom fifth of the range. Oklab lightness
// separates them (0.59 against 0.42) and spreads the palette across the ramp.
export const asciiResolveFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uGlyphs;
  uniform float uGlyphCount;
  uniform float uColumns;
  // How much of the source shows through behind the characters. At 0 the glyphs
  // sit on black and the composition is only legible through them; a little
  // light keeps the gradient readable underneath.
  uniform float uBackground;
  // Gain on lightness before it picks a character. Without it the ramp goes
  // mostly unused: a gradient of saturated colors lives between roughly 0.4 and
  // 0.6 in Oklab lightness, which is two glyphs out of ten, so the sparse and
  // dense ends of the ramp would never be reached.
  uniform float uRampContrast;
  uniform float uGrainAmount;
  uniform float uGrainScale;
  uniform vec2 uSeed;
  uniform vec2 uResolution;
  uniform float uSceneIsSrgb;

  varying vec2 vUv;

  ${colorSpaceChunk}

  ${simplexNoiseChunk}

  ${ditherChunk}

  vec3 srgbToLinear(vec3 c) {
    c = max(c, vec3(0.0));
    vec3 low = c / 12.92;
    vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(high, low, step(c, vec3(0.04045)));
  }

  void main() {
    // Square cells, sized from the column count rather than from a pixel value:
    // the same setting has to give the same picture on a 400px preview and a 4K
    // export, and a cell fixed in pixels would give the export four times the
    // characters the designer composed with.
    float cell = uResolution.x / uColumns;
    vec2 cellIndex = floor(gl_FragCoord.xy / cell);

    // Four taps across the cell rather than one at its centre: a single sample
    // makes the character flicker as the noise field drifts under it, since one
    // texel decides the whole cell
    vec3 sum = vec3(0.0);
    for (int x = 0; x < 2; x++) {
      for (int y = 0; y < 2; y++) {
        vec2 offset = vec2(float(x), float(y)) * 0.5 + 0.25;
        vec2 uvSample = (cellIndex + offset) * cell / uResolution;
        vec3 tap = texture2D(uScene, uvSample).rgb;
        if (uSceneIsSrgb > 0.5) tap = srgbToLinear(tap);
        sum += tap;
      }
    }
    vec3 cellColor = sum * 0.25;

    // Around 0.5, the middle of the lightness axis — the same pivot the tone
    // controls use, so the two behave alike
    float lightness = clamp(
      (linearToOklab(cellColor).x - 0.5) * uRampContrast + 0.5,
      0.0,
      1.0
    );

    // Nearest glyph, then sampled within its own cell of the strip. The 0.5
    // texel inset keeps linear filtering from reaching into the neighbour.
    float glyph = floor(lightness * (uGlyphCount - 1.0) + 0.5);
    vec2 inCell = fract(gl_FragCoord.xy / cell);
    float u = (glyph + clamp(inCell.x, 0.002, 0.998)) / uGlyphCount;
    float ink = texture2D(uGlyphs, vec2(u, 1.0 - inCell.y)).r;

    vec3 color = mix(cellColor * uBackground, cellColor, ink);

    vec2 noiseUv = vUv + uSeed;
    color = linearToSrgb(color);
    color += snoise(noiseUv * uGrainScale) * uGrainAmount;
    color += triangularDither(gl_FragCoord.xy) / 255.0;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`
