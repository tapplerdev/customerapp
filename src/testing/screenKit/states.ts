/**
 * Jest only. The states a screen is rendered in: who is signed in and what
 * the backend answers. A test spreads one into renderScreen's options and
 * adds its own (route params, more answers).
 */
import type { BackendFixtures } from "./backend"
import { DATA, EMPTY, ERROR } from "./fixtures/api"
import { signedIn } from "./fixtures/users"
import type { ScreenState } from "./store"

export type ScreenStateName = "data" | "empty" | "loading" | "error"

const ANSWERS: Record<ScreenStateName, BackendFixtures> = {
  data: DATA,
  empty: EMPTY,
  // Nothing answers: every request stays in flight.
  loading: {},
  error: ERROR,
}

/** A signed-in individual pro, and the backend answering as `name` says. */
export const screenState = (
  name: ScreenStateName
): { state: ScreenState; api: BackendFixtures } => ({
  state: { auth: signedIn() },
  api: ANSWERS[name],
})
