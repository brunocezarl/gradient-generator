// Layer compositing shader.
//
// Compositing happens on values already encoded in sRGB, which is what Photoshop
// and CSS `mix-blend-mode` do — a "multiply" has to give the same result the
// designer saw in the tool they came from. The formulas are those of Compositing
// and Blending Level 1.

export const compositeVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Blend mode indices, kept in sync with lib/layer-utils.ts through
// `blendModeToShaderIndex`.
export const compositeFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uBase;   // composition accumulated so far
  uniform sampler2D uLayer;  // layer to apply
  uniform float uOpacity;
  uniform int uBlendMode;

  varying vec2 vUv;

  float blendChannel(int mode, float b, float s) {
    if (mode == 1) return b * s;                                   // multiply
    if (mode == 2) return b + s - b * s;                           // screen
    if (mode == 3) return b <= 0.5                                 // overlay
      ? 2.0 * b * s
      : 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
    if (mode == 4) return min(b, s);                               // darken
    if (mode == 5) return max(b, s);                               // lighten
    if (mode == 6) return s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); // color-dodge
    if (mode == 7) return s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s); // color-burn
    if (mode == 8) return s <= 0.5                                 // hard-light
      ? 2.0 * s * b
      : 1.0 - 2.0 * (1.0 - s) * (1.0 - b);
    if (mode == 9) {                                               // soft-light
      if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
      float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
      return b + (2.0 * s - 1.0) * (d - b);
    }
    if (mode == 10) return abs(b - s);                             // difference
    if (mode == 11) return b + s - 2.0 * b * s;                    // exclusion
    return s;                                                      // normal
  }

  void main() {
    vec3 base = texture2D(uBase, vUv).rgb;
    vec3 layer = texture2D(uLayer, vUv).rgb;

    vec3 blended = vec3(
      blendChannel(uBlendMode, base.r, layer.r),
      blendChannel(uBlendMode, base.g, layer.g),
      blendChannel(uBlendMode, base.b, layer.b)
    );

    // The layer itself is fully opaque; opacity interpolates between the backdrop
    // and the blended result, as in any layer-based editor
    gl_FragColor = vec4(mix(base, blended, clamp(uOpacity, 0.0, 1.0)), 1.0);
  }
`

const BLEND_MODE_INDEX: Record<string, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  colorDodge: 6,
  colorBurn: 7,
  hardLight: 8,
  softLight: 9,
  difference: 10,
  exclusion: 11,
}

export function blendModeToShaderIndex(mode: string): number {
  return BLEND_MODE_INDEX[mode] ?? 0
}
