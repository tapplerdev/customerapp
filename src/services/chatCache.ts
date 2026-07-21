// chatCache — the single gatekeeper for chat state mutations.
//
// Pattern note (keep both apps aligned — this is the customer-side twin of
// proapp/src/services/chatCache.ts): socket events MUTATE the RTK Query cache
// directly through this module; tag invalidation is reserved for error paths
// and reconnect/foreground reconciliation. Never call updateQueryData for
// chat data from a screen directly — patches that hand-pick cache keys miss
// entries and recreate the stale-badge class of bugs. This module enumerates
// EVERY cached entry via selectCachedArgsForQuery.
//
// CUSTOMER PERSPECTIVE: the "other party" whose messages bump unread is the
// PRO (ownerType 'pro'); the customer's OWN messages are ownerType 'customer'
// (this is the mirror of the proapp, where those two are swapped).
//
// One-way import (chatCache → api). api.ts must not import this module.

import { api } from "services/api"
import { chatReadRegistry } from "services/chatReadRegistry"
import { ChatMessageType } from "types/chat"

type Dispatch = (action: any) => any
type GetState = () => any

// Message ownerType from the customer's point of view.
const OWN_OWNER_TYPE = "customer" // the customer's own sent messages
const OTHER_OWNER_TYPE = "pro" // incoming messages that bump unread

// --- Focused-chat tracking -------------------------------------------------
// Set on MessagesDetailsScreen focus, cleared on blur. Consulted so messages
// arriving in the OPEN chat neither bump unread nor show a banner.
let activeChatId: number | null = null

export function setActiveChat(chatId: number | null): void {
  activeChatId = chatId
}

export function getActiveChat(): number | null {
  return activeChatId
}

// --- Delivery dedup ---------------------------------------------------------
// Bounded FIFO of recently applied message ids (guards double delivery if an
// FCM path is later added alongside the socket).
const APPLIED_MAX = 200
const appliedIds = new Set<number>()

function markApplied(id: number): boolean {
  if (appliedIds.has(id)) return false
  appliedIds.add(id)
  if (appliedIds.size > APPLIED_MAX) {
    const first = appliedIds.values().next().value
    if (first !== undefined) appliedIds.delete(first)
  }
  return true
}

// --- Mutations ---------------------------------------------------------------

/**
 * Zero a chat's unread count across EVERY cached getChats entry, and remember
 * the read in the registry so in-flight refetches can't resurrect the pill.
 */
export function markChatRead(
  dispatch: Dispatch,
  getState: GetState,
  chatId: number
): void {
  chatReadRegistry.add(chatId)
  for (const arg of api.util.selectCachedArgsForQuery(getState(), "getChats")) {
    dispatch(
      api.util.updateQueryData("getChats", arg, (draft: any) => {
        const preview = draft?.data?.find((c: any) => c.chat.id === chatId)
        if (preview) preview.notReadMessages = 0
      })
    )
  }
}

/**
 * Apply an incoming message to the cache: insert into the chat's first
 * message page, update lastMessage / unread / ordering in every chats list.
 *
 * Returns false when the message couldn't be applied (unknown chat — e.g. a
 * brand-new conversation not in any cached list, or a payload without the
 * full message). Callers should fall back to invalidating ['Chats'] then.
 */
export function applyIncomingMessage(
  dispatch: Dispatch,
  getState: GetState,
  message: (ChatMessageType & { chatId?: number }) | undefined
): boolean {
  const chatId = message?.chatId ?? (message as any)?.chat?.id
  if (!message?.id || !chatId) return false
  if (!markApplied(message.id)) return true // duplicate delivery — done

  // 1. Insert into the first page of the chat's cached message history
  //    (deduped by id; deeper pages are pagination history and never change).
  //    Own-message echoes are SKIPPED here: the send flow renders an
  //    optimistic bubble and swaps in the server message itself — inserting
  //    the echo would render the same message twice. The chats-list preview
  //    below still updates for own messages.
  if (message.ownerType !== OWN_OWNER_TYPE) {
    for (const arg of api.util.selectCachedArgsForQuery(getState(), "getChatMessages") as any[]) {
      if (arg?.chatId !== chatId || (arg?.page ?? 1) !== 1) continue
      dispatch(
        api.util.updateQueryData("getChatMessages", arg, (draft: any) => {
          if (!draft?.data) return
          if (draft.data.some((m: any) => m.id === message.id)) return
          draft.data.unshift(message)
        })
      )
    }
  }

  // 2. Update every cached chats list: preview, unread, move-to-top.
  let known = false
  for (const arg of api.util.selectCachedArgsForQuery(getState(), "getChats")) {
    dispatch(
      api.util.updateQueryData("getChats", arg, (draft: any) => {
        const list = draft?.data
        if (!list) return
        const index = list.findIndex((c: any) => c.chat.id === chatId)
        if (index === -1) return
        known = true
        const preview = list[index]
        preview.lastMessage = message
        // Presence lift: the message payload embeds the PRO joined fresh at
        // send/fetch time — a newer lastSeen updates the chat header with no
        // extra request. Guarded against out-of-order deliveries.
        const freshSeen = (message as any)?.pro?.lastSeen
        if (freshSeen && preview.chat?.pro) {
          const current = preview.chat.pro.lastSeen
          if (!current || new Date(freshSeen) > new Date(current)) {
            preview.chat.pro.lastSeen = freshSeen
          }
        }
        // The FOCUSED chat suppresses the bump client-side AND converges the
        // server: a message arriving while the chat is open must be marked read
        // server-side (the markAllAsRead below), or the server's readAt stays
        // NULL and a later getChats refetch (back-nav / foreground / reconnect)
        // resurrects the pill. Firing the idempotent PATCH per incoming message
        // is how the server converges (mirrors the proapp screen handler).
        // Deliberately NOT consulting chatReadRegistry here: it would swallow
        // legitimate new-message bumps for its whole TTL after leaving a chat.
        if (chatId === activeChatId) {
          preview.notReadMessages = 0
        } else if (message.ownerType === OTHER_OWNER_TYPE) {
          preview.notReadMessages = (preview.notReadMessages || 0) + 1
        }
        if (index > 0) {
          list.splice(index, 1)
          list.unshift(preview)
        }
      })
    )
  }

  // Converge the SERVER for a message that landed in the OPEN chat: fire the
  // idempotent markAllAsRead PATCH once (not per cached arg). Without this the
  // client-only zero above leaves readAt NULL and the pill resurrects on the
  // next getChats refetch. Gated on the other party's message — own echoes have
  // nothing to mark. Guarded by `known` so an unknown-chat fallback still runs.
  if (known && chatId === activeChatId && message.ownerType === OTHER_OWNER_TYPE) {
    // track:false — fire-and-forget; without it each active-chat message would
    // leak a tracked mutation entry in the RTK store (never unsubscribed).
    dispatch(api.endpoints.markAllAsRead.initiate(chatId, { track: false }))
  }

  return known
}

/**
 * Patch the counterpart PRO's lastSeen into every cached chats-list entry for
 * a chat. Fed by the thread's message fetch (each message embeds the pro
 * joined fresh at fetch time) so the header shows the latest state the moment
 * a chat opens — no dedicated presence request.
 */
export function applyCounterpartLastSeen(
  dispatch: Dispatch,
  getState: GetState,
  chatId: number,
  lastSeen?: string | null
): void {
  if (!lastSeen) return
  for (const arg of api.util.selectCachedArgsForQuery(getState(), "getChats")) {
    dispatch(
      api.util.updateQueryData("getChats", arg, (draft: any) => {
        const preview = draft?.data?.find((c: any) => c.chat.id === chatId)
        if (!preview?.chat?.pro) return
        const current = preview.chat.pro.lastSeen
        if (!current || new Date(lastSeen) > new Date(current)) {
          preview.chat.pro.lastSeen = lastSeen
        }
      })
    )
  }
}
