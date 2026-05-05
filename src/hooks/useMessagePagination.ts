import { useCallback, useEffect, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { ChatMessageType } from "types/chat"
import {
  useGetChatMessagesQuery,
  useMarkAllAsReadMutation,
} from "services/api"

const POLL_INTERVAL = 10000 // 10 seconds

const useMessagePagination = (chatId: number) => {
  const isFocused = useIsFocused()
  const [page, setPage] = useState(1)
  const [allMessages, setAllMessages] = useState<ChatMessageType[]>([])
  const [hasMore, setHasMore] = useState(true)
  const isLoadingRef = useRef(false)

  // Main paginated query
  const { data: messagesData } = useGetChatMessagesQuery({ chatId, page, perPage: 20 })

  // Polling query — only polls page 1 for new messages while screen is focused
  const { data: pollData } = useGetChatMessagesQuery(
    { chatId, page: 1, perPage: 20 },
    { pollingInterval: isFocused ? POLL_INTERVAL : 0 }
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

  // Mark as read on focus
  useEffect(() => {
    if (isFocused && chatId) {
      markAllAsRead(chatId)
    }
  }, [isFocused, chatId])

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingRef.current) {
      isLoadingRef.current = true
      setPage((p) => p + 1)
    }
  }, [hasMore])

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

  return {
    messages: allMessages,
    loadMore,
    hasMore,
    addOptimisticMessage,
    replaceOptimisticMessage,
  }
}

export default useMessagePagination
