/**
 * Jest only. The states a screen is rendered in: who is using the app and
 * what the backend answers. A test spreads one into renderScreen's options
 * and adds its own (route params, more answers).
 */
import type { BackendFixtures } from "./backend"
import { DATA, EMPTY, ERROR } from "./fixtures/api"
import { freshInstall, guest, signedIn } from "./fixtures/users"
import type { ScreenState } from "./store"

export type ScreenStateName = "data" | "empty" | "loading" | "error"

const ANSWERS: Record<ScreenStateName, BackendFixtures> = {
  data: DATA,
  empty: EMPTY,
  // Nothing answers: every request stays in flight.
  loading: {},
  error: ERROR,
}

/** A signed-in customer, and the backend answering as `name` says. */
export const screenState = (
  name: ScreenStateName
): { state: ScreenState; api: BackendFixtures } => ({
  state: { auth: signedIn() },
  api: ANSWERS[name],
})

/**
 * A guest browsing from a picked location (the signed-out branches of
 * AccountScreen, TalabatiScreen, MessagesScreen and HomeHeader), and the
 * backend answering as `name` says. A guest's requests are anonymous.
 */
export const guestState = (
  name: ScreenStateName
): { state: ScreenState; api: BackendFixtures } => ({
  state: { auth: guest },
  api: ANSWERS[name],
})

/** A fresh install (Welcome, AuthWelcome): nobody, no language picked yet. */
export const freshInstallState = (): {
  state: ScreenState
  api: BackendFixtures
} => ({
  state: { auth: freshInstall },
  api: DATA,
})
