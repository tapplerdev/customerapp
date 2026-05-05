import { useCallback, useEffect, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { ChatMessageType } from "types/chat"
import {
  useGetChatMessagesQuery,
  useMarkAllAsReadMutation,
} from "services/api"

const useMessagePagination = (chatId: number) => {
  const isFocused = useIsFocused()
  const [page, setPage] = useState(1)
  const [allMessages, setAllMessages] = useState<ChatMessageType[]>([])
  const [hasMore, setHasMore] = useState(true)

  const { data: messagesData } = useGetChatMessagesQuery({ chatId, page, perPage: 20 })
  const [markAllAsRead] = useMarkAllAsReadMutation()

  // Accumulate messages from paginated responses
  useEffect(() => {
    if (messagesData?.data) {
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

  // Mark as read on focus
  useEffect(() => {
    if (isFocused && chatId) {
      markAllAsRead(chatId)
    }
  }, [isFocused, chatId])

  const loadMore = useCallback(() => {
    if (hasMore) {
      setPage((p) => p + 1)
    }
  }, [hasMore])

  const addOptimisticMessage = useCallback((msg: ChatMessageType) => {
    setAllMessages((prev) => [msg, ...prev])
  }, [])

  return {
    messages: allMessages,
    loadMore,
    hasMore,
    addOptimisticMessage,
  }
}

export default useMessagePagination
