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
  // Everything else the backend notifies about — an offer arriving, an offer
  // being revised, a food order changing status. Title and body are already
  // resolved and localised server-side, so the banner just displays them.
  //
  // Chat messages are deliberately NOT routed here: they arrive as
  // `system.messages:*` notifications as well, and would show a second banner
  // on top of the "message:new" one above.
  "notification:new": {
    title: string
    body: string
    jobId?: number // present on system.job:* events — lets a tap open the job
  }
}

export const messageBannerEventBus = new TypedEventBus<MessageBannerEventMap>()
