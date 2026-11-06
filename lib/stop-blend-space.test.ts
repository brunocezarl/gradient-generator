// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"
import { insertStop } from "@/lib/color-stops"
import { useGradientStore } from "@/lib/store"

const initialState = useGradientStore.getState()
const redBlue = [
  { color: [1, 0, 0] as [number, number, number], position: 0 },
  { color: [0, 0, 1] as [number, number, number], position: 1 },
]

afterEach(() => useGradientStore.setState(initialState, true))

describe("inserting a stop in the selected blend space", () => {
  it("uses linear RGB through the store's blend-space selection", () => {
    useGradientStore.getState().setStops(redBlue)
    useGradientStore.getState().setBlendSpace("linear")
    useGradientStore.getState().addStop()

    const stops = useGradientStore.getState().customStops
    expect(stops.map((stop) => stop.position)).toEqual([0, 0.5, 1])
    expect(stops[1].color[0]).toBeCloseTo(0.73536, 5)
    expect(stops[1].color[1]).toBeCloseTo(0, 5)
    expect(stops[1].color[2]).toBeCloseTo(0.73536, 5)
  })

  it("keeps Oklab as the default and respects selecting it in the store", () => {
    const oklab = insertStop(redBlue)[1].color
    expect(oklab).toEqual(insertStop(redBlue, "oklab")[1].color)
    expect(oklab[0]).not.toBeCloseTo(0.73536, 2)

    useGradientStore.getState().setStops(redBlue)
    useGradientStore.getState().setBlendSpace("oklab")
    useGradientStore.getState().addStop()
    expect(useGradientStore.getState().customStops[1].color).toEqual(oklab)
  })
})
