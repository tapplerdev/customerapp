/**
 * Jest only. The values the ActionBtn harvest (./harvest) can't read at a
 * site, because the site forwards something its own callers decide, written
 * out here with where they come from.
 *
 * Keyed by `<file under src>:<line of the ActionBtn tag>`; inside, by the
 * expression as written at the site (whitespace collapsed). A value is an
 * expression in the same language the harvest evaluates: `oneOf(a, b, ...)`
 * is one condition with those outcomes, and a bare name (`onRed`) is a fresh
 * condition shared by every rewrite of the element, which is how values that
 * move together (a tone's variant and its classes) stay together.
 *
 * The harvest fails on a rewrite that matches nothing, and on a site that
 * moved, so this table can't silently go stale.
 */
export type Rewrite = {
  why: string
  values: Record<string, string>
}

// customerapp has no ActionBtn whose values come from its callers: every
// one of its 51 sites reads its own props and state (CA-W0-B's harvest of
// e30b19a ran with none). proapp's eight were its own components'.
export const REWRITES: Record<string, Rewrite> = {}
