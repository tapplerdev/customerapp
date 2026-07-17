import { useCallback, useEffect, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { ChatMessageType } from "types/chat"
import {
  useGetChatMessagesQuery,
  useMarkAllAsReadMutation,
} from "services/api"
import { WebSocketService } from "services/WebSocketService"
import { setActiveChat } from "services/chatCache"

const POLL_INTERVAL = 10000 // 10 seconds

const useMessagePagination = (chatId: number) => {
  const isFocused = useIsFocused()
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

  // Main paginated query
  const { data: messagesData } = useGetChatMessagesQuery({ chatId, page, perPage: 20 })

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
        setAllMessages(messagesData.data)
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
  const removeOptimisticMessage = useCallback((optimisticId: number) => {
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
