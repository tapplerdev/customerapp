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
  // `system.messages:*` is filtered out before this fires. Not because it would
  // double up — the backend sends a chat notification over the socket ONLY when
  // the customer is disconnected, so the two can never arrive together — but
  // because a chat message belongs to the "message:new" banner above, which
  // knows the pro's avatar and can open the thread.
  "notification:new": {
    event: string // the system key, e.g. "system.job:customer.job.offer.selected"
    title: string
    body: string
    jobId?: number // carried by system.job:* AND the review reminder
    // The job's own status off the socket payload. Lets a consumer tell a
    // terminal update from a progress one without parsing localized copy.
    jobStatus?: string
  }
}

export const messageBannerEventBus = new TypedEventBus<MessageBannerEventMap>()
