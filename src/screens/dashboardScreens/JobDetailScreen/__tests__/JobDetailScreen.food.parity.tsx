/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  BOTTOM_GAP_INSETS,
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  wait,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import {
  CHAT,
  CHAT_PREVIEW,
  JOB_FOOD,
  PRO_FOOD,
} from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { JobType } from "types/job"

import {
  FOOD_ACCEPTED,
  FOOD_CANCELLED_BY_CUSTOMER,
  FOOD_CANCELLED_BY_KITCHEN,
  FOOD_COURIER,
  FOOD_DECLINED,
  FOOD_DELIVERED,
  FOOD_NO_PRO,
  FOOD_PICKUP,
  FOOD_PREPARING,
  FOOD_SENT,
  SVG_ART,
} from "../../__fixtures__/jobStates"

/*
 * JobDetailScreen's food-order body (FoodOrderView): who the order is with, its
 * status and total, the trust and OFFERS stickers, the four-step timeline at
 * every stage (sent, accepted, preparing, courier or ready for pickup,
 * delivered) for delivery and for pickup, a cancelled order (by the customer, by
 * the kitchen with its reason), a declined one and one with no pro on it, the
 * details (address, time, payment, notes, the bill with a fee, free delivery
 * or none for a pickup, a discount) open and collapsed, the unread-mail badge,
 * the ••• menu with and without Cancel, and the cancel flow: the confirmation,
 * the cancelled sheet, the kitchen-already-preparing message and the generic
 * error. Every pressable is pressed.
 */

const NAME = "JobDetailScreen"
const load = () => require("../JobDetailScreen")

// No ActionBtn in this body: its modals' buttons are ds Buttons in MainModal.
const BUTTON: ParityAllowance[] = []

// iOS holds a card in its present until UIKit reports it (the kit's Modal
// doesn't: the 2 s backstop does), so a card closed behind another waits that long.
const SETTLED = 3000

const dots: Step = (root) => {
  pressIcon(root, { nth: 1 })
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
const cancelOrder: Step[] = [dots, row("cancel_order"), wait(500)]
const confirm: Step[] = [...cancelOrder, titled("yes"), wait(SETTLED)]
const toggleDetails: Step = (root, env) => {
  pressText(root, copy(env, "hide_order_details"))
}

/** The food pro's thread with three unread messages (the order payload carries no chat data). */
const UNREAD = {
  getChats: {
    data: {
      data: [
        {
          ...CHAT_PREVIEW,
          notReadMessages: 3,
          chat: { ...CHAT, proId: PRO_FOOD.id, jobId: JOB_FOOD.id },
        },
      ],
    },
  },
}

type Case = {
  state: string
  job: JobType
  api?: Record<string, unknown>
  insets?: { bottom: number }
  steps?: Step[]
}

const CASES: Case[] = [
  {
    state: "sent, the kitchen has not answered, free delivery",
    job: FOOD_SENT,
  },
  {
    state: "accepted, stickers, a note, a dated slot, options, unread mail",
    job: FOOD_ACCEPTED,
    api: UNREAD,
  },
  { state: "preparing, a delivery fee", job: FOOD_PREPARING },
  { state: "with the courier", job: FOOD_COURIER },
  { state: "delivered, a discount", job: FOOD_DELIVERED },
  { state: "a pickup, ready, card on pickup", job: FOOD_PICKUP },
  { state: "cancelled by the customer", job: FOOD_CANCELLED_BY_CUSTOMER },
  {
    state: "cancelled by the kitchen, with its reason",
    job: FOOD_CANCELLED_BY_KITCHEN,
  },
  { state: "declined by the restaurant", job: FOOD_DECLINED },
  { state: "no pro on the order", job: FOOD_NO_PRO },
  {
    state: "the details collapsed",
    job: FOOD_ACCEPTED,
    steps: [toggleDetails],
  },
  { state: "the menu, Cancel offered", job: FOOD_ACCEPTED, steps: [dots] },
  {
    state: "the menu, once it is preparing",
    job: FOOD_PREPARING,
    steps: [dots],
  },
  {
    state: "the menu, a tall bottom inset",
    job: FOOD_ACCEPTED,
    steps: [dots],
    insets: { bottom: BOTTOM_GAP_INSETS[1] },
  },
  { state: "the cancel confirmation", job: FOOD_ACCEPTED, steps: cancelOrder },
  {
    state: "cancelling",
    job: FOOD_ACCEPTED,
    api: { cancelJob: "loading" },
    steps: [...cancelOrder, titled("yes"), wait(SETTLED)],
  },
  {
    state: "cancelled",
    job: FOOD_ACCEPTED,
    api: { cancelJob: { data: {} } },
    steps: confirm,
  },
  {
    state: "the kitchen already started",
    job: FOOD_ACCEPTED,
    api: { cancelJob: { error: { status: 409, data: {} } } },
    steps: confirm,
  },
  {
    state: "the cancel failed",
    job: FOOD_ACCEPTED,
    api: { cancelJob: { error: { status: 500, data: {} } } },
    steps: confirm,
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => ({
  ...screenState("data"),
  api: {
    ...DATA,
    getCustomerJobById: { data: entry.job },
    ...entry.api,
  },
  http: () => ({ text: SVG_ART }),
  lang: env.language,
  platform: env.platform,
  ...(entry.insets ? { insets: entry.insets } : {}),
  route: { name: NAME, params: { jobId: entry.job.id } },
})

describe("JobDetailScreen's food order, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(load, options(entry, entry.env), entry.env, [
      ...(entry.steps ?? []),
      wait(0),
    ])
    expectParity(parityName(entry.state, entry.env), tree, { allow: BUTTON })
  })
})

type Action = {
  type: string
  payload?: { name?: string; params?: Record<string, any> }
}

describe("JobDetailScreen's food order: presses", () => {
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
    "the mail icon opens the kitchen's chat; the chevron goes back [$language $platform]",
    async (env) => {
      const session = await open(
        { state: "chat", job: FOOD_ACCEPTED, api: UNREAD },
        env
      )
      try {
        await run(session, env, [
          (root) => {
            // the mail icon's control also holds the unread count: not icon-only
            const found = root.findAll(
              (node) =>
                typeof node.props.onPress === "function" &&
                node.findAll((inner) => (inner.type as unknown) === "svg:mail")
                  .length > 0
            )
            found[found.length - 1].props.onPress()
          },
        ])
        const last = actions(session).at(-1)!
        expect(last.payload?.name).toBe("MessagesDetailsScreen")
        expect(last.payload?.params?.chatPreview.chat.id).toBe(CHAT.id)
        await run(session, env, [
          (root) => pressIcon(root, { icon: "svg:chevron-left" }),
        ])
        expect(actions(session).at(-1)!.type).toBe("GO_BACK")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "the details toggle hides and shows the bill [$language $platform]",
    async (env) => {
      const session = await open({ state: "toggle", job: FOOD_ACCEPTED }, env)
      try {
        expect(text(session)).toContain(copy(env, "order_total"))
        await run(session, env, [toggleDetails])
        expect(text(session)).not.toContain(copy(env, "order_total"))
        await run(session, env, [row("show_order_details")])
        expect(text(session)).toContain(copy(env, "order_total"))
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "the menu: details opens the record; Cancel is offered only before the kitchen cooks [$language $platform]",
    async (env) => {
      const early = await open({ state: "details", job: FOOD_ACCEPTED }, env)
      try {
        await run(early, env, [dots, row("my_request_details"), wait(600)])
        const last = actions(early).at(-1)!
        expect(last.payload?.name).toBe("RequestDetailsScreen")
        expect(last.payload?.params).toEqual({ jobId: JOB_FOOD.id })
      } finally {
        early.unmount()
      }
      const late = await open({ state: "late", job: FOOD_PREPARING }, env)
      try {
        await run(late, env, [dots])
        expect(text(late)).toContain(copy(env, "my_request_details"))
        expect(text(late)).not.toContain(copy(env, "cancel_order"))
      } finally {
        late.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "No keeps the order; Yes cancels it once with the marker, then the cancelled sheet's Done leaves [$language $platform]",
    async (env) => {
      const no = await open({ state: "no", job: FOOD_ACCEPTED }, env)
      try {
        await run(no, env, [...cancelOrder, titled("no"), wait(SETTLED)])
        expect(text(no)).not.toContain(copy(env, "are_you_sure_cancel"))
        expect(sent(no, "cancelJob")).toHaveLength(0)
      } finally {
        no.unmount()
      }
      const yes = await open(
        { state: "yes", job: FOOD_ACCEPTED, api: { cancelJob: { data: {} } } },
        env
      )
      try {
        await run(yes, env, confirm)
        expect(sent(yes, "cancelJob")).toHaveLength(1)
        expect(JSON.stringify(sent(yes, "cancelJob")[0].args)).toContain(
          "customer_cancelled_food_order"
        )
        expect(text(yes)).toContain(copy(env, "order_cancelled"))
        await run(yes, env, [titled("done"), wait(SETTLED)])
        expect(actions(yes).at(-1)!.type).toBe("GO_BACK")
      } finally {
        yes.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a refused cancel names why and OK closes the sheet [$language $platform]",
    async (env) => {
      const session = await open(
        {
          state: "409",
          job: FOOD_ACCEPTED,
          api: { cancelJob: { error: { status: 409, data: {} } } },
        },
        env
      )
      try {
        await run(session, env, confirm)
        expect(text(session)).toContain(
          copy(env, "food_order_already_preparing")
        )
        await run(session, env, [titled("OK"), wait(SETTLED)])
        expect(text(session)).not.toContain(
          copy(env, "food_order_already_preparing")
        )
      } finally {
        session.unmount()
      }
    }
  )
})
