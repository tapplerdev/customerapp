/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry, so the
   screen is passed as a loader. */
import { expect, it } from "@jest/globals"

import {
  AUTH_REFRESH,
  openScreen,
  rowsByPlatform,
  type BackendFixtures,
  type ScreenSession,
} from "testing/screenKit"
import { DATA } from "testing/screenKit/fixtures/api"
import { screenState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * A 401's token refresh can't outlive its row (review H1, the reviewer's
 * repro on NotificationsScreen). services/api.ts keeps `isRefreshing` and the
 * refresh's promise at module scope, and the store holds that module, so the
 * per-row reset can't renew it. A refresh nothing answered used to stay
 * pending for the rest of the registry: every later 401 waited on it, never
 * sent its own, and drew a stuck skeleton that the same-order compare then
 * passed. Now a row whose refresh nothing answers fails, and a refresh still
 * pending when its row ends (one a row leaves "loading" on purpose) is
 * settled the way the device's would end, so the next row starts clean.
 *
 * Rows run in this order in each registry (rowsByPlatform keeps it). B's and
 * D's cases were captured each on its own (`-t`), so they hold what the row
 * draws with nothing before it.
 */

const load = () =>
  require("screens/dashboardScreens/NotificationsScreen/NotificationsScreen")

const UNAUTHORIZED = {
  error: { status: 401, data: { message: "Unauthorized" } },
}

const REFRESHED = {
  data: { token: "parity-token-2", refreshToken: "parity-refresh-2" },
}

/** The first getNotifications a 401, the retry the data. */
const firstUnauthorized = () => {
  let calls = 0
  return (args: unknown) => {
    calls += 1
    return calls === 1
      ? UNAUTHORIZED
      : (DATA.getNotifications as (a: unknown) => { data: unknown })(args)
  }
}

type Row = {
  state: string
  api: () => BackendFixtures
  expected: "fails" | "in flight" | "refreshed"
}

const ROWS: Row[] = [
  {
    state: "A refresh nothing answers",
    api: () => ({ ...DATA, getNotifications: UNAUTHORIZED }),
    expected: "fails",
  },
  {
    state: "B refresh answered, after an unanswered one",
    api: () => ({
      ...DATA,
      getNotifications: firstUnauthorized(),
      [AUTH_REFRESH]: REFRESHED,
    }),
    expected: "refreshed",
  },
  {
    state: "C refresh left in flight on purpose",
    api: () => ({
      ...DATA,
      getNotifications: UNAUTHORIZED,
      [AUTH_REFRESH]: "loading",
    }),
    expected: "in flight",
  },
  {
    state: "D refresh answered, after one left in flight",
    api: () => ({
      ...DATA,
      getNotifications: firstUnauthorized(),
      [AUTH_REFRESH]: REFRESHED,
    }),
    expected: "refreshed",
  },
]

const options = (row: Row, env: ParityEnv) => ({
  ...screenState("data"),
  api: row.api(),
  lang: env.language,
  platform: env.platform,
  route: { name: "NotificationsScreen" },
})

/** The refresh's requests and the 401'd endpoint's, as endpoint:answer. */
const auth = (session: ScreenSession) =>
  session
    .requests()
    .filter((r) => r.endpoint === "getNotifications" || r.endpoint === AUTH_REFRESH)
    .map((r) => `${r.endpoint}:${r.answer}${r.unanswered ? " (unanswered)" : ""}`)

it.each(rowsByPlatform(ROWS, PARITY_MATRIX))(
  "$state [$env.language $env.platform]",
  async (row) => {
    const { state, expected, env } = row
    if (expected === "fails") {
      await expect(openScreen(load, options(row, env))).rejects.toThrow(
        /401 sent the app's token refresh[^]*no `authRefresh` answer/
      )
      return
    }
    const session = await openScreen(load, options(row, env))
    try {
      if (expected === "in flight") {
        expect(auth(session)).toEqual([
          "getNotifications:error",
          `${AUTH_REFRESH}:loading`,
        ])
        return
      }
      // Its own refresh, the retry answered, the new token kept.
      expect(auth(session)).toEqual([
        "getNotifications:error",
        `${AUTH_REFRESH}:data`,
        "getNotifications:data",
      ])
      expect(session.store.getState().auth.token).toBe("parity-token-2")
      expectParity(parityName(state, env), session.tree())
    } finally {
      session.unmount()
    }
  }
)
