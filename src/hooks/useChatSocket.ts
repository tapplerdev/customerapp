import { useCallback, useEffect, useRef } from "react"
import { AppState } from "react-native"
import { useDispatch, useStore } from "react-redux"

import { api } from "services/api"
import {
  applyIncomingMessage,
  applyReadReceipts,
  getActiveChat,
} from "services/chatCache"
import { messageBannerEventBus } from "events/messageBannerEventBus"
import { WebSocketService } from "services/WebSocketService"
import { RootState, useTypedSelector } from "store"
import { createSocketAppStatePlanner } from "utils/socketAppState"

/**
 * Live chat over WebSockets for the customer app — the lean twin of the
 * proapp's useNotificationProcessor, scoped to chat only (no FCM / notification
 * tag machinery). Mount ONCE, globally (App.tsx), so a single socket + a single
 * set of listeners serve every screen.
 *
 * The backend emits `message.created` / `message.updatedMany` to the
 * `customer:<id>` room; those carry the full message, so we MUTATE the RTK
 * Query cache directly via chatCache (list preview, unread, ordering, and the
 * open chat's message page all update in the same tick). Tag invalidation is
 * reserved for reconnect/foreground reconciliation and unknown-chat fallback.
 */
export const useChatSocket = () => {
  const dispatch = useDispatch()
  const store = useStore()
  const { isAuth, token, user } = useTypedSelector((store) => store.auth)
  // Kept across the effect's re-runs (a refresh changes the token), so a
  // return from the background is still seen as one.
  const planAppState = useRef(createSocketAppStatePlanner())
  // The token as it is now, read on every connect attempt (the manager's own
  // reconnects too), so a reconnect after a refresh presents the new token
  // and one after a logout presents none rather than the old one.
  const getToken = useCallback(
    () => (store.getState() as RootState).auth.token,
    [store]
  )

  // --- Connection lifecycle (auth-driven) ---------------------------------
  useEffect(() => {
    if (isAuth && token && user?.id) {
      WebSocketService.connect({
        token,
        getToken,
        userId: user.id,
        userType: "customer",
      })
    } else {
      WebSocketService.disconnect()
    }
    return () => WebSocketService.disconnect()
  }, [isAuth, token, user?.id, getToken])

  // --- Foreground/background (utils/socketAppState): disconnect on
  //     background, not on iOS `inactive`; reconnect on active; reconcile the
  //     chat list for anything missed only after a real return from the
  //     background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const step = planAppState.current(next)
      if (step.connectIfDown) {
        if (isAuth && token && user?.id && !WebSocketService.isConnected()) {
          WebSocketService.connect({
            token,
            getToken,
            userId: user.id,
            userType: "customer",
          })
        }
      }
      if (step.refetch) {
        dispatch(api.util.invalidateTags(["Chats", "Notifications"]))
      }
      if (step.disconnect) {
        WebSocketService.disconnect()
      }
    })
    return () => sub.remove()
  }, [isAuth, token, user?.id, dispatch, getToken])

  // --- Message events (the 'event' channel carries message.* with full body)
  useEffect(() => {
    if (!isAuth) return

    const handler = (data: { eventName: string; args: any[] }) => {
      if (data.eventName === "message.created") {
        const wsMessage = data.args?.[0]?.body
        const applied = applyIncomingMessage(
          dispatch,
          store.getState,
          wsMessage
        )
        // Unknown chat (brand-new conversation not in any cached list) or a
        // slim payload — one targeted refetch of the list.
        if (!applied) {
          dispatch(api.util.invalidateTags(["Chats"]))
        }
        // Offer revision system message: the chat header's offer badge reads
        // ratePerHour out of the chat payload — refetch so it flips the same
        // moment the offer card lands in the thread.
        if (
          typeof wsMessage?.text === "string" &&
          wsMessage.text.startsWith("offer_updated:")
        ) {
          // OfferHistory too: the revision the customer is being told about is
          // a new row in that list, and this is the only signal on this side
          // that it changed — the customer never revises anything themselves.
          dispatch(api.util.invalidateTags(["Chats", "OfferHistory"]))
        }

        // In-app banner: only for a PRO's message (incoming), and only when
        // the customer is NOT already looking at that chat. Look the chat up
        // in the getChats cache so the banner can open it on tap.
        const chatId = wsMessage?.chatId
        if (
          wsMessage?.ownerType === "pro" &&
          chatId &&
          chatId !== getActiveChat()
        ) {
          const chats = api.endpoints.getChats.select(undefined)(
            store.getState() as any
          )?.data?.data
          const chatPreview = chats?.find((c) => c.chat.id === chatId)
          if (chatPreview && wsMessage.text) {
            messageBannerEventBus.emit("message:new", {
              chatPreview,
              body: wsMessage.text,
            })
          }
        }
      } else if (data.eventName === "message.updatedMany") {
        // Read receipts. The batch goes to both sides of the chat: one of
        // only the pro's messages is the echo of this customer's own
        // mark-as-read, with nothing to show here, so it is skipped (as
        // proapp skips its mirror). Otherwise the pro read the customer's
        // messages, and their readAt is written into the cached pages.
        // Nothing else refreshes it while the socket is up: the open
        // thread's poll runs only with the socket down.
        const batch = data.args?.[0]?.body
        const isOwnReadEcho =
          Array.isArray(batch) &&
          batch.length > 0 &&
          batch.every((m: any) => m?.ownerType === "pro")
        if (Array.isArray(batch) && !isOwnReadEcho) {
          applyReadReceipts(dispatch, store.getState, batch)
        }
      }
    }

    WebSocketService.on("event", handler)
    return () => {
      WebSocketService.off("event", handler)
    }
  }, [isAuth, dispatch, store])

  // --- Job events (offers arriving, opportunity selections, …): the backend
  //     notifies the customer with `system.job:*` events, but nothing was
  //     invalidating the Jobs cache — so the job DETAIL (Other Pros tab)
  //     stayed a pre-offer snapshot until app restart. Invalidate Jobs so a
  //     mounted screen refetches instantly and unmounted caches refetch on
  //     next open. (The Talabati LIST already self-heals via 30s polling.)
  //     Every notification event is also persisted server-side, so the bell
  //     badge + NotificationsScreen refetch on the same signal.
  useEffect(() => {
    if (!isAuth) return
    const handler = (payload: any) => {
      dispatch(api.util.invalidateTags(["Notifications"]))
      const event = typeof payload?.event === "string" ? payload.event : ""
      if (event.startsWith("system.job:")) {
        // Chats as well as Jobs: a chat preview carries its own copy of the
        // job, and useChatContext derives isJobInactive from
        // chat.job.status — so a food order settling to `completed` on
        // delivery would leave the chat screen acting on a stale `active` for
        // an indeterminate window. Same order, two screens, two answers.
        dispatch(api.util.invalidateTags(["Jobs", "Chats"]))
      }

      // Slide-down banner for everything except chat messages, which belong to
      // the "message:new" banner above (it has the pro's avatar and opens the
      // thread). Title and body come resolved and localised from the backend,
      // so nothing is translated client-side.
      //
      // A body is required, not just one of the two. An unseeded config row is
      // synthesised server-side as empty strings rather than skipped, so a
      // half-configured event arrives as a notification with nothing to say —
      // better to drop it than to render a bold title over a blank line.
      if (!event.startsWith("system.messages:") && payload?.body) {
        messageBannerEventBus.emit("notification:new", {
          event,
          title: payload.title ?? "",
          body: payload.body,
          jobId: typeof payload?.jobId === "number" ? payload.jobId : undefined,
          jobStatus:
            typeof payload?.job?.status === "string"
              ? payload.job.status
              : undefined,
          // Top-level, not payload.job.pros — the backend omits `pros` from
          // the job it sends, so digging for it there always yields undefined.
          foodStatus:
            typeof payload?.foodOrderStatus === "string"
              ? payload.foodOrderStatus
              : undefined,
        })
      }
    }
    WebSocketService.on("notification", handler)
    return () => {
      WebSocketService.off("notification", handler)
    }
  }, [isAuth, dispatch])

  // --- Reconnect reconciliation: events missed while the socket was down are
  //     never replayed — refetch the chat list AND jobs to catch up.
  useEffect(() => {
    if (!isAuth) return
    const reconcile = () =>
      dispatch(api.util.invalidateTags(["Chats", "Jobs", "Notifications"]))
    WebSocketService.on("connected", reconcile)
    WebSocketService.on("reconnected", reconcile)
    return () => {
      WebSocketService.off("connected", reconcile)
      WebSocketService.off("reconnected", reconcile)
    }
  }, [isAuth, dispatch])
}
