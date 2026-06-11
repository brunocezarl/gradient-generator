import { describe, it, expect } from "vitest"
import { codecCandidates, evenDimensions, isWebCodecsSupported } from "./offline-video"

describe("codecCandidates", () => {
  it("oferece apenas H.264 (avc1) para MP4", () => {
    const candidates = codecCandidates("mp4")
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((codec) => codec.startsWith("avc1."))).toBe(true)
  })

  it("oferece VP9 com fallback para VP8 em WebM", () => {
    const candidates = codecCandidates("webm")
    expect(candidates[0]).toMatch(/^vp09\./)
    expect(candidates).toContain("vp8")
  })

  it("ordena do nível mais alto para o mais baixo (preferir capacidade 4K/60fps)", () => {
    const [first, second] = codecCandidates("mp4")
    expect(first > second).toBe(true)
  })
})

describe("evenDimensions", () => {
  it("mantém dimensões já pares", () => {
    expect(evenDimensions(1920, 1080)).toEqual({ width: 1920, height: 1080 })
  })

  it("arredonda dimensões ímpares para baixo (yuv420 exige pares)", () => {
    expect(evenDimensions(1921, 1081)).toEqual({ width: 1920, height: 1080 })
  })

  it("nunca retorna menos que 2", () => {
    expect(evenDimensions(1, 0)).toEqual({ width: 2, height: 2 })
  })
})

describe("isWebCodecsSupported", () => {
  it("retorna false quando VideoEncoder não existe (ambiente node)", () => {
    expect(isWebCodecsSupported()).toBe(false)
  })
})
