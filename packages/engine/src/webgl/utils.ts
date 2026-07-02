/** Create a WebGL2 context on a canvas with sane defaults for 2D compositing. */
export function createWebGL2Context(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });

  if (!gl) {
    throw new Error("WebGL2 is not supported in this browser");
  }

  return gl;
}

/** Compile one GLSL shader stage and throw with the driver log on failure. */
export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

/** Link vertex + fragment shaders into a program. */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "Unknown link error";
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
}

/** Typed helper for setting uniform values on a linked program. */
export function setUniform(
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation | null,
  value: number | number[],
): void {
  if (!location) return;

  if (typeof value === "number") {
    gl.uniform1f(location, value);
    return;
  }

  switch (value.length) {
    case 2:
      gl.uniform2fv(location, value);
      break;
    case 3:
      gl.uniform3fv(location, value);
      break;
    case 4:
      gl.uniform4fv(location, value);
      break;
    default:
      gl.uniform1f(location, value[0] ?? 0);
  }
}
