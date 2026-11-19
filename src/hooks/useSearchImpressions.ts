import { useCallback, useEffect, useRef } from "react"
import { AppState } from "react-native"
import { useFocusEffect } from "@react-navigation/native"

import { api } from "services/api"
import {
  createImpressionTracker,
  type ImpressionTracker,
} from "services/searchImpressions"
import { store } from "store"

/**
 * The listing's search impressions (services/searchImpressions), wired to the
 * screen. `searchId` is the listing response's; `active` is whether the list
 * is on screen (ProsListingScreen builds it from its focus, sheets and
 * overlays). Returns the function the list's existing viewability callback
 * feeds with the viewable pro ids, stable for the screen's life.
 *
 * - Each batch is a fire-and-forget POST (track:false, as chatCache's
 *   markAllAsRead), so a send never re-renders the screen and a failure
 *   never reaches it. Dropped if the customer isn't signed in by then.
 * - The app in the background pauses counting (the dwell timers stop) and
 *   holds the 5 s timer, but never flushes: see the tracker's comment.
 * - Blur flushes the queue (the screen's `active` has already stopped the
 *   dwell timers); unmount flushes and stops everything.
 */
export const useSearchImpressions = ({
  searchId,
  active,
}: {
  searchId?: string
  active: boolean
}) => {
  // Mounted means in the foreground; the listener keeps it current.
  const foreground = useRef(true)
  const tracker = useRef<ImpressionTracker | null>(null)
  if (!tracker.current) {
    tracker.current = createImpressionTracker(
      (id, proIds) => {
        store.dispatch(
          api.endpoints.recordSearchImpressions.initiate(
            { searchId: id, proIds },
            { track: false }
          )
        )
      },
      {
        signedIn: () => store.getState().auth.isAuth,
        inForeground: () => foreground.current,
      }
    )
  }
  const impressions = tracker.current

  // Before `active`: a new search's cards count only once the list reports
  // them under it.
  useEffect(() => {
    impressions.setSearch(searchId)
  }, [impressions, searchId])

  const listActive = useRef(active)
  useEffect(() => {
    listActive.current = active
    impressions.setActive(active && foreground.current)
  }, [impressions, active])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active"
      impressions.setActive(listActive.current && foreground.current)
    })
    return () => subscription.remove()
  }, [impressions])

  useFocusEffect(useCallback(() => () => impressions.flush(), [impressions]))

  useEffect(() => () => impressions.dispose(), [impressions])

  return impressions.onViewable
}
