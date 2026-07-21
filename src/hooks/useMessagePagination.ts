import { useCallback, useEffect, useRef, useState } from "react"
import { LayoutAnimation } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { useDispatch, useStore } from "react-redux"
import { ChatMessageType } from "types/chat"
import { scheduleLayoutAnimation } from "helpers/layoutAnimation"
import {
  useGetChatMessagesQuery,
  useMarkAllAsReadMutation,
} from "services/api"
import { WebSocketService } from "services/WebSocketService"
import { applyCounterpartLastSeen, setActiveChat } from "services/chatCache"

const POLL_INTERVAL = 10000 // 10 seconds

// Slide-up for message arrival: the new bubble fades in at the bottom while
// the existing rows get pushed up smoothly (Airbnb/iMessage feel). Applied to
// live inserts only — never pagination (older pages load offscreen at the top).
// Scheduled via scheduleLayoutAnimation, which owns the Android experimental
// flag and coalesces same-frame schedules (no override warnings).
const MESSAGE_ANIM = LayoutAnimation.create(
  220,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
)

const useMessagePagination = (chatId: number) => {
  const isFocused = useIsFocused()
  const dispatch = useDispatch()
  const store = useStore()
  const [page, setPage] = useState(1)
  const [allMessages, setAllMessages] = useState<ChatMessageType[]>([])
  const [hasMore, setHasMore] = useState(true)
  const isLoadingRef = useRef(false)

  // Track WS connectivity so the poll is only the FALLBACK when the socket is
  // down — while connected, useChatSocket delivers messages instantly and the
  // 10s poll would be redundant churn.
  const [isWsConnected, setIsWsConnected] = useState(WebSocketService.isConnected())
  useEffect(() => {
    const onUp = () => setIsWsConnected(true)
    const onDown = () => setIsWsConnected(false)
    WebSocketService.on("connected", onUp)
    WebSocketService.on("reconnected", onUp)
    WebSocketService.on("disconnected", onDown)
    setIsWsConnected(WebSocketService.isConnected())
    return () => {
      WebSocketService.off("connected", onUp)
      WebSocketService.off("reconnected", onUp)
      WebSocketService.off("disconnected", onDown)
    }
  }, [])

  // Main paginated query. refetchOnMountOrArgChange: a cached page served on
  // re-open can predate messages that arrived while the socket was down (the
  // app backgrounds → socket disconnects by design → e.g. the job-expired
  // system message lands unseen; foreground reconciliation refreshes the CHATS
  // list but not these pages) — so the preview showed "Job expired" while the
  // thread didn't. Revalidating on every open closes that whole class; the
  // merge below dedupes by id, so a refetch never duplicates bubbles.
  const { data: messagesData } = useGetChatMessagesQuery(
    { chatId, page, perPage: 20 },
    { refetchOnMountOrArgChange: true }
  )

  // Presence lift: each fetched message embeds the PRO joined fresh at fetch
  // time — patch the chats-cache preview so the header's "last seen" reflects
  // the latest state the moment the thread opens (no dedicated request).
  useEffect(() => {
    const fresh = (
      messagesData?.data?.find((m: any) => m?.pro?.lastSeen) as any
    )?.pro?.lastSeen
    if (fresh) {
      applyCounterpartLastSeen(dispatch, store.getState, chatId, fresh)
    }
  }, [messagesData, chatId])

  // Polling query — page 1 only, focused AND socket-down. When the socket is
  // up, live delivery via useChatSocket makes polling unnecessary.
  const { data: pollData } = useGetChatMessagesQuery(
    { chatId, page: 1, perPage: 20 },
    { pollingInterval: isFocused && !isWsConnected ? POLL_INTERVAL : 0 }
  )

  const [markAllAsRead] = useMarkAllAsReadMutation()

  // Accumulate messages from paginated responses
  useEffect(() => {
    if (messagesData?.data) {
      isLoadingRef.current = false

      if (page === 1) {
        // Live inserts land here too (chatCache unshifts into the page-1 cache
        // entry). Animate only a genuinely new head on an already-rendered
        // list — never the initial load, and not post-send refetches (the
        // optimistic id is swapped for the real one before they land).
        const next = messagesData.data
        if (
          allMessages.length > 0 &&
          next.length > 0 &&
          next[0].id !== allMessages[0].id
        ) {
          scheduleLayoutAnimation(MESSAGE_ANIM)
        }
        setAllMessages(next)
      } else {
        setAllMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id))
          const newMessages = messagesData.data.filter((m) => !existingIds.has(m.id))
          return [...prev, ...newMessages]
        })
      }
      if (messagesData.data.length < 20) {
        setHasMore(false)
      }
    }
  }, [messagesData])

  // Merge new messages from polling into allMessages
  useEffect(() => {
    if (pollData?.data) {
      setAllMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const newMessages = pollData.data.filter((m) => !existingIds.has(m.id))
        if (newMessages.length === 0) {
          // No new messages — but update readAt on existing ones
          const pollMap = new Map(pollData.data.map((m) => [m.id, m]))
          const updated = prev.map((m) => {
            const polled = pollMap.get(m.id)
            if (polled && polled.readAt !== m.readAt) {
              return { ...m, readAt: polled.readAt }
            }
            return m
          })
          return updated
        }
        // New messages arriving while the main query is pinned to an older
        // page (user paginated) still deserve the slide-up. Scheduling is a
        // next-frame side effect, safe inside the updater.
        scheduleLayoutAnimation(MESSAGE_ANIM)
        return [...newMessages, ...prev]
      })
    }
  }, [pollData])

  // Mark as read on focus + tell chatCache which chat is open (so live
  // messages arriving here don't bump unread or ever banner). Cleared on blur.
  // Also re-marks on WS reconnect: messages that landed during a WS outage
  // surface via the reconnect getChats invalidate (not replayed per-message),
  // so this convergence keeps them from resurrecting the pill while open.
  useEffect(() => {
    if (isFocused && chatId) {
      setActiveChat(chatId)
      markAllAsRead(chatId)
      return () => setActiveChat(null)
    }
  }, [isFocused, chatId, isWsConnected])

  const loadMore = useCallback(() => {
    // Inverted FlatLists fire onEndReached on mount while the list is still
    // empty — don't paginate until page 1 has actually rendered (once it has,
    // hasMore is false for short chats and this no-ops correctly).
    if (allMessages.length === 0) return
    if (hasMore && !isLoadingRef.current) {
      isLoadingRef.current = true
      setPage((p) => p + 1)
    }
  }, [hasMore, allMessages.length])

  const addOptimisticMessage = useCallback((msg: ChatMessageType) => {
    // Own sends: the new bubble pushes the conversation up smoothly.
    scheduleLayoutAnimation(MESSAGE_ANIM)
    setAllMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [msg, ...prev]
    })
  }, [])

  const replaceOptimisticMessage = useCallback((optimisticId: number, realMsg: ChatMessageType) => {
    setAllMessages((prev) => {
      if (prev.some((m) => m.id === realMsg.id)) {
        return prev.filter((m) => m.id !== optimisticId)
      }
      return prev.map((m) => m.id === optimisticId ? realMsg : m)
    })
  }, [])

  // Drop an optimistic bubble that failed to send (e.g. blocked by moderation).
  // Animated so the neighbours settle back down instead of snapping.
  const removeOptimisticMessage = useCallback((optimisticId: number) => {
    scheduleLayoutAnimation(MESSAGE_ANIM)
    setAllMessages((prev) => prev.filter((m) => m.id !== optimisticId))
  }, [])

  return {
    messages: allMessages,
    loadMore,
    hasMore,
    addOptimisticMessage,
    replaceOptimisticMessage,
    removeOptimisticMessage,
  }
}

export default useMessagePagination
