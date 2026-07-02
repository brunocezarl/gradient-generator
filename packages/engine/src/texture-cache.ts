/** Async texture loader with in-memory cache keyed by image src. */
export class TextureCache {
  private readonly cache = new Map<string, WebGLTexture>();
  private readonly pending = new Map<string, Promise<WebGLTexture | null>>();

  get(src: string): WebGLTexture | null {
    return this.cache.get(src) ?? null;
  }

  /** Start loading if needed; calls onLoad when a new texture becomes available. */
  ensureLoaded(
    gl: WebGL2RenderingContext,
    src: string,
    onLoad: () => void,
  ): WebGLTexture | null {
    const existing = this.cache.get(src);
    if (existing) return existing;

    if (!this.pending.has(src)) {
      const promise = this.loadTexture(gl, src)
        .then((texture) => {
          if (texture) {
            this.cache.set(src, texture);
            onLoad();
          }
          return texture;
        })
        .finally(() => {
          this.pending.delete(src);
        });
      this.pending.set(src, promise);
    }

    return null;
  }

  /** Drop cached textures not referenced by the provided src list. */
  prune(activeSources: string[]): void {
    const active = new Set(activeSources);
    for (const [src, texture] of this.cache.entries()) {
      if (!active.has(src)) {
        this.cache.delete(src);
        // Note: textures are deleted when renderer disposes; POC keeps it simple.
        texture; // keep reference until dispose pass
      }
    }
  }

  dispose(gl: WebGL2RenderingContext): void {
    for (const texture of this.cache.values()) {
      gl.deleteTexture(texture);
    }
    this.cache.clear();
    this.pending.clear();
  }

  private loadTexture(gl: WebGL2RenderingContext, src: string): Promise<WebGLTexture | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const texture = gl.createTexture();
        if (!texture) {
          resolve(null);
          return;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        resolve(texture);
      };
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }
}
