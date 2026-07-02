import type { BlendMode, Layer, Scene } from "@shadercanvas/scene-schema";
import { BLEND_MODE_INDEX } from "./blend-modes.js";
import { EFFECT_REGISTRY } from "./effects/index.js";
import { ImageLayerRenderer } from "./image-layer.js";
import { TextureCache } from "./texture-cache.js";
import type { RuntimeInputs } from "./uniform-resolver.js";
import { FullscreenQuad } from "./webgl/fullscreen-quad.js";
import { RenderTarget } from "./webgl/render-target.js";
import { createProgram, setUniform } from "./webgl/utils.js";
import { GLSL_VERTEX_FULLSCREEN } from "./glsl/common.js";

export interface SceneRendererOptions {
  canvas: HTMLCanvasElement;
  scene: Scene;
}

/** Main WebGL2 renderer: layers → render targets → composite to screen. */
export class SceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly quad: FullscreenQuad;
  private readonly compositeProgram: WebGLProgram;
  private readonly solidProgram: WebGLProgram;
  private readonly imageRenderer: ImageLayerRenderer;
  private readonly textureCache: TextureCache;
  private readonly effectPrograms = new Map<string, WebGLProgram>();

  private scene: Scene;
  private layerTargets: RenderTarget[] = [];
  private pingTarget: RenderTarget | null = null;
  private pongTarget: RenderTarget | null = null;
  private accumulator: RenderTarget | null = null;
  private time = 0;
  private playing = true;
  private animationFrame = 0;
  private variables: Record<string, number | number[]> = {};
  private mouse: [number, number] = [0.5, 0.5];
  private needsRender = true;

  constructor(options: SceneRendererOptions) {
    const gl = options.canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error("WebGL2 is not supported");
    }

    this.gl = gl;
    this.scene = options.scene;
    this.variables = { ...(options.scene.variables ?? {}) };
    this.quad = new FullscreenQuad(gl);
    this.textureCache = new TextureCache();
    this.imageRenderer = new ImageLayerRenderer(gl);
    this.compositeProgram = createProgram(gl, GLSL_VERTEX_FULLSCREEN, compositeFragmentShader());
    this.solidProgram = createProgram(gl, GLSL_VERTEX_FULLSCREEN, solidFragmentShader());

    for (const effect of Object.values(EFFECT_REGISTRY)) {
      this.effectPrograms.set(effect.id, effect.createProgram(gl));
    }

    this.attachMouseTracking(options.canvas);
    this.preloadImageLayers();
    this.resize(options.canvas.clientWidth || options.scene.canvas.width, options.canvas.clientHeight || options.scene.canvas.height);
    this.renderFrame(0);
    this.play();
  }

  getScene(): Scene {
    return this.scene;
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    this.variables = { ...(scene.variables ?? {}) };
    this.preloadImageLayers();
    this.ensureTargets();
    this.renderFrame(0);
  }

  play(): void {
    this.playing = true;
    this.startLoop();
  }

  pause(): void {
    this.playing = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  setVariable(name: string, value: number | number[]): void {
    this.variables[name] = value;
    this.needsRender = true;
  }

  resize(width: number, height: number): void {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));

    this.gl.canvas.width = pixelWidth;
    this.gl.canvas.height = pixelHeight;
    this.ensureTargets();
    this.renderFrame(0);
  }

  /** Render at scene resolution (× scale) and return a PNG data URL. */
  captureSnapshot(scale = 1): string {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const savedWidth = canvas.width;
    const savedHeight = canvas.height;

    const exportWidth = Math.max(1, Math.floor(this.scene.canvas.width * scale));
    const exportHeight = Math.max(1, Math.floor(this.scene.canvas.height * scale));

    canvas.width = exportWidth;
    canvas.height = exportHeight;
    this.ensureTargets();
    this.renderFrame(0);

    const dataUrl = canvas.toDataURL("image/png");

    canvas.width = savedWidth;
    canvas.height = savedHeight;
    this.ensureTargets();
    this.renderFrame(0);

    return dataUrl;
  }

  getCanvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }

  renderFrame(deltaSeconds: number): void {
    if (this.playing) {
      this.time += deltaSeconds;
    }

    const { gl, scene } = this;
    if (!this.accumulator) return;

    const bg = scene.canvas.backgroundColor ?? [0, 0, 0, 1];
    this.accumulator.bind();
    gl.clearColor(bg[0], bg[1], bg[2], bg[3] ?? 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let isFirst = true;
    scene.layers.forEach((layer) => {
      if (!layer.transform.visible) return;
      const layerTexture = this.renderLayer(layer);
      if (!layerTexture) return;
      this.compositeLayer(layerTexture, layer.transform.blendMode, layer.transform.opacity, isFirst);
      isFirst = false;
    });

    // Present accumulator to the visible canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    this.blitTexture(this.accumulator.texture);
    this.needsRender = false;
  }

  dispose(): void {
    this.pause();
    this.layerTargets.forEach((target) => target.dispose());
    this.pingTarget?.dispose();
    this.pongTarget?.dispose();
    this.accumulator?.dispose();
    this.quad.dispose();
    this.imageRenderer.dispose();
    this.textureCache.dispose(this.gl);
    this.gl.deleteProgram(this.compositeProgram);
    this.gl.deleteProgram(this.solidProgram);
    this.effectPrograms.forEach((program) => this.gl.deleteProgram(program));
  }

  private getRuntime(): RuntimeInputs {
    return { time: this.time, mouse: this.mouse };
  }

  private attachMouseTracking(canvas: HTMLCanvasElement): void {
    const updateMouse = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.mouse = [
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height,
      ];
      this.needsRender = true;
    };

    canvas.addEventListener("mousemove", updateMouse);
    canvas.addEventListener("mouseleave", () => {
      this.mouse = [0.5, 0.5];
      this.needsRender = true;
    });
  }

  private preloadImageLayers(): void {
    const sources = this.scene.layers
      .filter((layer): layer is Extract<Layer, { type: "image" }> => layer.type === "image")
      .map((layer) => layer.src);

    this.textureCache.prune(sources);
    for (const src of sources) {
      this.textureCache.ensureLoaded(this.gl, src, () => {
        this.needsRender = true;
      });
    }
  }

  private startLoop(): void {
    if (this.animationFrame) return;

    let lastTime = performance.now();
    const tick = (now: number) => {
      if (!this.playing) return;
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      // Always render while playing (time-driven effects + mouse interactions).
      this.renderFrame(delta);
      this.animationFrame = requestAnimationFrame(tick);
    };

    this.animationFrame = requestAnimationFrame(tick);
  }

  private ensureTargets(): void {
    const width = this.gl.canvas.width;
    const height = this.gl.canvas.height;

    while (this.layerTargets.length < this.scene.layers.length) {
      this.layerTargets.push(new RenderTarget(this.gl, width, height));
    }
    while (this.layerTargets.length > this.scene.layers.length) {
      this.layerTargets.pop()?.dispose();
    }

    this.layerTargets.forEach((target) => target.resize(width, height));

    if (!this.pingTarget) {
      this.pingTarget = new RenderTarget(this.gl, width, height);
      this.pongTarget = new RenderTarget(this.gl, width, height);
      this.accumulator = new RenderTarget(this.gl, width, height);
    } else {
      this.pingTarget.resize(width, height);
      this.pongTarget?.resize(width, height);
      this.accumulator?.resize(width, height);
    }
  }

  private renderLayer(layer: Layer): WebGLTexture | null {
    const { gl } = this;
    const layerIndex = this.scene.layers.indexOf(layer);
    const outputTarget = this.layerTargets[layerIndex];
    const pingTarget = this.pingTarget;
    const pongTarget = this.pongTarget;
    if (!outputTarget || !pingTarget || !pongTarget) return null;

    let readTarget: RenderTarget | null = null;
    let writeTarget: RenderTarget = pingTarget;

    if (layer.type === "solid") {
      writeTarget.bind();
      gl.useProgram(this.solidProgram);
      setUniform(gl, gl.getUniformLocation(this.solidProgram, "uColor"), layer.color);
      this.quad.draw();
      readTarget = writeTarget;
      writeTarget = writeTarget === pingTarget ? pongTarget : pingTarget;
    }

    if (layer.type === "image") {
      const texture =
        this.textureCache.get(layer.src) ??
        this.textureCache.ensureLoaded(this.gl, layer.src, () => {
          this.needsRender = true;
        });

      if (texture) {
        writeTarget.bind();
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.imageRenderer.draw(texture, layer);
        this.quad.draw();
        readTarget = writeTarget;
        writeTarget = writeTarget === pingTarget ? pongTarget : pingTarget;
      }
    }

    const runtime = this.getRuntime();

    layer.effects.forEach((effectInstance, effectIndex) => {
      if (!effectInstance.enabled) return;

      const implementation = EFFECT_REGISTRY[effectInstance.id];
      const program = this.effectPrograms.get(effectInstance.id);
      if (!implementation || !program) return;

      writeTarget.bind();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      implementation.apply(
        {
          gl,
          program,
          scene: this.scene,
          layer,
          effectIndex,
          runtime,
          resolution: [this.gl.canvas.width, this.gl.canvas.height],
          inputTexture: readTarget?.texture ?? null,
          hasInput: readTarget !== null,
          variables: this.variables,
        },
        effectInstance,
      );

      gl.useProgram(program);
      this.quad.draw();

      readTarget = writeTarget;
      writeTarget = writeTarget === pingTarget ? pongTarget : pingTarget;
    });

    if (!readTarget) {
      outputTarget.bind();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return outputTarget.texture;
    }

    outputTarget.bind();
    this.blitTexture(readTarget.texture);
    return outputTarget.texture;
  }

  private blitTexture(texture: WebGLTexture): void {
    const { gl } = this;
    gl.useProgram(this.compositeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, "uLayer"), 0);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, "uBlendMode"), 0);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, "uOpacity"), 1);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, "uIsFirstLayer"), 1);
    this.quad.draw();
  }

  private compositeLayer(
    layerTexture: WebGLTexture,
    blendMode: BlendMode,
    opacity: number,
    isFirstVisibleLayer: boolean,
  ): void {
    const { gl } = this;
    if (!this.accumulator || !this.pongTarget) return;

    // Read accumulator + layer, write blended result to pong, then swap.
    this.pongTarget.bind();
    gl.useProgram(this.compositeProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.accumulator.texture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, "uBase"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, layerTexture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, "uLayer"), 1);

    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, "uBlendMode"), BLEND_MODE_INDEX[blendMode]);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, "uOpacity"), opacity);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, "uIsFirstLayer"), isFirstVisibleLayer ? 1 : 0);
    this.quad.draw();

    // Swap accumulator and pong so blended output becomes the new base.
    const temp = this.accumulator;
    this.accumulator = this.pongTarget;
    this.pongTarget = temp;
  }
}

function solidFragmentShader(): string {
  return /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}
`;
}

function compositeFragmentShader(): string {
  return /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uBase;
uniform sampler2D uLayer;
uniform int uBlendMode;
uniform float uOpacity;
uniform float uIsFirstLayer;

in vec2 vUv;
out vec4 fragColor;

vec3 blendNormal(vec3 base, vec3 layer, float alpha) {
  return mix(base, layer, alpha);
}

vec3 blendMultiply(vec3 base, vec3 layer, float alpha) {
  vec3 blended = base * layer;
  return mix(base, blended, alpha);
}

vec3 blendScreen(vec3 base, vec3 layer, float alpha) {
  vec3 blended = 1.0 - (1.0 - base) * (1.0 - layer);
  return mix(base, blended, alpha);
}

void main() {
  vec3 layerColor = texture(uLayer, vUv).rgb;
  float alpha = uOpacity;

  if (uIsFirstLayer > 0.5) {
    fragColor = vec4(layerColor, 1.0);
    return;
  }

  vec3 base = texture(uBase, vUv).rgb;
  vec3 result = layerColor;

  if (uBlendMode == 1) {
    result = blendMultiply(base, layerColor, alpha);
  } else if (uBlendMode == 2) {
    result = blendScreen(base, layerColor, alpha);
  } else {
    result = blendNormal(base, layerColor, alpha);
  }

  fragColor = vec4(result, 1.0);
}
`;
}
