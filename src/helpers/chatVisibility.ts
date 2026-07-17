import { ChatPreviewType } from "types/chat"

/**
 * The single source of truth for which chats the customer can see.
 *
 * Rule: a chat is visible iff there is something human in it —
 *  - job chats: the pro sent an offer (selectionStatus "offer"), OR the chat
 *    holds at least one pro/customer message (`hasHumanMessages`, computed
 *    server-side; system messages like "job expired" don't count, and
 *    lastMessage alone can't distinguish a real conversation followed by a
 *    system message from a system-only ghost)
 *  - direct chats (no job): something was actually said (WhatsApp-style),
 *    otherwise empty threads appear the moment a composer is opened
 *
 * Both the Messages list AND the tab unread badge MUST use this predicate.
 * They diverged once — the badge counted a pro message sitting in a hidden
 * pre-offer lead chat the customer could never open, so a permanent "1"
 * badge — and sharing the function makes `badge ⊆ list` structural.
 */
export const isChatVisible = (item: ChatPreviewType): boolean => {
  if (item.chat.status !== "active") return false

  if (!item.chat.job) return !!item.lastMessage

  const chatPro = item.chat.job.pros?.find((p) => p.proId === item.chat.proId)
  return chatPro?.selectionStatus === "offer" || !!item.hasHumanMessages
}
