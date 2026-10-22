/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  BOTTOM_GAP_INSETS,
  copy,
  openScreen,
  presentedSheets,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  wait,
  type Step,
} from "testing/screenKit"
import { pressContaining } from "testing/pressContaining"
import { screenState } from "testing/screenKit/states"
import { DATA, SERVER_ERROR } from "testing/screenKit/fixtures/api"
import { CHAT, JOB } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { JobType } from "types/job"

import {
  JOB_COMPLETED,
  JOB_DECLINED_ONE,
  JOB_ENDED,
  JOB_NO_PROS,
  JOB_OPPORTUNITIES,
  JOB_STRANDED,
  PRO_FEATURED,
  SELECTED_DECLINED,
  SELECTED_OFFER,
  SVG_ART,
} from "../../__fixtures__/jobStates"

/*
 * JobDetailScreen's service-request body (the food order's is in
 * JobDetailScreen.food.parity.tsx, the loading skeleton in
 * JobDetailScreen.loading.parity.tsx): the header, the Selected and Other Pros
 * tabs and the cards in each (an offer with unread mail, a waiting pro, a
 * declined one, a featured company, an opportunity pro's card with its Select
 * and Pass buttons), the offers banner, the rescue cards for an ended request
 * and for one every invited pro declined, and every sheet the header and the
 * cards reach by pressing: the ••• menu (active, ended, two bottom insets),
 * the cancel confirmation, the reasons, the cancelled confirmation, the
 * find-other-pros confirmation and the error sheet. Every pressable is pressed.
 */

const NAME = "JobDetailScreen"
const load = () => require("../JobDetailScreen")

// None of the screen's own buttons is an ActionBtn (its modals' are ds Buttons
// already, in MainModal), so no row opts into a Button allowance.
const BUTTON: ParityAllowance[] = []

const ONE_FEATURED: JobType = {
  ...JOB,
  pros: [{ ...SELECTED_OFFER, pro: PRO_FEATURED }, SELECTED_DECLINED],
}

/** Select on the first Other Pros card, read 450 ms later: the "moved" banner shows 400 ms after the press. */
const selectFirst: Step = Object.assign(
  (root: Parameters<Step>[0], env: ParityEnv) => {
    pressText(root, copy(env, "select_me").toUpperCase(), { nth: 0 })
  },
  { settleMs: 450 }
)

const dots: Step = (root) => {
  pressIcon(root, { nth: 1 })
}
const otherTab: Step = (root, env) => {
  pressText(root, copy(env, "other_pros_tab"))
}
const selectedTab: Step = (root, env) => {
  pressText(root, copy(env, "selected_pros_tab"))
}
const row =
  (key: string): Step =>
  (root, env) => {
    pressText(root, copy(env, key))
  }
const titled =
  (key: string): Step =>
  (root, env) => {
    pressTitled(root, copy(env, key))
  }
const pill =
  (key: string): Step =>
  (root, env) => {
    pressContaining(
      root,
      `${copy(env, key)} ${env.language === "ar" ? "‹" : "›"}`
    )
  }
const cancelRequest: Step[] = [dots, row("cancel_service_request"), wait(500)]
// iOS holds a card in its present until UIKit reports it (the kit's Modal doesn't:
// the 2 s backstop does), so a card closed behind another waits that long.
const SETTLED = 3000
const confirmCancel: Step[] = [...cancelRequest, titled("yes"), wait(SETTLED)]
const reason =
  (text = "I hired a local pro"): Step =>
  (root, env) => {
    pressText(root, copy(env, text))
  }
const submitReasons: Step = titled("submit")

type Case = {
  state: string
  job?: JobType
  /** answers over the kit's DATA */
  api?: Record<string, unknown>
  insets?: { bottom: number }
  steps?: Step[]
  allow?: ParityAllowance[]
}

const CASES: Case[] = [
  { state: "an offer with unread mail, and a pro still waiting" },
  { state: "no unread mail", api: { getChats: { data: { data: [] } } } },
  { state: "no selected pros", job: JOB_NO_PROS },
  { state: "a declined pro", job: JOB_DECLINED_ONE },
  { state: "a featured company and a declined pro", job: ONE_FEATURED },
  { state: "a completed request", job: JOB_COMPLETED },
  {
    state: "the offers banner",
    job: JOB_OPPORTUNITIES,
  },
  {
    state: "the Other Pros tab with offers",
    job: JOB_OPPORTUNITIES,
    steps: [otherTab],
  },
  { state: "the Other Pros tab, no offers yet", steps: [otherTab] },
  {
    state: "Select pressed: the moved banner",
    job: JOB_OPPORTUNITIES,
    steps: [otherTab, selectFirst],
  },
  {
    // 100 ms later the offers count changed, which re-arms the new-offers
    // banner, and it replaces the moved one (noted for pass 2).
    state: "Select pressed: the pro joined the selected ones",
    job: JOB_OPPORTUNITIES,
    steps: [
      otherTab,
      (root, env) =>
        pressText(root, copy(env, "select_me").toUpperCase(), { nth: 0 }),
      wait(1500),
    ],
  },
  {
    state: "the Selected tab after Select",
    job: JOB_OPPORTUNITIES,
    steps: [otherTab, selectFirst, wait(1500), selectedTab],
  },
  {
    state: "Pass pressed on the second card: it goes",
    job: JOB_OPPORTUNITIES,
    steps: [
      otherTab,
      (root, env) =>
        pressText(root, copy(env, "pass").toUpperCase(), { nth: 1 }),
      wait(1500),
    ],
  },
  { state: "an ended request: the repost card", job: JOB_ENDED },
  {
    state: "every invited pro declined: the find-pros card",
    job: JOB_STRANDED,
  },
  {
    state: "the find-other-pros confirmation",
    job: JOB_STRANDED,
    steps: [pill("find_pros")],
  },
  { state: "the menu", steps: [dots] },
  { state: "the menu of an ended request", job: JOB_ENDED, steps: [dots] },
  {
    state: "the menu, no bottom inset",
    steps: [dots],
    insets: { bottom: BOTTOM_GAP_INSETS[0] },
  },
  {
    state: "the menu, a tall bottom inset",
    steps: [dots],
    insets: { bottom: BOTTOM_GAP_INSETS[1] },
  },
  { state: "the cancel confirmation", steps: cancelRequest },
  { state: "the cancel reasons", steps: confirmCancel },
  {
    state: "a reason chosen",
    steps: [...confirmCancel, reason()],
  },
  {
    state: "cancelling",
    api: { cancelJob: "loading" },
    steps: [...confirmCancel, reason(), submitReasons],
  },
  {
    state: "cancelled",
    api: { cancelJob: { data: {} } },
    steps: [...confirmCancel, reason(), submitReasons, wait(SETTLED)],
  },
  {
    state: "the cancel failed",
    api: { cancelJob: SERVER_ERROR },
    steps: [...confirmCancel, reason(), submitReasons, wait(SETTLED)],
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => ({
  ...screenState("data"),
  api: {
    ...DATA,
    getCustomerJobById: { data: entry.job ?? JOB },
    ...entry.api,
  },
  http: () => ({ text: SVG_ART }),
  lang: env.language,
  platform: env.platform,
  ...(entry.insets ? { insets: entry.insets } : {}),
  route: { name: NAME, params: { jobId: JOB.id } },
})

describe("JobDetailScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(load, options(entry, entry.env), entry.env, [
      ...(entry.steps ?? []),
      wait(0),
    ])
    expectParity(parityName(entry.state, entry.env), tree, {
      allow: entry.allow ?? BUTTON,
    })
  })
})

type Action = {
  type: string
  payload?: { name?: string; params?: Record<string, any> }
}

describe("JobDetailScreen: presses", () => {
  const open = (entry: Case, env: ParityEnv) =>
    openScreen(load, options(entry, env))
  type Session = Awaited<ReturnType<typeof open>>
  const run = async (session: Session, env: ParityEnv, steps: Step[]) => {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(() => {
        step(session.root, env)
      }, step.settleMs)
    }
  }
  const actions = (session: Session) => session.navigation.actions as Action[]
  const sent = (session: Session, endpoint: string) =>
    session.requests().filter((request) => request.endpoint === endpoint)
  const text = (session: Session) => JSON.stringify(session.tree())

  it.each(PARITY_MATRIX)(
    "the chevron goes back [$language $platform]",
    async (env) => {
      const session = await open({ state: "back" }, env)
      try {
        await run(session, env, [
          (root) => pressIcon(root, { icon: "svg:chevron-left" }),
        ])
        expect(actions(session).map((a) => a.type)).toEqual(["GO_BACK"])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "the loading skeleton's chevron goes back too [$language $platform]",
    async (env) => {
      const base = options({ state: "loading" }, env)
      const session = await openScreen(load, {
        ...base,
        api: { ...base.api, getCustomerJobById: "loading" as const },
      })
      try {
        await run(session, env, [
          (root) => pressIcon(root, { icon: "svg:chevron-left" }),
        ])
        expect(actions(session).map((a) => a.type)).toEqual(["GO_BACK"])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a selected pro opens its chat; a refused chat shows the error sheet and OK closes it [$language $platform]",
    async (env) => {
      const ok = await open({ state: "chat" }, env)
      try {
        await run(ok, env, [(root) => pressContaining(root, "Omar Hassan")])
        const last = actions(ok).at(-1)!
        expect(last.payload?.name).toBe("MessagesDetailsScreen")
        expect(last.payload?.params?.chatPreview.chat.id).toBe(CHAT.id)
      } finally {
        ok.unmount()
      }
      const refused = await open(
        { state: "refused", api: { openChat: SERVER_ERROR } },
        env
      )
      try {
        await run(refused, env, [
          (root) => pressContaining(root, "Omar Hassan"),
        ])
        expect(actions(refused)).toHaveLength(0)
        expect(text(refused)).toContain(copy(env, "an_error_occurred"))
        await run(refused, env, [titled("OK"), wait(SETTLED)])
        expect(text(refused)).not.toContain(copy(env, "an_error_occurred"))
      } finally {
        refused.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a declined pro's card does nothing when pressed [$language $platform]",
    async (env) => {
      const session = await open(
        { state: "declined", job: JOB_DECLINED_ONE },
        env
      )
      try {
        expect(() => pressContaining(session.root, "Salma Nour")).toThrow(
          /no match/
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "an Other Pros card opens the profile; Select and Pass answer the request [$language $platform]",
    async (env) => {
      const session = await open(
        {
          state: "other",
          job: JOB_OPPORTUNITIES,
          api: { respondToOpportunity: { data: {} } },
        },
        env
      )
      try {
        await run(session, env, [
          otherTab,
          (root) => pressContaining(root, "Karim Fathy"),
        ])
        const last = actions(session).at(-1)!
        expect(last.payload?.name).toBe("ProProfileScreen")
        expect(last.payload?.params).toMatchObject({
          proId: 1006,
          serviceCategoryId: 301,
          chatJobId: JOB.id,
        })
        await run(session, env, [
          (root) =>
            pressText(root, copy(env, "select_me").toUpperCase(), { nth: 0 }),
          (root) =>
            pressText(root, copy(env, "pass").toUpperCase(), { nth: 0 }),
        ])
        const answers = sent(session, "respondToOpportunity").map((r) =>
          JSON.stringify(r.args)
        )
        expect(answers).toHaveLength(2)
        expect(answers[0]).toContain("/jobs/8001/pros/1005")
        expect(answers[0]).toContain('"selectionStatus":"offer"')
        expect(answers[1]).toContain("/jobs/8001/pros/1006")
        expect(answers[1]).toContain('"selectionStatus":"customerRejected"')
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "the menu's details row opens the request's record; the dim closes the menu [$language $platform]",
    async (env) => {
      const session = await open({ state: "details" }, env)
      try {
        await run(session, env, [dots, row("my_request_details"), wait(600)])
        const last = actions(session).at(-1)!
        expect(last.payload?.name).toBe("RequestDetailsScreen")
        expect(last.payload?.params).toEqual({ jobId: JOB.id })
        expect(presentedSheets(session.root)).toHaveLength(0)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "cancelling: No leaves the request alone, the reasons' X closes, Submit sends the reasons, Done leaves [$language $platform]",
    async (env) => {
      const no = await open({ state: "no" }, env)
      try {
        await run(no, env, [...cancelRequest, titled("no"), wait(SETTLED)])
        expect(text(no)).not.toContain(copy(env, "are_you_sure_cancel"))
        expect(sent(no, "cancelJob")).toHaveLength(0)
      } finally {
        no.unmount()
      }
      const session = await open(
        { state: "yes", api: { cancelJob: { data: {} } } },
        env
      )
      try {
        await run(session, env, [
          ...confirmCancel,
          (root) => pressText(root, "✕"),
          wait(SETTLED),
        ])
        expect(text(session)).not.toContain(copy(env, "your_opinion_matters"))
        expect(sent(session, "cancelJob")).toHaveLength(0)
        await run(session, env, [
          ...confirmCancel,
          reason("I hired a local pro"),
          reason("Other Reasons"),
          submitReasons,
          wait(SETTLED),
        ])
        const body = JSON.stringify(sent(session, "cancelJob")[0].args)
        expect(sent(session, "cancelJob")).toHaveLength(1)
        expect(body).toContain("I hired a local pro")
        expect(body).toContain("Other Reasons")
        expect(text(session)).toContain(copy(env, "job_cancelled"))
        await run(session, env, [titled("done"), wait(SETTLED)])
        expect(actions(session).at(-1)!.type).toBe("GO_BACK")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Find pros: No closes the card, Yes cancels with the system reason and reposts [$language $platform]",
    async (env) => {
      const session = await open(
        {
          state: "rescue",
          job: JOB_STRANDED,
          api: { cancelJob: { data: {} } },
        },
        env
      )
      try {
        await run(session, env, [
          pill("find_pros"),
          titled("no"),
          wait(SETTLED),
        ])
        expect(text(session)).not.toContain(copy(env, "find_other_pros"))
        expect(sent(session, "cancelJob")).toHaveLength(0)
        await run(session, env, [
          pill("find_pros"),
          titled("yes"),
          wait(SETTLED),
        ])
        expect(JSON.stringify(sent(session, "cancelJob")[0].args)).toContain(
          "All selected pros declined"
        )
        expect(actions(session).at(-1)!.payload?.name).toBe(
          "SearchAnimationScreen"
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Repost on an ended request reposts it [$language $platform]",
    async (env) => {
      const session = await open({ state: "repost", job: JOB_ENDED }, env)
      try {
        await run(session, env, [pill("repost"), wait(SETTLED)])
        expect(actions(session).at(-1)!.payload?.name).toBe(
          "SearchAnimationScreen"
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a failed Find pros says so [$language $platform]",
    async (env) => {
      const session = await open(
        {
          state: "rescue fails",
          job: JOB_STRANDED,
          api: { cancelJob: SERVER_ERROR },
        },
        env
      )
      try {
        await run(session, env, [
          pill("find_pros"),
          titled("yes"),
          wait(SETTLED),
        ])
        expect(text(session)).toContain(copy(env, "an_error_occurred"))
        expect(actions(session)).toHaveLength(0)
      } finally {
        session.unmount()
      }
    }
  )
})
