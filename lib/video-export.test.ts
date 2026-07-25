import { describe, it, expect } from "vitest"
import { planVideoExport } from "./video-export"

describe("planVideoExport — animação livre", () => {
  it("deriva a contagem de frames da duração e do FPS", () => {
    const plan = planVideoExport({
      requestedDuration: 6,
      fps: 30,
      loopDuration: 0,
      speed: 1,
    })
    expect(plan.frameCount).toBe(180)
    expect(plan.videoDuration).toBeCloseTo(6)
    expect(plan.loopExact).toBe(false)
  })

  it("respeita a velocidade de preview no avanço da animação", () => {
    const normal = planVideoExport({
      requestedDuration: 4,
      fps: 30,
      loopDuration: 0,
      speed: 1,
    })
    const fast = planVideoExport({
      requestedDuration: 4,
      fps: 30,
      loopDuration: 0,
      speed: 2,
    })
    // Mesma quantidade de frames, mas cada frame avança o dobro no tempo da
    // animação: o arquivo tem o ritmo que se vê na tela
    expect(fast.frameCount).toBe(normal.frameCount)
    expect(fast.animationStep).toBeCloseTo(normal.animationStep * 2)
  })

  it("satura entradas absurdas em vez de gerar um plano impossível", () => {
    const plan = planVideoExport({
      requestedDuration: 100_000,
      fps: 1000,
      loopDuration: 0,
      speed: 500,
    })
    expect(plan.frameCount).toBeLessThanOrEqual(600 * 120)
    expect(Number.isFinite(plan.animationStep)).toBe(true)

    const tiny = planVideoExport({
      requestedDuration: 0,
      fps: 0,
      loopDuration: 0,
      speed: 0,
    })
    expect(tiny.frameCount).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(tiny.animationStep)).toBe(true)
  })
})

describe("planVideoExport — loop fechado", () => {
  it("cobre um número inteiro de ciclos", () => {
    // Loop de 8s pedido em 6s de vídeo: um ciclo inteiro é melhor que 3/4 de
    // ciclo, que mostraria o corte
    const plan = planVideoExport({
      requestedDuration: 6,
      fps: 30,
      loopDuration: 8,
      speed: 1,
    })
    expect(plan.loopExact).toBe(true)
    expect(plan.videoDuration).toBeCloseTo(8)
    expect(plan.frameCount).toBe(240)
  })

  it("repete o loop quando a duração pedida é bem maior", () => {
    const plan = planVideoExport({
      requestedDuration: 12,
      fps: 30,
      loopDuration: 4,
      speed: 1,
    })
    expect(plan.videoDuration).toBeCloseTo(12)
    expect(plan.frameCount).toBe(360)
  })

  it("o frame seguinte ao último fecha exatamente o ciclo", () => {
    const loopDuration = 6
    const plan = planVideoExport({
      requestedDuration: 6,
      fps: 24,
      loopDuration,
      speed: 1,
    })
    // O instante do frame que *não* é gravado coincide com o início: é isso
    // que faz a emenda desaparecer sem duplicar um quadro
    const wrapTime = plan.frameCount * plan.animationStep
    expect(wrapTime).toBeCloseTo(loopDuration, 10)
  })

  it("a velocidade encurta cada ciclo, sem quebrar o fechamento", () => {
    // Um loop de 8s de animação a 2× dura 4s de vídeo, então 4s pedidos são
    // exatamente um ciclo
    const single = planVideoExport({
      requestedDuration: 4,
      fps: 30,
      loopDuration: 8,
      speed: 2,
    })
    expect(single.videoDuration).toBeCloseTo(4)
    expect(single.frameCount * single.animationStep).toBeCloseTo(8, 10)

    // E 8s pedidos cabem dois ciclos inteiros — a duração pedida é respeitada
    const double = planVideoExport({
      requestedDuration: 8,
      fps: 30,
      loopDuration: 8,
      speed: 2,
    })
    expect(double.videoDuration).toBeCloseTo(8)
    expect(double.frameCount * double.animationStep).toBeCloseTo(16, 10)
  })
})
