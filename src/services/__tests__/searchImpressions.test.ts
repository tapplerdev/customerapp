import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

import {
  IMPRESSION_BATCH_MAX,
  createImpressionTracker,
  type ImpressionTrackerOptions,
} from "../searchImpressions"

/*
 * The search impressions tracker on fake timers. `onViewable` stands for the
 * listing's FlashList report, which already comes 200 ms after a card is 50%
 * visible, so "1 s on screen" is a report plus 800 ms here.
 */

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

const make = (options: ImpressionTrackerOptions = {}) => {
  const send = jest.fn<(searchId: string, proIds: number[]) => void>()
  const tracker = createImpressionTracker(send, options)
  return { send, tracker }
}

/** Signed in, a search, the list on screen. */
const onScreen = (options: ImpressionTrackerOptions = {}) => {
  const made = make(options)
  made.tracker.setSearch(A)
  made.tracker.setActive(true)
  return made
}

const advance = (ms: number) => jest.advanceTimersByTime(ms)

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-11-18T10:00:00Z") })
})
afterEach(() => {
  jest.useRealTimers()
})

describe("what counts as seen", () => {
  it("a card on screen for 1 s goes out once, in the next 5 s batch", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([7])
    advance(799)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    advance(1)
    expect(send).not.toHaveBeenCalled()
    advance(5000)
    expect(send.mock.calls).toEqual([[A, [7]]])
    advance(60000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("200 ms on screen counts nothing, nor does 999 ms", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    // Reported (200 ms on screen so far): 7 leaves at once, 8 at 999 ms.
    tracker.onViewable([7, 8, 9])
    tracker.onViewable([8, 9])
    advance(799)
    tracker.onViewable([9])
    advance(60000)
    expect(send.mock.calls).toEqual([[A, [9]]])
  })

  it("a card that leaves and comes back starts over", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([7])
    advance(300)
    tracker.onViewable([])
    advance(200)
    tracker.onViewable([7])
    advance(799)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    advance(1)
    tracker.flush()
    expect(send.mock.calls).toEqual([[A, [7]]])
  })

  it("time while inactive never counts", () => {
    const { send, tracker } = make()
    tracker.setSearch(A)
    // Reported behind the question sheet, for a long time.
    tracker.onViewable([7])
    advance(30000)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)

    // The sheet closes: a full second on screen from now, the list's 200 ms
    // included, since that passed under the sheet.
    tracker.setActive(true)
    advance(999)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    advance(1)
    tracker.flush()
    expect(send.mock.calls).toEqual([[A, [7]]])
  })

  it("going inactive mid-dwell cancels it; the count starts over", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([7])
    advance(700)
    tracker.setActive(false)
    advance(5000)
    tracker.setActive(true)
    advance(999)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    advance(1)
    tracker.flush()
    expect(send.mock.calls).toEqual([[A, [7]]])
  })

  it("a moment covered (a refetch's flash) restarts the count", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([7])
    advance(700)
    tracker.setActive(false)
    advance(50)
    tracker.setActive(true)
    // Not at 800 from the report: 1 s from the moment it was uncovered.
    advance(999)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    advance(1)
    tracker.flush()
    expect(send.mock.calls).toEqual([[A, [7]]])
  })

  it("a report soon after the list goes active waits out what the list missed", () => {
    const { send, tracker } = make()
    tracker.setSearch(A)
    tracker.setActive(true)
    // The list's 200 ms began 150 ms before it was active: 1 s from active.
    advance(50)
    tracker.onViewable([7])
    advance(949)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    advance(1)
    tracker.flush()
    expect(send.mock.calls).toEqual([[A, [7]]])
  })
})

describe("searches", () => {
  it("a new search flushes the old queue under the old id and cancels its timers", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([1, 2])
    advance(800)
    tracker.onViewable([1, 2, 3])
    advance(400)
    expect(send).not.toHaveBeenCalled()

    tracker.setSearch(B)
    expect(send.mock.calls).toEqual([[A, [1, 2]]])
    // Pro 3's dwell died with search A, and A's cards aren't B's.
    advance(60000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)

    // The list reports the new results: the same pro counts again under B.
    tracker.onViewable([1, 3])
    advance(800 + 5000)
    expect(send.mock.calls).toEqual([
      [A, [1, 2]],
      [B, [1, 3]],
    ])
  })

  it("the old results' cards don't count under the new search until the list reports them", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([1, 2])
    // A refetch: the overlay covers the list, the new search arrives, the
    // overlay goes. The list hasn't reported the new results yet.
    tracker.setActive(false)
    tracker.setSearch(B)
    tracker.setActive(true)
    advance(60000)
    expect(send).not.toHaveBeenCalled()
    // FlashList reports them again (recomputeViewableItems).
    tracker.onViewable([2])
    advance(800)
    tracker.flush()
    expect(send.mock.calls).toEqual([[B, [2]]])
  })

  it("a search change restarts the count even for the same search and card", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([1])
    advance(500)
    tracker.setSearch(B)
    tracker.setSearch(A)
    tracker.onViewable([1])
    // Not at 800 from the first report: 800 from the second.
    advance(799)
    tracker.flush()
    expect(send).not.toHaveBeenCalled()
    advance(1)
    tracker.flush()
    expect(send.mock.calls).toEqual([[A, [1]]])
  })
})

describe("guests", () => {
  it("no search id (a guest's listing): nothing is timed or sent", () => {
    const { send, tracker } = make()
    tracker.setSearch(undefined)
    tracker.setActive(true)
    tracker.onViewable([1, 2])
    expect(jest.getTimerCount()).toBe(0)
    advance(60000)
    tracker.dispose()
    expect(send).not.toHaveBeenCalled()
  })

  it("signed out by the time the batch goes: dropped", () => {
    let signedIn = true
    const { send, tracker } = onScreen({ signedIn: () => signedIn })
    advance(1000)
    tracker.onViewable([1])
    advance(800)
    signedIn = false
    advance(5000)
    tracker.dispose()
    expect(send).not.toHaveBeenCalled()
  })
})

describe("batching and dedupe", () => {
  it("cards seen within 5 s go out in one batch", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    // t=1000: 1 and 2 count at 1800, which starts the 5 s window (to 6800).
    tracker.onViewable([1, 2])
    advance(1000)
    tracker.onViewable([2, 3])
    advance(2000)
    tracker.onViewable([4])
    advance(2799)
    expect(send).not.toHaveBeenCalled()
    advance(1)
    expect(send.mock.calls).toEqual([[A, [1, 2, 3, 4]]])
    // A later card starts a window of its own.
    tracker.onViewable([5])
    advance(800 + 4999)
    expect(send).toHaveBeenCalledTimes(1)
    advance(1)
    expect(send.mock.calls).toEqual([
      [A, [1, 2, 3, 4]],
      [A, [5]],
    ])
  })

  it("a pro is never sent twice for one search", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([1])
    advance(800)
    tracker.onViewable([])
    tracker.onViewable([1])
    advance(800)
    tracker.setActive(false)
    tracker.setActive(true)
    advance(1000)
    tracker.flush()
    advance(60000)
    tracker.onViewable([1])
    advance(60000)
    expect(send.mock.calls).toEqual([[A, [1]]])
  })

  it("more pros than one request takes go out in requests of 100", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    const ids = Array.from({ length: 130 }, (_, i) => i + 1)
    tracker.onViewable(ids)
    advance(800)
    tracker.flush()
    expect(send.mock.calls.map(([id, proIds]) => [id, proIds.length])).toEqual([
      [A, IMPRESSION_BATCH_MAX],
      [A, 30],
    ])
  })

  it("dispose flushes and stops every timer", () => {
    const { send, tracker } = onScreen()
    advance(1000)
    tracker.onViewable([1, 2])
    advance(800)
    tracker.onViewable([2, 3])
    tracker.dispose()
    expect(send.mock.calls).toEqual([[A, [1, 2]]])
    expect(jest.getTimerCount()).toBe(0)
  })
})

describe("the app in the background", () => {
  it("the 5 s timer holds the queue until the app is back, then sends it", () => {
    let foreground = true
    const { send, tracker } = onScreen({ inForeground: () => foreground })
    advance(1000)
    tracker.onViewable([1])
    advance(800)
    foreground = false
    tracker.setActive(false)
    advance(20000)
    expect(send).not.toHaveBeenCalled()
    foreground = true
    advance(5000)
    expect(send.mock.calls).toEqual([[A, [1]]])
  })
})
