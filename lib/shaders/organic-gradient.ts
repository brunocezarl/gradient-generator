// Single source of the organic gradient shader.
//
// There used to be two divergent copies of this GLSL (simple scene and layers),
// which made the same configuration render differently in each mode: the layer
// version had neither the third color nor grain. Any visual change happens here
// and applies to both.

export const organicGradientVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const MAX_COLOR_STOPS = 8

export const organicGradientFragmentShader = /* glsl */ `
  #define MAX_STOPS ${MAX_COLOR_STOPS}

  uniform float uTime;
  uniform float uComplexity;
  uniform float uNoiseScale;
  // Color stops: colors in linear RGB (the sRGB conversion happens in JS, see
  // lib/color.ts) and positions in 0-1, ascending
  uniform vec3 uStopColors[MAX_STOPS];
  uniform float uStopPositions[MAX_STOPS];
  uniform int uStopCount;
  uniform float uFlowIntensity;
  uniform float uGrainAmount;
  uniform float uGrainScale;
  uniform float uThresholdMin;
  uniform float uThresholdMax;
  uniform float uVibrance;
  uniform float uExposure;   // stops of light, linear multiply
  uniform float uBrightness; // offset on Oklab lightness
  uniform float uContrast;   // gain on Oklab lightness around the mid point
  uniform float uOklabMix;     // 1.0 = mix in Oklab, 0.0 = in linear RGB
  uniform vec2 uSeed;          // offset into the noise field
  uniform float uLoopDuration; // 0 = free animation; > 0 = loop period

  const float TAU = 6.28318530718;

  varying vec2 vUv;

  // ─── Noise ─────────────────────────────────────────────────────────────────

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Curl noise for organic flow
  vec2 curl(float x, float y) {
    float eps = 0.01;
    float n1 = snoise(vec2(x + eps, y));
    float n2 = snoise(vec2(x - eps, y));
    float n3 = snoise(vec2(x, y + eps));
    float n4 = snoise(vec2(x, y - eps));
    float dy = (n1 - n2) / (2.0 * eps);
    float dx = (n3 - n4) / (2.0 * eps);
    return vec2(dy, -dx);
  }

  // ─── Color ─────────────────────────────────────────────────────────────────

  // sRGB encoding (IEC 61966-2-1). The compositor reads the drawing buffer as
  // sRGB, so this is where the image leaves linear space.
  vec3 linearToSrgb(vec3 c) {
    c = max(c, vec3(0.0));
    vec3 low = c * 12.92;
    vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
    return mix(high, low, step(c, vec3(0.0031308)));
  }

  // Oklab (Björn Ottosson): perceptually uniform mixing — without the dark,
  // grayish middle that linear interpolation produces between opposing hues
  vec3 linearToOklab(vec3 c) {
    float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
    float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
    float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
    vec3 lms = pow(max(vec3(l, m, s), vec3(0.0)), vec3(1.0 / 3.0));
    return vec3(
      0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
      1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
      0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z
    );
  }

  vec3 oklabToLinear(vec3 lab) {
    float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
    float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
    float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
    vec3 lms = vec3(l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
    return vec3(
       4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
      -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
      -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z
    );
  }

  // Interpolates two linear colors in the chosen space
  vec3 blendColors(vec3 a, vec3 b, float t) {
    vec3 linearMix = mix(a, b, t);
    vec3 oklabMix = oklabToLinear(mix(linearToOklab(a), linearToOklab(b), t));
    return mix(linearMix, oklabMix, uOklabMix);
  }

  // Vibrance: pushes the color away from the gray of equal luminance. Rec.709
  // coefficients because the color is in linear space here.
  vec3 applyVibrance(vec3 color, float amount) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luminance), color, 1.0 + amount);
  }

  // Brightness and contrast act on Oklab lightness, not on the RGB channels.
  // Scaling channels drags hue along with it — a red pushed brighter turns
  // orange, the same failure that makes lightening in HSL useless — while
  // moving L alone leaves hue and chroma exactly where the picker put them.
  //
  // Contrast pivots at L = 0.5, the middle of the lightness axis, so it opens
  // and closes symmetrically around the perceptual mid point rather than around
  // some channel value.
  vec3 applyTone(vec3 color, float brightness, float contrast) {
    vec3 lab = linearToOklab(color);
    lab.x = (lab.x - 0.5) * contrast + 0.5 + brightness;
    return oklabToLinear(lab);
  }

  // Gradient color at position t (0-1), walking the stops.
  //
  // The last stop whose position has been passed wins: for earlier segments the
  // local interpolation saturates at 1 and the result is overwritten by the next
  // segment. At the extremes the result is exactly the chosen color, so the HEX
  // from the picker survives intact all the way to the exported pixel.
  vec3 gradientColor(float t) {
    vec3 color = uStopColors[0];

    for (int i = 0; i < MAX_STOPS - 1; i++) {
      if (i + 1 >= uStopCount) break;

      float from = uStopPositions[i];
      float to = uStopPositions[i + 1];
      float local = clamp((t - from) / max(to - from, 1e-5), 0.0, 1.0);
      vec3 segment = blendColors(uStopColors[i], uStopColors[i + 1], local);

      color = t >= from ? segment : color;
    }

    return color;
  }

  // ─── Dither ────────────────────────────────────────────────────────────────

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Triangular-PDF noise at ±0.5 LSB: below the 8-bit quantization step
  // (invisible) but enough to dissolve the banding that smooth full-screen
  // gradients always produce
  float triangularDither(vec2 p) {
    return (hash12(p) + hash12(p + 17.13) - 1.0) * 0.5;
  }

  void main() {
    vec2 uv = vUv;
    vec2 noiseUv = uv + uSeed;
    float time = uTime * 0.5;

    // In loop mode time travels a circle through the noise field instead of
    // drifting in a straight line: completing the turn brings the drawing back
    // to exactly where it started, which is what allows seamless video. The
    // radius follows the duration so the sense of speed matches free mode.
    bool looping = uLoopDuration > 0.0;
    float theta = looping ? TAU * (uTime / uLoopDuration) : 0.0;

    // Sum noise octaves: complexity decides how many take part
    float noise = 0.0;
    float maxLayers = min(max(1.0, uComplexity * 1.5), 10.0);

    for (float i = 1.0; i <= 10.0; i++) {
      if (i > maxLayers) break;

      // Flow direction from the curl noise
      vec2 flow = curl(noiseUv.x * i * uNoiseScale, noiseUv.y * i * uNoiseScale) * uFlowIntensity;

      float modulation = looping ? sin(theta * i) : sin(time * i * 0.5);
      vec2 phase = looping
        ? vec2(cos(theta * i), sin(theta * i)) * (0.024 * i * uLoopDuration)
        : vec2(time * i * 0.3);

      // Animate the coordinates along the flow
      vec2 animatedUV = noiseUv + flow * (modulation * 0.2);

      // Higher frequencies weigh less
      noise += snoise(animatedUV * i * uNoiseScale + phase) * (1.0 / i);
    }

    // Normalize to 0-1
    noise = noise * 0.5 + 0.5;

    // Organic shapes from the adjustable threshold
    float shape = smoothstep(uThresholdMin, uThresholdMax, noise);

    vec3 color = gradientColor(shape);

    color = applyVibrance(color, uVibrance);

    // Exposure is an amount of light, so it multiplies in linear space: +1 is
    // one stop, exactly twice the light. exp2(0.0) is exactly 1.0, so the
    // neutral setting leaves the color bit for bit alone.
    color *= exp2(uExposure);

    // Skipped while neutral: the Oklab round trip is a pair of cube roots, and
    // running it for nothing would cost the exactness that makes the HEX from
    // the picker the exported pixel.
    if (uBrightness != 0.0 || uContrast != 1.0) {
      color = applyTone(color, uBrightness, uContrast);
    }

    // Encode to sRGB before the surface textures: grain and dither are effects
    // on the final image, not on the light in the scene
    color = linearToSrgb(color);

    // Grain over the composition (isotropic uv → grain does not stretch with aspect)
    color += snoise(noiseUv * uGrainScale) * uGrainAmount;

    color += triangularDither(gl_FragCoord.xy) / 255.0;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`
