// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest"
import * as THREE from "three"
import {
  cssBlendToComposite,
  clampToMaxSize,
  recommendBitrateMbps,
  registerCaptureContext,
  unregisterCaptureContext,
  getCaptureContext,
  getLayerCompositing,
  overrideRenderSize,
  overrideCameraAspect,
  exportCompositeImage,
  type CaptureContext,
} from "./capture"

describe("cssBlendToComposite", () => {
  it("converte 'normal' para 'source-over'", () => {
    expect(cssBlendToComposite("normal")).toBe("source-over")
  })

  it("mantém blend modes suportados pelo canvas 2D", () => {
    expect(cssBlendToComposite("multiply")).toBe("multiply")
    expect(cssBlendToComposite("screen")).toBe("screen")
    expect(cssBlendToComposite("color-dodge")).toBe("color-dodge")
    expect(cssBlendToComposite("soft-light")).toBe("soft-light")
  })

  it("usa 'source-over' como fallback para valores desconhecidos ou vazios", () => {
    expect(cssBlendToComposite("plus-lighter")).toBe("source-over")
    expect(cssBlendToComposite("")).toBe("source-over")
    expect(cssBlendToComposite(undefined)).toBe("source-over")
  })
})

describe("clampToMaxSize", () => {
  it("não altera dimensões dentro do limite", () => {
    expect(clampToMaxSize(1920, 1080, 8192)).toEqual({ width: 1920, height: 1080 })
  })

  it("reduz preservando a proporção quando excede o limite", () => {
    const result = clampToMaxSize(20000, 10000, 8192)
    expect(result.width).toBe(8192)
    expect(result.height).toBe(4096)
  })

  it("limita pela maior dimensão (retrato)", () => {
    const result = clampToMaxSize(10000, 20000, 8192)
    expect(result.height).toBe(8192)
    expect(result.width).toBe(4096)
  })

  it("nunca retorna dimensões menores que 1", () => {
    const result = clampToMaxSize(1, 100000, 1024)
    expect(result.width).toBeGreaterThanOrEqual(1)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})

describe("recommendBitrateMbps", () => {
  it("recomenda mais bitrate para qualidade mais alta", () => {
    const low = recommendBitrateMbps(1920, 1080, 30, "low")
    const medium = recommendBitrateMbps(1920, 1080, 30, "medium")
    const high = recommendBitrateMbps(1920, 1080, 30, "high")
    expect(low).toBeLessThan(medium)
    expect(medium).toBeLessThan(high)
  })

  it("escala com resolução e FPS", () => {
    const fullHd30 = recommendBitrateMbps(1920, 1080, 30, "high")
    const fullHd60 = recommendBitrateMbps(1920, 1080, 60, "high")
    const fourK30 = recommendBitrateMbps(3840, 2160, 30, "high")
    expect(fullHd60).toBeGreaterThan(fullHd30)
    expect(fourK30).toBeGreaterThan(fullHd30)
  })

  it("respeita os limites de 2 a 50 Mbps", () => {
    expect(recommendBitrateMbps(320, 240, 15, "low")).toBeGreaterThanOrEqual(2)
    expect(recommendBitrateMbps(7680, 4320, 60, "high")).toBeLessThanOrEqual(50)
  })
})

// Renderer WebGL falso: registra as chamadas para verificar o ciclo
// resize → render → restore
function createStubRenderer(width = 300, height = 150, pixelRatio = 2) {
  return {
    getSize: vi.fn((v: THREE.Vector2) => v.set(width, height)),
    getPixelRatio: vi.fn(() => pixelRatio),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    capabilities: { maxTextureSize: 4096 },
  }
}

function stubContext(
  gl: ReturnType<typeof createStubRenderer>,
  camera: THREE.Camera = {} as THREE.Camera
): CaptureContext {
  return {
    gl: gl as unknown as THREE.WebGLRenderer,
    scene: {} as THREE.Scene,
    camera,
  }
}

describe("registro de contextos de captura", () => {
  it("registra, retorna e remove contextos por canvas", () => {
    const canvas = document.createElement("canvas")
    const context = stubContext(createStubRenderer())

    expect(getCaptureContext(canvas)).toBeNull()

    registerCaptureContext(canvas, context)
    expect(getCaptureContext(canvas)).toBe(context)

    unregisterCaptureContext(canvas)
    expect(getCaptureContext(canvas)).toBeNull()
  })
})

describe("getLayerCompositing", () => {
  it("multiplica opacidades dos ancestrais até a raiz", () => {
    const root = document.createElement("div")
    const outer = document.createElement("div")
    outer.style.opacity = "0.5"
    const inner = document.createElement("div")
    inner.style.opacity = "0.5"
    const canvas = document.createElement("canvas")

    inner.appendChild(canvas)
    outer.appendChild(inner)
    root.appendChild(outer)
    document.body.appendChild(root)

    const { opacity } = getLayerCompositing(canvas, root)
    expect(opacity).toBeCloseTo(0.25)
    root.remove()
  })

  it("usa o mix-blend-mode mais próximo do canvas", () => {
    const root = document.createElement("div")
    const wrapper = document.createElement("div")
    wrapper.style.mixBlendMode = "multiply"
    const canvas = document.createElement("canvas")

    wrapper.appendChild(canvas)
    root.appendChild(wrapper)
    document.body.appendChild(root)

    const { blend } = getLayerCompositing(canvas, root)
    expect(blend).toBe("multiply")
    root.remove()
  })

  it("retorna padrões para canvas direto na raiz", () => {
    const root = document.createElement("div")
    const canvas = document.createElement("canvas")
    root.appendChild(canvas)
    document.body.appendChild(root)

    expect(getLayerCompositing(canvas, root)).toEqual({ opacity: 1, blend: "source-over" })
    root.remove()
  })
})

describe("overrideCameraAspect", () => {
  it("reprojeta a câmera perspectiva na proporção alvo e restaura", () => {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100)
    const projectionBefore = camera.projectionMatrix.clone()

    const restore = overrideCameraAspect(camera, 1080 / 1920)
    expect(restore).not.toBeNull()
    expect(camera.aspect).toBeCloseTo(0.5625)
    // A projeção realmente mudou — não basta escrever o campo `aspect`
    expect(camera.projectionMatrix.equals(projectionBefore)).toBe(false)

    restore!()
    expect(camera.aspect).toBeCloseTo(16 / 9)
    expect(camera.projectionMatrix.equals(projectionBefore)).toBe(true)
  })

  it("não faz nada quando a proporção já é a alvo", () => {
    const camera = new THREE.PerspectiveCamera(75, 1920 / 1080, 0.1, 100)
    expect(overrideCameraAspect(camera, 1920 / 1080)).toBeNull()
  })

  it("recalcula a largura da câmera ortográfica preservando a altura", () => {
    const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100)

    const restore = overrideCameraAspect(camera, 1)
    expect(restore).not.toBeNull()
    // Altura 9 preservada; largura passa a 9 para proporção 1:1
    expect(camera.left).toBeCloseTo(-4.5)
    expect(camera.right).toBeCloseTo(4.5)
    expect(camera.top).toBeCloseTo(4.5)
    expect(camera.bottom).toBeCloseTo(-4.5)

    restore!()
    expect(camera.left).toBeCloseTo(-8)
    expect(camera.right).toBeCloseTo(8)
  })

  it("ignora câmeras de tipo desconhecido", () => {
    expect(overrideCameraAspect({} as THREE.Camera, 2)).toBeNull()
  })
})

describe("overrideRenderSize", () => {
  it("retorna null para canvas sem renderer registrado", () => {
    const canvas = document.createElement("canvas")
    expect(overrideRenderSize(canvas, 1920, 1080)).toBeNull()
  })

  it("reprojeta a câmera na proporção de saída antes de renderizar", () => {
    // Exportar um story 1080×1920 a partir de uma janela 16:9: sem reprojetar,
    // o frame landscape sai comprimido dentro do buffer retrato
    const canvas = document.createElement("canvas")
    const gl = createStubRenderer(1920, 1080, 1)
    const camera = new THREE.PerspectiveCamera(75, 1920 / 1080, 0.1, 100)
    registerCaptureContext(canvas, stubContext(gl, camera))

    const aspectDuringRender: number[] = []
    gl.render.mockImplementation(() => {
      aspectDuringRender.push(camera.aspect)
    })

    const restore = overrideRenderSize(canvas, 1080, 1920)
    expect(aspectDuringRender[0]).toBeCloseTo(1080 / 1920)

    restore!()
    expect(camera.aspect).toBeCloseTo(1920 / 1080)
    // O frame de restauração já usa a proporção original
    expect(aspectDuringRender[1]).toBeCloseTo(1920 / 1080)

    unregisterCaptureContext(canvas)
  })

  it("re-renderiza no tamanho alvo (limitado pela GPU) e restaura o estado", () => {
    const canvas = document.createElement("canvas")
    const gl = createStubRenderer(300, 150, 2)
    registerCaptureContext(canvas, stubContext(gl))

    // 10000x5000 excede maxTextureSize=4096 → clamp proporcional
    const restore = overrideRenderSize(canvas, 10000, 5000)
    expect(restore).not.toBeNull()
    expect(gl.setPixelRatio).toHaveBeenCalledWith(1)
    expect(gl.setSize).toHaveBeenCalledWith(4096, 2048, false)
    expect(gl.render).toHaveBeenCalledTimes(1)

    restore!()
    expect(gl.setPixelRatio).toHaveBeenLastCalledWith(2)
    expect(gl.setSize).toHaveBeenLastCalledWith(300, 150, false)
    expect(gl.render).toHaveBeenCalledTimes(2)

    unregisterCaptureContext(canvas)
  })
})

describe("exportCompositeImage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejeita quando o container não tem canvas", async () => {
    const container = document.createElement("div")
    await expect(
      exportCompositeImage(container, { scale: 1, mimeType: "image/png", quality: 1 })
    ).rejects.toThrow("No canvas found to export")
  })

  it("compõe camadas com opacidade/blend e codifica o blob", async () => {
    // happy-dom não implementa canvas 2D: fornecer um contexto fake que
    // registra as operações de composição
    const operations: Array<Record<string, unknown>> = []
    const fakeCtx = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "",
      fillStyle: "",
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillRect: vi.fn(),
      drawImage: vi.fn(function (this: typeof fakeCtx) {
        operations.push({
          alpha: fakeCtx.globalAlpha,
          blend: fakeCtx.globalCompositeOperation,
        })
      }),
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeCtx as unknown as RenderingContext
    )
    const expectedBlob = new Blob(["png"], { type: "image/png" })
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      callback: BlobCallback
    ) {
      callback(expectedBlob)
    })

    const container = document.createElement("div")
    const wrapper = document.createElement("div")
    wrapper.style.opacity = "0.5"
    wrapper.style.mixBlendMode = "screen"
    const canvas = document.createElement("canvas")
    canvas.width = 100
    canvas.height = 50
    wrapper.appendChild(canvas)
    container.appendChild(wrapper)
    document.body.appendChild(container)

    const blob = await exportCompositeImage(container, {
      scale: 2,
      mimeType: "image/png",
      quality: 0.9,
    })

    expect(blob).toBe(expectedBlob)
    expect(fakeCtx.fillRect).toHaveBeenCalledWith(0, 0, 200, 100)
    expect(operations).toEqual([{ alpha: 0.5, blend: "screen" }])
    // Estado do contexto restaurado após a composição
    expect(fakeCtx.globalAlpha).toBe(1)
    expect(fakeCtx.globalCompositeOperation).toBe("source-over")
    container.remove()
  })

  it("usa dimensões fixas quando fornecidas, ignorando a escala", async () => {
    const fakeCtx = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "",
      fillStyle: "",
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeCtx as unknown as RenderingContext
    )
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      callback: BlobCallback
    ) {
      callback(new Blob(["png"], { type: "image/png" }))
    })

    const container = document.createElement("div")
    const canvas = document.createElement("canvas")
    canvas.width = 100
    canvas.height = 50
    container.appendChild(canvas)
    document.body.appendChild(container)

    await exportCompositeImage(container, {
      scale: 2,
      width: 1920,
      height: 1080,
      mimeType: "image/png",
      quality: 1,
    })

    // Preset fixo (1920×1080) tem precedência sobre scale=2 (200×100)
    expect(fakeCtx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
    expect(fakeCtx.drawImage).toHaveBeenCalledWith(canvas, 0, 0, 1920, 1080)
    container.remove()
  })

  it("scale é opcional (padrão 1)", async () => {
    const fakeCtx = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "",
      fillStyle: "",
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeCtx as unknown as RenderingContext
    )
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      callback: BlobCallback
    ) {
      callback(new Blob(["png"], { type: "image/png" }))
    })

    const container = document.createElement("div")
    const canvas = document.createElement("canvas")
    canvas.width = 100
    canvas.height = 50
    container.appendChild(canvas)
    document.body.appendChild(container)

    await exportCompositeImage(container, { mimeType: "image/png", quality: 1 })
    expect(fakeCtx.fillRect).toHaveBeenCalledWith(0, 0, 100, 50)
    container.remove()
  })

  it("rejeita quando o blob não pode ser codificado", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "",
      fillStyle: "",
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as RenderingContext)
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      callback: BlobCallback
    ) {
      callback(null)
    })

    const container = document.createElement("div")
    container.appendChild(document.createElement("canvas"))
    document.body.appendChild(container)

    await expect(
      exportCompositeImage(container, { scale: 1, mimeType: "image/png", quality: 1 })
    ).rejects.toThrow("Failed to encode image")
    container.remove()
  })
})
