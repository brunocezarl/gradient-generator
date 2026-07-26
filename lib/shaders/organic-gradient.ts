// Fonte única do shader de gradiente orgânico.
//
// Antes existiam duas cópias divergentes deste GLSL (cena simples e camadas),
// o que fazia a mesma configuração renderizar diferente nos dois modos: a
// versão de camadas não tinha a 3ª cor nem grão. Qualquer mudança visual
// acontece aqui e vale para os dois.

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
  // Paradas de cor: cores em RGB linear (a conversão de sRGB acontece no JS,
  // ver lib/color.ts) e posições em 0-1, ordenadas
  uniform vec3 uStopColors[MAX_STOPS];
  uniform float uStopPositions[MAX_STOPS];
  uniform int uStopCount;
  uniform float uFlowIntensity;
  uniform float uGrainAmount;
  uniform float uGrainScale;
  uniform float uThresholdMin;
  uniform float uThresholdMax;
  uniform float uVibrance;
  uniform float uOklabMix;     // 1.0 = misturar em Oklab, 0.0 = em RGB linear
  uniform vec2 uSeed;          // deslocamento no campo de ruído
  uniform float uLoopDuration; // 0 = animação livre; > 0 = período do loop

  const float TAU = 6.28318530718;

  varying vec2 vUv;

  // ─── Ruído ─────────────────────────────────────────────────────────────────

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

  // Curl noise para fluxo orgânico
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

  // ─── Cor ───────────────────────────────────────────────────────────────────

  // Codificação sRGB (IEC 61966-2-1). O drawing buffer é interpretado como
  // sRGB pelo compositor, então é aqui que a imagem sai do espaço linear.
  vec3 linearToSrgb(vec3 c) {
    c = max(c, vec3(0.0));
    vec3 low = c * 12.92;
    vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
    return mix(high, low, step(c, vec3(0.0031308)));
  }

  // Oklab (Björn Ottosson): mistura perceptualmente uniforme — sem o meio
  // escuro/acinzentado que a interpolação linear produz entre matizes opostos
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

  // Interpola duas cores lineares no espaço escolhido
  vec3 blendColors(vec3 a, vec3 b, float t) {
    vec3 linearMix = mix(a, b, t);
    vec3 oklabMix = oklabToLinear(mix(linearToOklab(a), linearToOklab(b), t));
    return mix(linearMix, oklabMix, uOklabMix);
  }

  // Vibrância: afasta a cor do cinza de mesma luminância. Coeficientes Rec.709
  // porque aqui a cor está em espaço linear.
  vec3 applyVibrance(vec3 color, float amount) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luminance), color, 1.0 + amount);
  }

  // Cor do gradiente na posição t (0-1), percorrendo as paradas.
  //
  // A última parada cuja posição já foi ultrapassada vence: para segmentos
  // anteriores a interpolação local satura em 1 e o resultado é sobrescrito
  // pelo segmento seguinte. Nos extremos o resultado é exatamente a cor
  // escolhida, então o HEX do picker sobrevive intacto até o pixel exportado.
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

  // Ruído de PDF triangular em ±0.5 LSB: abaixo do passo de quantização de 8
  // bits (invisível) mas suficiente para dissolver o banding que gradientes
  // suaves em tela cheia sempre produzem
  float triangularDither(vec2 p) {
    return (hash12(p) + hash12(p + 17.13) - 1.0) * 0.5;
  }

  void main() {
    vec2 uv = vUv;
    vec2 noiseUv = uv + uSeed;
    float time = uTime * 0.5;

    // Em modo loop o tempo percorre um círculo no campo de ruído em vez de
    // derivar em linha reta: ao completar a volta o desenho volta a ser
    // exatamente o mesmo, o que permite vídeo sem corte. O raio acompanha a
    // duração para que a sensação de velocidade seja a mesma do modo livre.
    bool looping = uLoopDuration > 0.0;
    float theta = looping ? TAU * (uTime / uLoopDuration) : 0.0;

    // Somar oitavas de ruído: a complexidade define quantas entram
    float noise = 0.0;
    float maxLayers = min(max(1.0, uComplexity * 1.5), 10.0);

    for (float i = 1.0; i <= 10.0; i++) {
      if (i > maxLayers) break;

      // Direção do fluxo vinda do curl noise
      vec2 flow = curl(noiseUv.x * i * uNoiseScale, noiseUv.y * i * uNoiseScale) * uFlowIntensity;

      float modulation = looping ? sin(theta * i) : sin(time * i * 0.5);
      vec2 phase = looping
        ? vec2(cos(theta * i), sin(theta * i)) * (0.024 * i * uLoopDuration)
        : vec2(time * i * 0.3);

      // Animar as coordenadas ao longo do fluxo
      vec2 animatedUV = noiseUv + flow * (modulation * 0.2);

      // Frequências mais altas pesam menos
      noise += snoise(animatedUV * i * uNoiseScale + phase) * (1.0 / i);
    }

    // Normalizar para 0-1
    noise = noise * 0.5 + 0.5;

    // Formas orgânicas pelo limiar ajustável
    float shape = smoothstep(uThresholdMin, uThresholdMax, noise);

    vec3 color = gradientColor(shape);

    color = applyVibrance(color, uVibrance);

    // Saída para sRGB antes das texturas de superfície: grão e dither são
    // efeitos sobre a imagem final, não sobre a luz da cena
    color = linearToSrgb(color);

    // Grão sobre a composição (uv isotrópico → grão não estica com a proporção)
    color += snoise(noiseUv * uGrainScale) * uGrainAmount;

    color += triangularDither(gl_FragCoord.xy) / 255.0;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`
