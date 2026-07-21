import { ChatPreviewType } from "types/chat"

/**
 * The single source of truth for which chats the customer can see.
 *
 * ENGAGEMENT-GATED (Upwork model, not Thumbtack): an opportunity pro's cold
 * pitch must NOT surface a thread — at scale that's 50 auto-born chats per
 * job colonizing the inbox. Offers are compared on the job's Other Pros tab;
 * a thread earns its place in Messages only once the customer acts.
 *
 * Rule:
 *  - job chats: visible iff the pro is in "offer" status OR the customer has
 *    actually said something (`hasCustomerMessages`, computed server-side).
 *      · Opportunity pros reach "offer" ONLY via customer action — Select on
 *        their card, or messaging them (the backend auto-upgrades
 *        opportunity → offer on the customer's first message).
 *      · Lead pros (explicitly invited at job creation) reach "offer" by
 *        responding — the customer picked them and awaits exactly that.
 *      · An un-actioned or Passed pitch (opportunity / customerRejected with
 *        no customer messages) therefore never surfaces.
 *      · A real conversation stays visible even after a later Pass
 *        (hasCustomerMessages) — history is never silently deleted.
 *  - direct chats (no job): something was actually said (WhatsApp-style),
 *    otherwise empty threads appear the moment a composer is opened.
 *
 * Both the Messages list AND the tab unread badge MUST use this predicate.
 * They diverged once — the badge counted a pro message sitting in a hidden
 * chat the customer could never open, so a permanent "1" badge — and sharing
 * the function makes `badge ⊆ list` structural.
 */
export const isChatVisible = (item: ChatPreviewType): boolean => {
  if (item.chat.status !== "active") return false

  if (!item.chat.job) return !!item.lastMessage

  const chatPro = item.chat.job.pros?.find((p) => p.proId === item.chat.proId)
  return chatPro?.selectionStatus === "offer" || !!item.hasCustomerMessages
}
