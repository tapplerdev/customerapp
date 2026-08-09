import { useEffect, useRef } from "react"
import { AppState } from "react-native"
import { useDispatch, useStore } from "react-redux"

import { api } from "services/api"
import { applyIncomingMessage, getActiveChat } from "services/chatCache"
import { messageBannerEventBus } from "events/messageBannerEventBus"
import { WebSocketService } from "services/WebSocketService"
import { useTypedSelector } from "store"

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
  const appState = useRef(AppState.currentState)

  // --- Connection lifecycle (auth-driven) ---------------------------------
  useEffect(() => {
    if (isAuth && token && user?.id) {
      WebSocketService.connect({ token, userId: user.id, userType: "customer" })
    } else {
      WebSocketService.disconnect()
    }
    return () => WebSocketService.disconnect()
  }, [isAuth, token, user?.id])

  // --- Foreground/background: disconnect on background (battery), reconnect
  //     on foreground, and reconcile the chat list for anything missed while
  //     the socket was down.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        if (isAuth && token && user?.id && !WebSocketService.isConnected()) {
          WebSocketService.connect({ token, userId: user.id, userType: "customer" })
        }
        dispatch(api.util.invalidateTags(["Chats", "Notifications"]))
      } else if (next.match(/inactive|background/)) {
        WebSocketService.disconnect()
      }
      appState.current = next
    })
    return () => sub.remove()
  }, [isAuth, token, user?.id, dispatch])

  // --- Message events (the 'event' channel carries message.* with full body)
  useEffect(() => {
    if (!isAuth) return

    const handler = (data: { eventName: string; args: any[] }) => {
      if (data.eventName === "message.created") {
        const wsMessage = data.args?.[0]?.body
        const applied = applyIncomingMessage(dispatch, store.getState, wsMessage)
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
          dispatch(api.util.invalidateTags(["Chats"]))
        }

        // In-app banner: only for a PRO's message (incoming), and only when
        // the customer is NOT already looking at that chat. Look the chat up
        // in the getChats cache so the banner can open it on tap.
        const chatId = wsMessage?.chatId
        if (wsMessage?.ownerType === "pro" && chatId && chatId !== getActiveChat()) {
          const chats = api.endpoints.getChats.select(undefined)(store.getState() as any)?.data?.data
          const chatPreview = chats?.find((c) => c.chat.id === chatId)
          if (chatPreview && wsMessage.text) {
            messageBannerEventBus.emit("message:new", { chatPreview, body: wsMessage.text })
          }
        }
      }
      // message.updatedMany (read receipts on the customer's own messages) is
      // intentionally not handled here: the customerapp's getChatMessages
      // carries no cache tag, and the in-chat fallback poll / focus refetch
      // already refresh read state for the open thread.
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
        dispatch(api.util.invalidateTags(["Jobs"]))
      }

      // Slide-down banner for everything except chat messages, which already
      // get one from the message handler above — routing them here too would
      // stack a second banner on top of it. Title and body come resolved and
      // localised from the backend, so nothing is translated client-side.
      if (
        !event.startsWith("system.messages:") &&
        (payload?.title || payload?.body)
      ) {
        messageBannerEventBus.emit("notification:new", {
          title: payload.title ?? "",
          body: payload.body ?? "",
          jobId: typeof payload?.jobId === "number" ? payload.jobId : undefined,
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
