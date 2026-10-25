import { afterEach, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import { Animated, Dimensions, I18nManager, Platform, View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import TestRenderer from "react-test-renderer"

import CoachMark, {
  useCoachMarkTarget,
  type CoachMarkTarget,
} from "@tappler/shared/src/components/CoachMark"
import {
  cutoutPath,
  placeTooltip,
  roundedRectPath,
} from "@tappler/shared/src/components/CoachMark/geometry"

/*
 * tappler-shared's CoachMark (the tour tip that replaced rn-tourguide). Shared
 * has no jest of its own, so the app that consumes it proves it: the geometry
 * as plain functions, then the component with a target whose measureInWindow
 * answers what a laid-out view would.
 */

const INSETS = { top: 50, bottom: 34, left: 0, right: 0 }
const FRAME = { x: 0, y: 0, width: 390, height: 844 }

type Node = TestRenderer.ReactTestInstance

// jest's window (750 x 1334); the cutout is drawn in the window the Modal reports.
const WINDOW = Dimensions.get("window")

const PHONE = { width: 390, height: 844 }

describe("CoachMark geometry", () => {
  it("draws a rounded rectangle, the radius capped at half the short side", () => {
    expect(roundedRectPath({ x: 10, y: 20, width: 100, height: 40 }, 8)).toBe(
      "M18 20H102A8 8 0 0 1 110 28V52A8 8 0 0 1 102 60H18A8 8 0 0 1 10 52V28A8 8 0 0 1 18 20Z"
    )
    // 40 high: a radius of 99 is a pill of 20.
    expect(roundedRectPath({ x: 0, y: 0, width: 100, height: 40 }, 99)).toContain(
      "A20 20 0 0 1"
    )
  })

  it("subtracts the hole from the window (the even-odd path)", () => {
    expect(
      cutoutPath(PHONE, { x: 10, y: 20, width: 100, height: 40 }, 8)
    ).toBe(
      "M0 0H390V844H0Z" +
        "M18 20H102A8 8 0 0 1 110 28V52A8 8 0 0 1 102 60H18A8 8 0 0 1 10 52V28A8 8 0 0 1 18 20Z"
    )
  })

  const hole = { x: 20, y: 300, width: 350, height: 100 }
  const base = {
    hole,
    window: PHONE,
    insets: { top: 50, bottom: 34 },
    gap: 12,
    tooltipHeight: 200,
    margin: 16,
  }

  it("puts the tooltip a gap under the hole, or over it", () => {
    expect(placeTooltip({ ...base, placement: "below" })).toEqual({
      top: 412,
      side: "below",
    })
    expect(placeTooltip({ ...base, placement: "above" })).toEqual({
      top: 88,
      side: "above",
    })
  })

  it("lets a negative gap overlap the target", () => {
    expect(placeTooltip({ ...base, placement: "below", gap: -55 }).top).toBe(345)
  })

  it("auto takes the side it fits on, else the roomier one", () => {
    expect(placeTooltip({ ...base, placement: "auto" }).side).toBe("below")
    // Hole near the bottom: below has no room, above does.
    expect(
      placeTooltip({
        ...base,
        placement: "auto",
        hole: { x: 20, y: 600, width: 350, height: 150 },
      }).side
    ).toBe("above")
    // Fits on neither: the bigger side (below has 844-34-400 = 410).
    expect(
      placeTooltip({ ...base, placement: "auto", tooltipHeight: 500 }).side
    ).toBe("below")
  })

  it("keeps the tooltip inside the safe area", () => {
    // Below the hole there is 844-34-(600+150) = 60 left: pulled up to fit.
    const low = placeTooltip({
      ...base,
      placement: "below",
      hole: { x: 20, y: 600, width: 350, height: 150 },
    })
    expect(low.top).toBe(844 - 34 - 16 - 200)
    // Above a hole at the top: pushed down under the status bar.
    const high = placeTooltip({
      ...base,
      placement: "above",
      hole: { x: 20, y: 80, width: 350, height: 100 },
    })
    expect(high.top).toBe(50 + 16)
  })
})

const makeTarget = (frame: typeof FRAME | (() => typeof FRAME)) => {
  const view = {
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
      const f = typeof frame === "function" ? frame() : frame
      cb(f.x, f.y, f.width, f.height)
    },
  }
  return view as unknown as View
}

type Harness = {
  target: CoachMarkTarget | null
  setTargetView: (view: View | null) => void
}

const mount = (
  props: Partial<React.ComponentProps<typeof CoachMark>> & { visible: boolean },
  view: View | null = makeTarget({ x: 20, y: 300, width: 350, height: 100 })
) => {
  const harness: Harness = { target: null, setTargetView: () => undefined }
  const Host = (p: typeof props) => {
    const target = useCoachMarkTarget()
    harness.target = target
    ;(target.ref as React.MutableRefObject<View | null>).current = view
    return (
      <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: INSETS }}>
        <CoachMark onDismiss={() => undefined} {...p} target={target}>
          <View testID="tip" />
        </CoachMark>
      </SafeAreaProvider>
    )
  }
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(<Host {...props} />)
  })
  mounted.push(renderer)
  return {
    renderer,
    harness,
    update: (next: typeof props) =>
      act(() => {
        renderer.update(<Host {...next} />)
      }),
    modal: () => renderer.root.findAll((n) => String(n.type) === "Modal")[0] as Node | undefined,
  }
}

const settle = () => act(async () => { await Promise.resolve() })

const mounted: TestRenderer.ReactTestRenderer[] = []
afterEach(() => {
  // Unmounted so the modal hook's backstop timer can't fire into the next test.
  mounted.splice(0).forEach((r) => act(() => r.unmount()))
  I18nManager.isRTL = false
  Platform.OS = "ios"
})

describe("CoachMark", () => {
  it("draws nothing while it is not visible", () => {
    const m = mount({ visible: false })
    expect(m.modal()).toBeUndefined()
    expect(m.renderer.root.findAllByProps({ fillRule: "evenodd" })).toHaveLength(0)
  })

  it("opens over the measured target: a dim with the hole, and the tooltip", async () => {
    const m = mount({ visible: true, borderRadius: 20, padding: 2 })
    await settle()
    expect(m.modal()).toBeDefined()
    const path = m.renderer.root.findByProps({ fillRule: "evenodd" })
    expect(path.props.d).toBe(
      cutoutPath(WINDOW, { x: 18, y: 298, width: 354, height: 104 }, 20)
    )
    expect(path.props.fillOpacity).toBe(0.7)
    expect(m.renderer.root.findAllByProps({ testID: "tip" }).length).toBeGreaterThan(0)
  })

  it("waits for a target that is not laid out yet, and opens when it is", async () => {
    let frame = { x: 0, y: 0, width: 0, height: 0 }
    const m = mount({ visible: true }, makeTarget(() => frame))
    await settle()
    expect(m.modal()).toBeUndefined()
    frame = { x: 20, y: 300, width: 350, height: 100 }
    await act(async () => {
      m.harness.target!.onLayout()
    })
    expect(m.modal()).toBeDefined()
  })

  it("measures again when the target is laid out again while it is open", async () => {
    let frame = { x: 20, y: 300, width: 350, height: 100 }
    const m = mount({ visible: true, borderRadius: 10 }, makeTarget(() => frame))
    await settle()
    frame = { x: 20, y: 420, width: 350, height: 100 }
    await act(async () => {
      m.harness.target!.onLayout()
    })
    expect(m.renderer.root.findByProps({ fillRule: "evenodd" }).props.d).toBe(
      cutoutPath(WINDOW, frame, 10)
    )
  })

  it("does not mirror the cutout or the tooltip's gutters in RTL", async () => {
    I18nManager.isRTL = true
    const m = mount({ visible: true })
    await settle()
    expect(m.renderer.root.findByProps({ fillRule: "evenodd" }).props.d).toBe(
      cutoutPath(WINDOW, { x: 20, y: 300, width: 350, height: 100 }, 12)
    )
    // The tooltip is placed by top and a symmetric left/right pair only.
    const tip = m.renderer.root.findByProps({ testID: "tip" }).parent!.parent!
    const style = Object.assign({}, ...[tip.props.style].flat(5).filter(Boolean))
    expect(style.left).toBe(style.right)
    expect(style.start).toBeUndefined()
    expect(style.end).toBeUndefined()
  })

  it("hides the tooltip until its height is known, then places it by that height", async () => {
    const m = mount({ visible: true, placement: "below", gap: 12 })
    await settle()
    const tip = () => m.renderer.root.findByProps({ testID: "tip" }).parent!.parent!
    const flat = (n: Node) => Object.assign({}, ...[n.props.style].flat(5).filter(Boolean))
    expect(flat(tip()).opacity).toBe(0)
    act(() => {
      tip().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } })
    })
    // Under the hole (300 + 100) and its gap, whole inside the safe area.
    expect(flat(tip()).top).toBe(412)
  })

  it("raises the tooltip into place once it is measured", async () => {
    const timing = jest.spyOn(Animated, "timing")
    try {
      const m = mount({ visible: true, placement: "below", gap: 12 })
      await settle()
      const tip = () => m.renderer.root.findByProps({ testID: "tip" }).parent!.parent!
      const flat = (n: Node) => Object.assign({}, ...[n.props.style].flat(5).filter(Boolean))
      // Nothing moves before the tooltip's height is known.
      expect(timing).not.toHaveBeenCalled()
      act(() => {
        tip().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } })
      })
      // It starts lowered and clear, and rises on the native driver over 1 s
      // (the end values live on the UI thread, out of the test renderer's reach).
      expect(flat(tip()).opacity).toBe(0)
      expect(flat(tip()).transform).toEqual([{ translateY: 16 }])
      expect(timing).toHaveBeenCalledTimes(1)
      expect(timing.mock.calls[0][1]).toMatchObject({
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    } finally {
      timing.mockRestore()
    }
  })

  it("asks onDismiss on Android back, and on the dim only when it is allowed", async () => {
    const onDismiss = jest.fn()
    const m = mount({ visible: true, onDismiss })
    await settle()
    act(() => {
      m.modal()!.props.onRequestClose()
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    const dim = () => m.renderer.root.findAllByProps({ accessible: false })[0]
    expect(dim().props.onPress).toBeUndefined()
    m.update({ visible: true, onDismiss, dismissOnBackdropPress: true })
    act(() => {
      dim().props.onPress()
    })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it("never closes itself: visible is the caller's", async () => {
    const onDismiss = jest.fn()
    const m = mount({ visible: true, onDismiss })
    await settle()
    act(() => {
      m.modal()!.props.onRequestClose()
    })
    expect(m.modal()!.props.visible).toBe(true)
  })

  it("reports onModalHide once, after it has closed (Android: right after the commit)", async () => {
    Platform.OS = "android"
    const onModalHide = jest.fn()
    const m = mount({ visible: true, onModalHide })
    await settle()
    expect(m.modal()!.props.visible).toBe(true)
    m.update({ visible: false, onModalHide })
    expect(onModalHide).toHaveBeenCalledTimes(1)
    // Gone: no Modal left in the tree.
    expect(m.modal()).toBeUndefined()
  })

  it("on iOS waits for the dismiss (or its backstop) before reporting it", async () => {
    jest.useFakeTimers()
    Platform.OS = "ios"
    const onModalHide = jest.fn()
    const m = mount({ visible: true, onModalHide })
    await settle()
    act(() => {
      m.modal()!.props.onShow()
    })
    m.update({ visible: false, onModalHide })
    // Closing: the Modal is told visible=false (jest's stand-in then draws
    // nothing), and the hide is not reported until iOS says it is gone.
    expect(onModalHide).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(onModalHide).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
