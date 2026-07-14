// Recently-read chat registry — the "in-flight-read wins" guard.
//
// When the pro reads a chat we zero its unread count locally and PATCH the
// server in the background. Any refetch of GET /chats that was already in
// flight (reconnect reconciliation, focus refetch, poll) can land AFTER the
// local zero but carry the PRE-read server state, silently resurrecting the
// unread pill. getChats' transformResponse consults this registry and keeps
// such chats at zero.
//
// Standalone module (no imports) so both api.ts and chatCache.ts can use it
// without an import cycle. Entries expire: once the PATCH has committed the
// server agrees anyway, and on PATCH failure the caller removes the entry.

const TTL_MS = 20_000

// null = PENDING (PATCH in flight — never expires; a slow PATCH must stay
// guarded however long it takes). A timestamp = COMMITTED — expires TTL_MS
// after the server accepted the read, covering refetches that raced the
// commit.
const readState = new Map<number, number | null>()

export const chatReadRegistry = {
  /** Mark-as-read fired — guard until commit()/remove(). */
  add(chatId: number): void {
    readState.set(chatId, null)
  },

  /** PATCH succeeded — start the post-commit expiry window. */
  commit(chatId: number): void {
    readState.set(chatId, Date.now())
  },

  /** PATCH failed — server truth is restored by refetch, drop the guard. */
  remove(chatId: number): void {
    readState.delete(chatId)
  },

  has(chatId: number): boolean {
    const committedAt = readState.get(chatId)
    if (committedAt === undefined) return false
    if (committedAt === null) return true // pending — no expiry
    if (Date.now() - committedAt > TTL_MS) {
      readState.delete(chatId)
      return false
    }
    return true
  },
}
