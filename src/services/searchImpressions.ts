/**
 * Search impressions (My Performance): which pros' cards a signed-in customer
 * actually saw on a listing, sent to POST
 * /customers/service-search/:searchId/impressions (backend #518). No React and
 * no RTK in here, so it runs under fake timers on its own; the screen side is
 * hooks/useSearchImpressions.
 *
 * What counts as seen. ProsListingScreen's FlashList already reports the cards
 * that have been at least 50% visible for 200 ms (its prefetch callback). The
 * tracker waits another 800 ms on top of that, so a card counts after 1 s on
 * screen, and only while the list is `active`: focused, nothing covering it,
 * not refetching. Time while inactive never counts. When the list becomes
 * active again, a card it reported earlier waits the list's 200 ms as well,
 * because that part may have passed under a sheet.
 *
 * Each dwell timer belongs to the search it started under. A new search
 * cancels them all and forgets the visible cards (they were the old
 * results), so the new results count only once the list reports them.
 *
 * Counted once per (searchId, pro). The queue goes out every 5 s, and the
 * screen also flushes it on blur and unmount. A new search flushes the old
 * queue first, under the old id. Sign-in is checked when a batch goes out; a
 * signed-out batch is dropped. The 5 s timer also waits while the app is in
 * the background: a request then could rotate the refresh token just as iOS
 * suspends JS, which signs the customer out on the next refresh.
 */

/** On top of the list's own 200 ms, so a card counts after 1 s on screen. */
export const IMPRESSION_DWELL_MS = 800
/** The list's minimumViewTime (ProsListingScreen's viewabilityConfig). */
export const IMPRESSION_LIST_MS = 200
export const IMPRESSION_FLUSH_MS = 5000
/** The most pro ids the endpoint takes in one request. */
export const IMPRESSION_BATCH_MAX = 100

export type ImpressionTrackerOptions = {
  dwellMs?: number
  listMs?: number
  flushMs?: number
  /** Read when a batch goes out: false drops it. */
  signedIn?: () => boolean
  /** Read when the 5 s timer fires: false waits another round. */
  inForeground?: () => boolean
}

export type ImpressionTracker = {
  /** The listing's current search; a change flushes the old one's queue. */
  setSearch: (searchId?: string) => void
  /** Whether the list is on screen. False cancels the running dwell timers. */
  setActive: (active: boolean) => void
  /** The pros the list reports as viewable now (all of them, not a diff). */
  onViewable: (proIds: number[]) => void
  /** Send the queue now (blur). */
  flush: () => void
  /** Flush and stop every timer (unmount). */
  dispose: () => void
}

type Timer = ReturnType<typeof setTimeout>

export const createImpressionTracker = (
  send: (searchId: string, proIds: number[]) => void,
  {
    dwellMs = IMPRESSION_DWELL_MS,
    listMs = IMPRESSION_LIST_MS,
    flushMs = IMPRESSION_FLUSH_MS,
    signedIn = () => true,
    inForeground = () => true,
  }: ImpressionTrackerOptions = {}
): ImpressionTracker => {
  let searchId: string | undefined
  let active = false
  let activeSince = 0
  let visible = new Set<number>()
  const dwell = new Map<number, Timer>()
  // Every (searchId, pro) already counted, queued or sent.
  const counted = new Set<string>()
  // Pro ids waiting to go out, by the search they were seen in.
  const queue = new Map<string, number[]>()
  let flushTimer: Timer | null = null

  const keyOf = (id: string, proId: number) => `${id}:${proId}`

  const cancelDwell = (keep: (proId: number) => boolean = () => false) => {
    dwell.forEach((timer, proId) => {
      if (keep(proId)) return
      clearTimeout(timer)
      dwell.delete(proId)
    })
  }

  const flush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    if (queue.size === 0) return
    const batches = [...queue]
    queue.clear()
    if (!signedIn()) return
    batches.forEach(([id, proIds]) => {
      for (let i = 0; i < proIds.length; i += IMPRESSION_BATCH_MAX) {
        send(id, proIds.slice(i, i + IMPRESSION_BATCH_MAX))
      }
    })
  }

  const onFlushTimer = () => {
    flushTimer = null
    if (inForeground()) flush()
    else flushTimer = setTimeout(onFlushTimer, flushMs)
  }

  const enqueue = (id: string, proId: number) => {
    queue.set(id, [...(queue.get(id) ?? []), proId])
    if (!flushTimer) flushTimer = setTimeout(onFlushTimer, flushMs)
  }

  const startDwell = (proId: number) => {
    if (!active || !searchId || dwell.has(proId)) return
    if (counted.has(keyOf(searchId, proId))) return
    const startedUnder = searchId
    // The part of the list's 200 ms that passed before the list was active.
    const missed = Math.max(0, listMs - (Date.now() - activeSince))
    dwell.set(
      proId,
      setTimeout(() => {
        dwell.delete(proId)
        if (!active || searchId !== startedUnder || !visible.has(proId)) return
        const key = keyOf(startedUnder, proId)
        if (counted.has(key)) return
        counted.add(key)
        enqueue(startedUnder, proId)
      }, dwellMs + missed)
    )
  }

  const setSearch = (next?: string) => {
    if (next === searchId) return
    flush()
    cancelDwell()
    searchId = next
    visible = new Set()
  }

  const setActive = (next: boolean) => {
    if (next === active) return
    active = next
    if (!active) {
      cancelDwell()
      return
    }
    activeSince = Date.now()
    visible.forEach(startDwell)
  }

  const onViewable = (proIds: number[]) => {
    visible = new Set(proIds)
    cancelDwell((proId) => visible.has(proId))
    visible.forEach(startDwell)
  }

  // Back to the state it was made in, but for what was counted, so effects
  // that run again (React's dev double run) pick up where they were.
  const dispose = () => {
    flush()
    cancelDwell()
    searchId = undefined
    active = false
    visible = new Set()
  }

  return { setSearch, setActive, onViewable, flush, dispose }
}
