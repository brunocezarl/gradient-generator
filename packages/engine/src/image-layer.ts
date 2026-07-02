import type { ImageLayer } from "@shadercanvas/scene-schema";
import { createProgram, setUniform } from "./webgl/utils.js";
import { GLSL_VERTEX_FULLSCREEN } from "./glsl/common.js";

export interface ImageDrawParams {
  position: [number, number];
  scale: number;
  rotation: number;
}

const DEFAULT_IMAGE_PARAMS: ImageDrawParams = {
  position: [0.5, 0.5],
  scale: 1,
  rotation: 0,
};

/** WebGL program that draws a textured quad with basic spatial transform. */
export class ImageLayerRenderer {
  private readonly program: WebGLProgram;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, GLSL_VERTEX_FULLSCREEN, imageFragmentShader());
  }

  draw(texture: WebGLTexture, layer: ImageLayer): void {
    const { gl } = this;
    const params = {
      position: layer.transform.position ?? DEFAULT_IMAGE_PARAMS.position,
      scale: layer.transform.scale ?? DEFAULT_IMAGE_PARAMS.scale,
      rotation: layer.transform.rotation ?? DEFAULT_IMAGE_PARAMS.rotation,
    };

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const imageLoc = gl.getUniformLocation(this.program, "uImage");
    if (imageLoc) gl.uniform1i(imageLoc, 0);
    setUniform(gl, gl.getUniformLocation(this.program, "uPosition"), params.position);
    setUniform(gl, gl.getUniformLocation(this.program, "uScale"), params.scale);
    setUniform(gl, gl.getUniformLocation(this.program, "uRotation"), (params.rotation * Math.PI) / 180);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}

function imageFragmentShader(): string {
  return /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform vec2 uPosition;
uniform float uScale;
uniform float uRotation;

in vec2 vUv;
out vec4 fragColor;

vec2 rotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main() {
  // Map canvas UV so image is centered, scaled, and rotated.
  vec2 uv = vUv - uPosition;
  uv = rotate(uv, uRotation);
  uv = uv / max(uScale, 0.001) + 0.5;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0);
    return;
  }

  fragColor = texture(uImage, uv);
}
`;
}
