import { TypedEventBus } from "@tappler/shared/src/events/TypedEventBus"
import { ChatPreviewType } from "types/chat"

// Fired by useChatSocket when a message arrives from a pro while the customer
// is NOT looking at that chat. The InAppMessageBanner overlay renders it as a
// slide-down toast. Kept OUT of the persisted Redux auth slice — a transient
// banner must not survive an app restart.
export type MessageBannerEventMap = {
  "message:new": {
    chatPreview: ChatPreviewType // full preview, so a tap can open the chat directly
    body: string
  }
}

export const messageBannerEventBus = new TypedEventBus<MessageBannerEventMap>()
