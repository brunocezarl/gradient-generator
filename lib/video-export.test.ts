import { describe, it, expect } from "vitest"
import { planVideoExport } from "./video-export"

describe("planVideoExport — free animation", () => {
  it("derives the frame count from duration and FPS", () => {
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

  it("respects the preview speed in the animation step", () => {
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
    // Same frame count, but each frame advances twice as far in animation time:
    // the file keeps the rhythm seen on screen
    expect(fast.frameCount).toBe(normal.frameCount)
    expect(fast.animationStep).toBeCloseTo(normal.animationStep * 2)
  })

  it("clamps absurd inputs instead of producing an impossible plan", () => {
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

describe("planVideoExport — closed loop", () => {
  it("covers a whole number of cycles", () => {
    // An 8s loop requested as 6s of video: one whole cycle beats 3/4 of a cycle,
    // which would show the cut
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

  it("repeats the loop when the requested duration is much longer", () => {
    const plan = planVideoExport({
      requestedDuration: 12,
      fps: 30,
      loopDuration: 4,
      speed: 1,
    })
    expect(plan.videoDuration).toBeCloseTo(12)
    expect(plan.frameCount).toBe(360)
  })

  it("the frame after the last one closes the cycle exactly", () => {
    const loopDuration = 6
    const plan = planVideoExport({
      requestedDuration: 6,
      fps: 24,
      loopDuration,
      speed: 1,
    })
    // The instant of the frame that is *not* recorded coincides with the start:
    // that is what makes the seam disappear without duplicating a frame
    const wrapTime = plan.frameCount * plan.animationStep
    expect(wrapTime).toBeCloseTo(loopDuration, 10)
  })

  it("speed shortens each cycle without breaking the close", () => {
    // An 8s animation loop at 2× lasts 4s of video, so 4s requested is exactly
    // one cycle
    const single = planVideoExport({
      requestedDuration: 4,
      fps: 30,
      loopDuration: 8,
      speed: 2,
    })
    expect(single.videoDuration).toBeCloseTo(4)
    expect(single.frameCount * single.animationStep).toBeCloseTo(8, 10)

    // And 8s requested fits two whole cycles — the requested duration is honored
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
