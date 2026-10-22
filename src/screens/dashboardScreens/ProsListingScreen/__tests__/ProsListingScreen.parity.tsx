/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  rowsByPlatform,
  treeAfter,
  typeInto,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, ERROR, SERVER_ERROR, urlOf } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  CATEGORY_FOOD,
  CHAT,
  PRO_COMPANY,
  PRO_FOOD,
  PRO_INDIVIDUAL,
  SERVICE_FOOD,
} from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { ProType } from "types/pro"

import {
  SERVICE_FOOD_FILTERS,
  SERVICE_PLAIN,
  SERVICE_RICH,
} from "../__fixtures__/discover"

/*
 * ProsListingScreen (the pros for a category, with its three sheets),
 * captured from the unconverted code. The listing: loading, the pros, none,
 * a failed list, a food listing (its Food Menu cards), a service that won't
 * load before the question flow is known (the gate, its error and Try again)
 * and one still loading; the job-details banner; a pro selected, two
 * selected (the Continue button), a selection a filter then drops (the
 * shortlist notice), a refetch in flight, a chat still on its way, a failed chat. The three sheets, each opened by what a customer presses: the
 * question flow (it opens by itself when no place of service is known; its
 * place, question and last steps, then Done), the job-details editor (the
 * banner) and the filters (the slider icon), plain, with a pick, with typed
 * ranges, after the flow's answers (the upfront picks "chosen earlier") and
 * for food. The search pill opens the service and location sheet. Then the
 * presses, each exactly once. The tour's tip is TooltipComponent's own test:
 * rn-tourguide draws it only once its zones have been measured.
 */

const load = () => require("../ProsListingScreen")

// ---------------------------------------------------------------------------
// Data

const page = (rows: ProType[]) => ({ data: rows, page: 1, perPage: 20, total: rows.length })
const PROS = [PRO_INDIVIDUAL, PRO_COMPANY]
const FOOD_PROS: ProType[] = [
  PRO_FOOD,
  { ...PRO_FOOD, id: 1004, registeredName: "Mama's Oven", businessName: "Mama's Oven", screenName: "Mama", distanceKm: 0.6, isDeliveryEnabled: false },
]

/** The pros a list request gets: the type the filter asks for, else all. */
const prosFor =
  (rows: ProType[]) =>
  (args: unknown) => {
    const url = urlOf(args)
    const kept = url.includes("proType=individual")
      ? rows.filter((pro) => pro.proType === "individual")
      : url.includes("proType=company")
        ? rows.filter((pro) => pro.proType === "company")
        : url.includes("placeOfService=pickup")
          ? rows.filter((pro) => pro.isPickupEnabled)
          : rows
    return { data: page(kept) }
  }

const RICH = {
  ...DATA,
  getServiceById: { data: SERVICE_RICH },
  getProsForCategory: prosFor(PROS),
}
const FOOD = {
  ...DATA,
  getServiceById: { data: SERVICE_FOOD_FILTERS },
  getProsForCategory: prosFor(FOOD_PROS),
}

const PARAMS = ROUTE_PARAMS.ProsListingScreen as object
const route = (params: object = {}) => ({
  name: "ProsListingScreen",
  params: { ...PARAMS, ...params },
})
const NO_PLACE = { placeOfService: undefined }
const FOOD_PARAMS = {
  categoryId: CATEGORY_FOOD.id,
  categoryName: CATEGORY_FOOD.nameEn,
  serviceId: SERVICE_FOOD.id,
  placeOfService: undefined,
}

const SIGNED = screenState("data")
const withApi = (api: object, params?: object) => ({
  ...SIGNED,
  api,
  route: route(params),
})
/** Signed in, the tour's tip not yet dismissed: the first card is the tour's zone either way. */
const jobDetails = (env: ParityEnv, answered: number, total: number) =>
  copy(env, "job_details_added")
    .replace("{{answered}}", String(answered))
    .replace("{{total}}", String(total))

// ---------------------------------------------------------------------------
// What a customer presses

const filtersIcon: Step = (root) => pressIcon(root, { icon: "svg:filter-sliders" })
const jobBanner = (answered: number, total: number): Step => (root, env) =>
  pressText(root, jobDetails(env, answered, total))
/**
 * The words in the row's language: a fixture's own (their Arabic below) or
 * one of the app's strings (its key).
 */
const FIXTURE_AR: Record<string, string> = {
  Repair: "إصلاح",
  "The tap": "الصنبور",
  "Any brand": "أي علامة",
  Italian: "إيطالي",
}
const APP_KEYS: Record<string, string> = {
  Individual: "individual",
  Delivery: "delivery",
  Pickup: "pickup",
}
const words = (env: ParityEnv, label: string) =>
  APP_KEYS[label]
    ? copy(env, APP_KEYS[label])
    : env.language === "ar"
      ? (FIXTURE_AR[label] ?? label)
      : label
/** A filter chip (its words are exactly the label) and a question's option row. */
const chip = (label: string): Step => (root, env) => pressText(root, words(env, label))
const option = (label: string): Step => (root, env) => pressContaining(root, words(env, label))
/** Next on the nth card of the question flow's stack (each visited card stays mounted). */
const next = (nth: number): Step => (root, env) => pressText(root, copy(env, "next"), { nth })
const done = (nth: number): Step => (root, env) => pressText(root, copy(env, "done"), { nth })
const place = (key: string): Step => (root, env) => pressContaining(root, copy(env, key))
const selectMe = (nth: number): Step => (root, env) => pressText(root, copy(env, "select_me"), { nth })
const showResults: Step = (root, env) => pressTitledIn(root, copy(env, "show_results"))
const seeMatches: Step = (root, env) => pressTitledIn(root, copy(env, "see_matches"))
const resetAll: Step = (root, env) => pressText(root, copy(env, "reset_all"))
const wait = (ms: number): Step => Object.assign(() => undefined, { settleMs: ms })

// A Button is pressed by its title; the kit's helper is imported lazily so this file's
// top-level imports stay data only.
const pressTitledIn = (root: Parameters<Step>[0], title: string) =>
  require("testing/screenKit").pressTitled(root, title)

const FLOW_TO_DONE: Step[] = [
  place("at_my_location"),
  next(0),
  option("Repair"),
  next(1),
  option("The tap"),
  next(2),
  (root) => typeInto(root, 0, "Under the sink."),
]

// ---------------------------------------------------------------------------
// The rows

type Case = {
  state: string
  options: Omit<RenderScreenOptions, "lang" | "platform">
  steps?: Step[]
  // Button's listed deltas, on the rows whose tree holds a Button the conversion makes.
  allow?: ParityAllowance[]
}

// Button's two listed deltas, on the states whose tree holds a Button a conversion made: Continue
// (a pro selected; and the shortlist-notice row, which selects one), the gate's Try again (the
// listing's conversion), Show results on every row with the filters sheet open and See matches on every row with the
// job-details editor open (their own).
// Emptied or cut to one, each of those rows fails; no other row needs them.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const CASES: Case[] = [
  // The listing
  { state: "loading", options: withApi({ ...DATA, getProsForCategory: "loading" }) },
  { state: "the pros", options: withApi(DATA) },
  // (An empty list and a failed one draw the same: no pros found.)
  { state: "no pros, or the list failed", options: withApi({ ...DATA, getProsForCategory: SERVER_ERROR }) },
  { state: "a food listing", options: withApi(FOOD, FOOD_PARAMS) },
  { state: "a food listing with no pros", options: withApi({ ...FOOD, getProsForCategory: { data: page([]) } }, FOOD_PARAMS) },
  { state: "the service is still loading, place unknown (the gate's spinner)", options: withApi({ ...DATA, getServiceById: "loading" }, NO_PLACE) },
  { state: "the service failed, place unknown (the gate's error)", options: withApi({ ...DATA, getServiceById: SERVER_ERROR }, NO_PLACE), allow: BUTTON },
  { state: "every call failed", options: { ...SIGNED, api: ERROR, route: route() } },
  { state: "five questions asked, a place chosen", options: withApi(RICH) },
  { state: "one plain question, a place chosen", options: withApi({ ...DATA, getServiceById: { data: SERVICE_PLAIN } }) },
  { state: "an answered repost's banner", options: withApi(RICH, { initialAnswers: [{ questionId: 801, optionId: 8011 }, { questionId: 806, answer: "Hello" }] }) },
  // Selecting
  { state: "one pro selected, the Continue button", options: withApi(DATA), steps: [selectMe(0), wait(1000)], allow: BUTTON },
  { state: "both selected", options: withApi(DATA), steps: [selectMe(0), selectMe(0), wait(1000)], allow: BUTTON },
  // The question flow
  { state: "the flow opens by itself: the place step", options: withApi(RICH, NO_PLACE) },
  { state: "the flow, a place chosen", options: withApi(RICH, NO_PLACE), steps: [place("at_my_location")] },
  { state: "the flow's second card", options: withApi(RICH, NO_PLACE), steps: [place("at_my_location"), next(0), wait(600)] },
  { state: "the flow's answer picked", options: withApi(RICH, NO_PLACE), steps: [place("at_my_location"), next(0), wait(600), option("Repair")] },
  { state: "the flow's last card, Done", options: withApi(RICH, NO_PLACE), steps: [...FLOW_TO_DONE, wait(600)] },
  { state: "the flow done, the list narrowed", options: withApi(RICH, NO_PLACE), steps: [...FLOW_TO_DONE, wait(600), done(0), wait(1000)] },
  { state: "the flow with one plain question (no place step)", options: withApi({ ...DATA, getServiceById: { data: SERVICE_PLAIN } }, NO_PLACE) },
  // The job-details editor
  { state: "the job-details editor", options: withApi(RICH), steps: [jobBanner(1, 4)] , allow: BUTTON },
  { state: "the editor, answers picked", options: withApi(RICH), steps: [jobBanner(1, 4), place("at_pro_location"), option("Repair"), option("The tap"), (root) => typeInto(root, 0, "Hello")] , allow: BUTTON },
  { state: "the editor, See matches", options: withApi(RICH), steps: [jobBanner(1, 4), option("Repair"), seeMatches, wait(1000)] },
  { state: "the editor with a single place", options: withApi({ ...DATA, getServiceById: { data: SERVICE_PLAIN } }), steps: [jobBanner(1, 1)] , allow: BUTTON },
  // The filters
  { state: "the filters", options: withApi(RICH, { placeOfService: "proToCustomer" }), steps: [filtersIcon] , allow: BUTTON },
  { state: "the filters, online (no distance)", options: withApi(RICH), steps: [filtersIcon] , allow: BUTTON },
  { state: "the filters, pro type and rating picked", options: withApi(RICH, { placeOfService: "proToCustomer" }), steps: [filtersIcon, chip("Individual"), chip("4+ ★")] , allow: BUTTON },
  { state: "the filters, a budget typed", options: withApi(RICH, { placeOfService: "proToCustomer" }), steps: [filtersIcon, (root) => typeInto(root, 0, "250"), (root) => typeInto(root, 1, "700"), (root) => typeInto(root, 3, "40")] , allow: BUTTON },
  { state: "the filters, a distance typed", options: withApi(RICH, { placeOfService: "proToCustomer" }), steps: [filtersIcon, (root) => typeInto(root, 4, "12")] , allow: BUTTON },
  { state: "the filters, any brand picked", options: withApi(RICH), steps: [filtersIcon, chip("Any brand")] , allow: BUTTON },
  { state: "the filters after the flow: the upfront pick chosen earlier", options: withApi(RICH, NO_PLACE), steps: [...FLOW_TO_DONE, wait(600), done(0), wait(1000), filtersIcon] , allow: BUTTON },
  { state: "the food filters", options: withApi(FOOD, FOOD_PARAMS), steps: [filtersIcon] , allow: BUTTON },
  { state: "the food filters, delivery and a cuisine picked", options: withApi(FOOD, FOOD_PARAMS), steps: [filtersIcon, chip("Delivery"), chip("Italian")] , allow: BUTTON },
  { state: "the food filters applied: the pickup list", options: withApi(FOOD, FOOD_PARAMS), steps: [filtersIcon, chip("Pickup"), showResults, wait(1000)] },
  { state: "the filters applied: individuals only", options: withApi(RICH), steps: [filtersIcon, chip("Individual"), showResults, wait(1000)] },
  { state: "the filters applied, the answer still on its way (the overlay)", options: withApi({ ...RICH, getProsForCategory: (args: unknown) => urlOf(args).includes("proType") ? "loading" : prosFor(PROS)(args) }), steps: [filtersIcon, chip("Individual"), showResults, wait(300)] },
  { state: "a selection a filter drops: the shortlist notice", options: withApi(RICH), steps: [selectMe(0), selectMe(0), wait(500), filtersIcon, chip("Individual"), showResults, wait(1000)], allow: BUTTON },
  // The rest
  { state: "the search pill", options: withApi(DATA), steps: [(root) => pressText(root, "Plumbing • Dokki"), wait(600)] },
  { state: "chat on its way (the overlay)", options: withApi({ ...DATA, openChat: "loading" }), steps: [(root) => pressIcon(root, { icon: "svg:messages-red", nth: 0 }), wait(600)] },
  { state: "chat failed (the error card)", options: withApi({ ...DATA, openChat: SERVER_ERROR }), steps: [(root) => pressIcon(root, { icon: "svg:messages-red", nth: 0 }), wait(600)] },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("ProsListingScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, options, steps, allow, env }) => {
    const tree = await treeAfter(
      load,
      { ...options, lang: env.language, platform: env.platform },
      env,
      steps
    )
    expectParity(parityName(state, env), tree, allow ? { allow } : undefined)
  })
})

describe.each(PARITY_MATRIX)("ProsListingScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (options: object = withApi(DATA)) =>
    openScreen(load, { ...options, lang: env.language, platform: env.platform } as RenderScreenOptions)
  type Session = Awaited<ReturnType<typeof open>>
  const act = (session: Session, press: () => void) => session.act(() => { press() })
  const navigated = (session: Session) =>
    session.navigation.actions.map((action) => ({ type: action.type, ...(action.payload as object) }))

  it("Continue sends the selected pros to the request details, once", async () => {
    const session = await open()
    try {
      await act(session, () => pressText(session.root, copy(env, "select_me"), { nth: 0 }))
      await act(session, () => pressText(session.root, copy(env, "select_me"), { nth: 0 }))
      await session.settle(1000)
      await act(session, () => require("testing/screenKit").pressTitled(session.root, copy(env, "continue")))
      expect(navigated(session)).toEqual([
        expect.objectContaining({
          name: "ServiceRequestDetailsScreen",
          params: expect.objectContaining({
            categoryId: 301,
            selectedProIds: [PRO_INDIVIDUAL.id, PRO_COMPANY.id],
            selectedProNames: `${PRO_INDIVIDUAL.registeredName}, ${PRO_COMPANY.businessName}`,
            placeOfService: "customerPlace",
          }),
        }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("the back chevron goes back", async () => {
    const session = await open()
    try {
      await act(session, () => pressIcon(session.root, { icon: "svg:chevron-left" }))
      expect(navigated(session)).toEqual([expect.objectContaining({ type: "GO_BACK" })])
    } finally {
      session.unmount()
    }
  })

  it("a card's photo area opens the pro's profile; chat opens the chat", async () => {
    const session = await open(
      withApi({ ...DATA, getProProfile: { data: PRO_INDIVIDUAL }, openChat: { data: CHAT } })
    )
    try {
      await act(session, () => pressContaining(session.root, PRO_INDIVIDUAL.registeredName))
      await session.settle(500)
      await act(session, () => pressIcon(session.root, { icon: "svg:messages-red", nth: 0 }))
      await session.settle(1000)
      expect(navigated(session)).toEqual([
        expect.objectContaining({
          name: "ProProfileScreen",
          params: expect.objectContaining({ proId: PRO_INDIVIDUAL.id, serviceCategoryId: 301 }),
        }),
        expect.objectContaining({
          name: "MessagesDetailsScreen",
          params: { chatPreview: { chat: CHAT, notReadMessages: 0 } },
        }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("a food card's action opens the pro's menu", async () => {
    const session = await open(withApi(FOOD, FOOD_PARAMS))
    try {
      await act(session, () => pressText(session.root, copy(env, "food_menu"), { nth: 0 }))
      expect(navigated(session)).toEqual([
        expect.objectContaining({
          name: "FoodMenuScreen",
          params: expect.objectContaining({ proId: PRO_FOOD.id, serviceCategoryId: CATEGORY_FOOD.id, serviceId: SERVICE_FOOD.id }),
        }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("Try again asks for the service again", async () => {
    const session = await open(withApi({ ...DATA, getServiceById: SERVER_ERROR }, NO_PLACE))
    try {
      const asked = () => session.requests().filter((request) => request.endpoint === "getServiceById").length
      const before = asked()
      await act(session, () => require("testing/screenKit").pressTitled(session.root, copy(env, "try_again")))
      expect(asked()).toBeGreaterThan(before)
    } finally {
      session.unmount()
    }
  })

  it("the question flow's Done asks for the narrowed list once, with the answers' filter ids", async () => {
    const session = await open(withApi(RICH, NO_PLACE))
    try {
      for (const step of [...FLOW_TO_DONE, wait(600), done(0)]) {
        // eslint-disable-next-line no-await-in-loop
        await session.act(() => step(session.root, env), step.settleMs)
      }
      await session.settle(1000)
      const lists = session
        .requests()
        .filter((request) => request.endpoint === "getProsForCategory")
        .map((request) => decodeURIComponent(urlOf(request.args)))
      expect(lists.length).toBeGreaterThanOrEqual(2)
      expect(lists[lists.length - 1]).toContain("filterOptionsIds[]=9011")
      expect(lists[lists.length - 1]).toContain("placeOfService=proToCustomer")
    } finally {
      session.unmount()
    }
  })

  it("Reset all puts the job-details editor and the filters back as they opened", async () => {
    // (The place the screen was opened with is cleared by Reset all too, so the
    // editor starts from a place no option matches.)
    const session = await open(withApi(RICH))
    try {
      await act(session, () => pressText(session.root, jobDetails(env, 1, 4)))
      await session.settle(500)
      const opened = JSON.stringify(session.tree())
      await act(session, () => option("Repair")(session.root, env))
      expect(JSON.stringify(session.tree())).not.toEqual(opened)
      await act(session, () => resetAll(session.root, env))
      expect(JSON.stringify(session.tree())).toEqual(opened)
    } finally {
      session.unmount()
    }
    const filters = await open(withApi(RICH, { placeOfService: "proToCustomer" }))
    try {
      await act(filters, () => filtersIcon(filters.root, env))
      await filters.settle(500)
      const opened = JSON.stringify(filters.tree())
      await act(filters, () => chip("Individual")(filters.root, env))
      expect(JSON.stringify(filters.tree())).not.toEqual(opened)
      await act(filters, () => resetAll(filters.root, env))
      expect(JSON.stringify(filters.tree())).toEqual(opened)
    } finally {
      filters.unmount()
    }
  })
})

describe("what the rows drew", () => {
  const env: ParityEnv = { language: "en", platform: "ios" }
  const drawn = async (state: string) => {
    const entry = CASES.find((c) => c.state === state)
    if (!entry) throw new Error(`no row "${state}"`)
    return JSON.stringify(
      await treeAfter(load, { ...entry.options, lang: env.language, platform: env.platform }, env, entry.steps)
    )
  }
  const has = (tree: string, ...words: string[]) => words.forEach((w) => expect(tree).toContain(w))
  const hasNot = (tree: string, ...words: string[]) => words.forEach((w) => expect(tree).not.toContain(w))

  it("the sheets drew what their rows say", async () => {
    has(await drawn("the flow opens by itself: the place step"), "How do you want this service?", "At the pro's location", "Next")
    has(await drawn("the flow's last card, Done"), "Anything the pro should know?", "Done")
    has(await drawn("the job-details editor"), "Job Details", "Anything else to fix?", "Reset all", "See matches", "Online / Remote")
    has(await drawn("the filters"), "Filters", "Which brand do you use?", "Your budget", "Area in square metres", "Distance (km)", "Minimum rating", "Payment method")
    hasNot(await drawn("the filters, online (no distance)"), "Distance (km)")
    has(await drawn("the filters after the flow: the upfront pick chosen earlier"), "What kind of job is it?", "chosen earlier", "Repair", "Ideal Standard")
    hasNot(await drawn("the filters"), "Ideal Standard")
    has(await drawn("the food filters"), "Fulfillment", "Cuisines", "Egyptian", "Italian")
    hasNot(await drawn("the food filters"), "No filter id", "I make food from")
  })

  it("the listing rows drew their lists, notices and overlays", async () => {
    has(await drawn("a selection a filter drops: the shortlist notice"), "Shortlist updated", "1 matches based on your answers")
    has(await drawn("the filters applied: individuals only"), "1 matches based on your answers")
    hasNot(await drawn("the filters applied: individuals only"), "Hassan Home Services")
    has(await drawn("both selected"), "Continue", "Selected")
    has(await drawn("the service failed, place unknown (the gate's error)"), "An error occurred", "Try Again")
    has(await drawn("a food listing"), "Food Menu", "Mama", "available")
    has(await drawn("the flow done, the list narrowed"), "Plumbing", "4 of 4 job details added")
    has(await drawn("the search pill"), "Plumbing")
  })
})
