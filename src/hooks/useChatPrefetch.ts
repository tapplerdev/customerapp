import { useEffect, useRef } from "react"
import { useDispatch } from "react-redux"
import FastImage from "react-native-fast-image"
import { api } from "services/api"
import { ChatPreviewType } from "types/chat"

/**
 * Prefetches messages and images for top chats.
 *
 * - Uses RTK Query's `initiate()` with `forceRefetch: false` (no-op if cached)
 * - Tracks prefetched chat IDs in a ref to avoid redundant calls
 * - Preloads image thumbnails via FastImage after messages load
 * - Fire-and-forget — failures are silent (user just gets normal load on tap)
 */
const useChatPrefetch = (chats: ChatPreviewType[]) => {
  const dispatch = useDispatch()
  const prefetchedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!chats.length) return

    const chatsToPrefetch = chats.slice(0, 10)

    chatsToPrefetch.forEach((chatPreview) => {
      const chatId = chatPreview.chat.id
      if (prefetchedRef.current.has(chatId)) return
      prefetchedRef.current.add(chatId)

      // Prefetch first page of messages — RTK Query caches the result
      const promise = dispatch(
        api.endpoints.getChatMessages.initiate(
          { chatId, page: 1, perPage: 20 },
          { forceRefetch: false },
        ),
      ) as any

      // After messages load, preload image thumbnails
      promise.then((result: any) => {
        const messages = result?.data?.data
        if (!Array.isArray(messages)) return

        const imageUrls: string[] = []
        messages.forEach((msg: any) => {
          msg.files?.forEach((file: any) => {
            if (file.mimeType?.startsWith("image/")) {
              const url = file.url720 || file.url
              if (url) imageUrls.push(url)
            }
          })
        })

        if (imageUrls.length > 0) {
          FastImage.preload(imageUrls.map((uri) => ({ uri })))
        }
      })
    })
  }, [chats, dispatch])
}

export default useChatPrefetch
