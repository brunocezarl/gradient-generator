import { createProgram } from "./utils.js";
import { GLSL_VERTEX_FULLSCREEN } from "../glsl/common.js";

/** Single fullscreen triangle/quad mesh reused by every pass. */
export class FullscreenQuad {
  readonly program: WebGLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly positionLocation: number;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, GLSL_VERTEX_FULLSCREEN, passthroughFragment());
    this.positionLocation = gl.getAttribLocation(this.program, "aPosition");

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) {
      throw new Error("Failed to create fullscreen quad buffers");
    }

    // Two triangles covering clip space (-1..1).
    const vertices = new Float32Array([
      -1, -1,
      3, -1,
      -1, 3,
    ]);

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.vao = vao;
  }

  draw(): void {
    const { gl } = this;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
  }
}

function passthroughFragment(): string {
  return /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }
`;
}
