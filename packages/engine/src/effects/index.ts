import type { EffectInstance, Layer, Scene } from "@shadercanvas/scene-schema";
import { EFFECT_DEFINITIONS } from "@shadercanvas/scene-schema";
import { createProgram, setUniform } from "../webgl/utils.js";
import { GLSL_COMMON, GLSL_VERTEX_FULLSCREEN } from "../glsl/common.js";
import { resolveEffectUniforms, type RuntimeInputs } from "../uniform-resolver.js";

export interface EffectPassContext {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  scene: Scene;
  layer: Layer;
  effectIndex: number;
  runtime: RuntimeInputs;
  resolution: [number, number];
  inputTexture: WebGLTexture | null;
  hasInput: boolean;
  variables: Record<string, number | number[]>;
}

export interface EffectImplementation {
  id: string;
  createProgram(gl: WebGL2RenderingContext): WebGLProgram;
  apply(ctx: EffectPassContext, instance: EffectInstance): void;
}

function bindCommonUniforms(ctx: EffectPassContext, program: WebGLProgram): void {
  const { gl, runtime, resolution, inputTexture, hasInput } = ctx;
  gl.useProgram(program);

  setUniform(gl, gl.getUniformLocation(program, "uTime"), runtime.time);
  setUniform(gl, gl.getUniformLocation(program, "uMouse"), runtime.mouse);
  setUniform(gl, gl.getUniformLocation(program, "uResolution"), resolution);
  setUniform(gl, gl.getUniformLocation(program, "uHasInput"), hasInput ? 1 : 0);

  const inputLoc = gl.getUniformLocation(program, "uInput");
  if (inputLoc) {
    gl.activeTexture(gl.TEXTURE0);
    if (inputTexture) {
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    }
    gl.uniform1i(inputLoc, 0);
  }
}

function resolvedUniforms(ctx: EffectPassContext, instance: EffectInstance): Record<string, number | number[]> {
  return resolveEffectUniforms(
    ctx.scene,
    ctx.layer,
    ctx.effectIndex,
    instance,
    ctx.runtime,
    ctx.variables,
  );
}

/** Organic multi-octave noise fill inspired by gradient-generator. */
export const noiseFillEffect: EffectImplementation = {
  id: "noise_fill",
  createProgram(gl) {
    const fragment = /* glsl */ `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform float uHasInput;
uniform sampler2D uInput;

uniform float uComplexity;
uniform float uNoiseScale;
uniform float uFlowIntensity;
uniform float uThresholdMin;
uniform float uThresholdMax;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

in vec2 vUv;
out vec4 fragColor;

${GLSL_COMMON}

void main() {
  vec2 uv = vUv;
  float time = uTime * 0.5;
  float noise = 0.0;
  float maxLayers = max(1.0, uComplexity * 1.5);
  float maxIterations = min(maxLayers, 6.0);

  // Mouse nudges the flow field — great for interactive previews.
  vec2 mouseOffset = (uMouse - 0.5) * 2.0 * uFlowIntensity * 0.15;

  for (float i = 1.0; i <= 6.0; i++) {
    if (i > maxIterations) break;
    vec2 flow = curl(uv.x * i * uNoiseScale, uv.y * i * uNoiseScale) * uFlowIntensity;
    vec2 animatedUV = uv + flow * (sin(time * i * 0.5) * 0.2) + mouseOffset * i * 0.05;
    float layerNoise = snoise(animatedUV * i * uNoiseScale + time * i * 0.3);
    noise += layerNoise * (1.0 / i);
  }

  noise = noise * 0.5 + 0.5;
  float shape = smoothstep(uThresholdMin, uThresholdMax, noise);

  vec3 colorAB = mix(uColor1, uColor2, clamp(shape * 2.0, 0.0, 1.0));
  vec3 colorBC = mix(uColor2, uColor3, clamp(shape * 2.0 - 1.0, 0.0, 1.0));
  vec3 color = mix(colorAB, colorBC, step(0.5, shape));
  color = applyVibrance(color, 0.2);
  color = gammaCorrect(color, 2.2);
  color = clamp(color, 0.0, 1.0);

  if (uHasInput > 0.5) {
    vec4 base = texture(uInput, vUv);
    color = mix(base.rgb, color, 0.85);
  }

  fragColor = vec4(color, 1.0);
}
`;
    return createProgram(gl, GLSL_VERTEX_FULLSCREEN, fragment);
  },
  apply(ctx, instance) {
    const { gl } = ctx;
    const program = ctx.program;
    bindCommonUniforms(ctx, program);

    const uniforms = resolvedUniforms(ctx, instance);
    setUniform(gl, gl.getUniformLocation(program, "uComplexity"), uniforms.complexity);
    setUniform(gl, gl.getUniformLocation(program, "uNoiseScale"), uniforms.noiseScale);
    setUniform(gl, gl.getUniformLocation(program, "uFlowIntensity"), uniforms.flowIntensity);
    setUniform(gl, gl.getUniformLocation(program, "uThresholdMin"), uniforms.thresholdMin);
    setUniform(gl, gl.getUniformLocation(program, "uThresholdMax"), uniforms.thresholdMax);
    setUniform(gl, gl.getUniformLocation(program, "uColor1"), uniforms.color1);
    setUniform(gl, gl.getUniformLocation(program, "uColor2"), uniforms.color2);
    setUniform(gl, gl.getUniformLocation(program, "uColor3"), uniforms.color3);
  },
};

/** Linear gradient overlay with optional input blend. */
export const gradientEffect: EffectImplementation = {
  id: "gradient",
  createProgram(gl) {
    const fragment = /* glsl */ `#version 300 es
precision highp float;

uniform float uHasInput;
uniform sampler2D uInput;
uniform float uAngle;
uniform vec3 uColorStart;
uniform vec3 uColorEnd;
uniform float uMixInput;

in vec2 vUv;
out vec4 fragColor;

void main() {
  float radiansAngle = radians(uAngle);
  vec2 direction = vec2(cos(radiansAngle), sin(radiansAngle));
  float t = dot(vUv - 0.5, direction) + 0.5;
  t = clamp(t, 0.0, 1.0);
  vec3 gradientColor = mix(uColorStart, uColorEnd, t);

  vec3 color = gradientColor;
  if (uHasInput > 0.5) {
    vec3 inputColor = texture(uInput, vUv).rgb;
    color = mix(gradientColor, inputColor, uMixInput);
  }

  fragColor = vec4(color, 1.0);
}
`;
    return createProgram(gl, GLSL_VERTEX_FULLSCREEN, fragment);
  },
  apply(ctx, instance) {
    const { gl } = ctx;
    const program = ctx.program;
    bindCommonUniforms(ctx, program);

    const uniforms = resolvedUniforms(ctx, instance);
    setUniform(gl, gl.getUniformLocation(program, "uAngle"), uniforms.angle);
    setUniform(gl, gl.getUniformLocation(program, "uColorStart"), uniforms.colorStart);
    setUniform(gl, gl.getUniformLocation(program, "uColorEnd"), uniforms.colorEnd);
    setUniform(gl, gl.getUniformLocation(program, "uMixInput"), uniforms.mixInput);
  },
};

/** Film grain overlay using simplex noise (from gradient-generator grain pass). */
export const grainEffect: EffectImplementation = {
  id: "grain",
  createProgram(gl) {
    const fragment = /* glsl */ `#version 300 es
precision highp float;

uniform float uHasInput;
uniform sampler2D uInput;
uniform float uAmount;
uniform float uScale;

in vec2 vUv;
out vec4 fragColor;

${GLSL_COMMON}

void main() {
  vec3 base = uHasInput > 0.5 ? texture(uInput, vUv).rgb : vec3(0.0);
  float grain = snoise(vUv * uScale) * uAmount;
  vec3 color = clamp(base + grain, 0.0, 1.0);
  fragColor = vec4(color, 1.0);
}
`;
    return createProgram(gl, GLSL_VERTEX_FULLSCREEN, fragment);
  },
  apply(ctx, instance) {
    const { gl } = ctx;
    const program = ctx.program;
    bindCommonUniforms(ctx, program);

    const uniforms = resolvedUniforms(ctx, instance);
    setUniform(gl, gl.getUniformLocation(program, "uAmount"), uniforms.amount);
    setUniform(gl, gl.getUniformLocation(program, "uScale"), uniforms.scale);
  },
};

export const EFFECT_REGISTRY: Record<string, EffectImplementation> = {
  noise_fill: noiseFillEffect,
  gradient: gradientEffect,
  grain: grainEffect,
};
