/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  wait,
  type Step,
} from "testing/screenKit"
import { pressContaining } from "testing/pressContaining"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { JOB } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { JobType } from "types/job"

import { JOB_REVIEWABLE } from "../../__fixtures__/jobStates"

/*
 * ReviewFormScreen: the review a customer leaves a pro. Every state of the
 * form: the pro's photo or initial (an individual, a company, none loaded), Yes
 * and No, the five star rows, a typed comment, the Submit button disabled,
 * ready, loading and answered, one to four photos picked (the picker answers
 * with paths here; on a device it is the gallery) and the full-screen viewer a
 * photo opens, at the phone widths the screen reads when it loads (the kit's
 * 402, and a 390 phone: SCREEN_WIDTH sizes the carousel; a form with no viewer
 * draws the same at both, so only the viewer has a 390 row). Every pressable is
 * pressed: the rows reach their states by pressing, and the tests below check
 * what a press does that a tree can't show.
 */

const NAME = "ReviewFormScreen"
const PHOTOS = ["file:///parity/a.jpg", "file:///parity/b.jpg"]
const FOUR = [...PHOTOS, "file:///parity/c.jpg", "file:///parity/d.jpg"]

// Submit is an ActionBtn before the conversion and a ds Button after it.
const BUTTON: ParityAllowance[] = []

/** The screen, with the gallery answering `paths` the first time it is opened. */
const loader =
  (paths: string[] = FOUR) =>
  () => {
    const picker = require("react-native-image-crop-picker").default
    picker.openPicker = () => Promise.resolve(paths.map((path) => ({ path })))
    return require("../ReviewFormScreen")
  }

const press =
  (title: string): Step =>
  (root) => {
    pressTitled(root, title)
  }

const star =
  (row: number, value: number): Step =>
  (root) => {
    // five stars a row, in screen order, after the header's chevron
    pressIcon(root, { icon: "svg:star", nth: row * 5 + value - 1 })
  }

const FILL_SCORES = [0, 1, 2, 3, 4].map((row) => star(row, row + 1))
const SOME_SCORES = [star(0, 5), star(1, 3), star(2, 1)]

const comment =
  (text: string): Step =>
  (root) => {
    const input = root.findAll(
      (node) => (node.type as unknown) === "TextInput"
    )[0]
    input.props.onChangeText(text)
  }

const upload =
  (env: ParityEnv): Step =>
  (root) => {
    pressContaining(root, copy(env, "upload_photos_videos"))
  }

const deletePhoto =
  (nth: number): Step =>
  (root) => {
    pressIcon(root, { icon: "svg:close", nth })
  }

const preview =
  (nth: number): Step =>
  (root) => {
    pressIcon(root, { icon: "Image", nth })
  }

type Case = {
  state: string
  /** The pro the form is for (the kit's JOB_REVIEWABLE has them all). */
  proId?: number
  job?: JobType | "loading"
  photos?: string[]
  window?: { width: number }
  steps?: (env: ParityEnv) => Step[]
  allow?: ParityAllowance[]
}

const YES = (env: ParityEnv) => press(copy(env, "yes"))

const submitLoading = (env: ParityEnv): Step[] => [
  YES(env),
  ...FILL_SCORES,
  press(copy(env, "submit_review")),
]

const CASES: Case[] = [
  { state: "the job is still loading", job: "loading" },
  { state: "a new form, a pro with a photo" },
  { state: "a new form, a company", proId: 1005 },
  { state: "a new form, a pro with no photo", proId: 1004 },
  { state: "Yes", steps: (env) => [YES(env)] },
  { state: "No", steps: (env) => [press(copy(env, "no"))] },
  { state: "three rows scored", steps: () => SOME_SCORES },
  { state: "every row scored, no answer yet", steps: () => FILL_SCORES },
  { state: "ready to submit", steps: (env) => [YES(env), ...FILL_SCORES] },
  {
    state: "ready, with a comment",
    steps: (env) => [YES(env), ...FILL_SCORES, comment("Clean work, on time.")],
  },
  { state: "submitting", steps: submitLoading },
  { state: "two photos", steps: (env) => [upload(env)], photos: PHOTOS },
  { state: "four photos", steps: (env) => [upload(env)] },
  {
    state: "the viewer on the first photo",
    steps: (env) => [upload(env), preview(0)],
  },
  {
    state: "the viewer on the third photo",
    steps: (env) => [upload(env), preview(2)],
  },
  {
    // the thumbnails come after the four previews among the screen's pressable images
    state: "the viewer on the second thumbnail",
    steps: (env) => [upload(env), preview(0), preview(5)],
  },
  {
    state: "the viewer, a 390 phone",
    window: { width: 390 },
    steps: (env) => [upload(env), preview(0)],
  },
  {
    state: "four photos, the first deleted",
    steps: (env) => [upload(env), deletePhoto(0)],
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => ({
  ...screenState("data"),
  api: {
    ...DATA,
    getCustomerJobById:
      entry.job === "loading"
        ? ("loading" as const)
        : { data: entry.job ?? JOB_REVIEWABLE },
  },
  lang: env.language,
  platform: env.platform,
  ...(entry.window ? { window: entry.window } : {}),
  route: {
    name: NAME,
    params: { jobId: JOB.id, proId: entry.proId ?? 1001 },
  },
})

describe("ReviewFormScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(
      loader(entry.photos),
      options(entry, entry.env),
      entry.env,
      [...(entry.steps?.(entry.env) ?? []), wait(0)]
    )
    expectParity(parityName(entry.state, entry.env), tree, {
      allow: entry.allow ?? BUTTON,
    })
  })
})

type Action = { type: string; payload?: { name?: string } }

describe("ReviewFormScreen: presses", () => {
  const open = async (
    env: ParityEnv,
    more: Record<string, unknown> = {},
    answers: Record<string, unknown> = {}
  ) => {
    const base = options({ state: "press" }, env)
    const session = await openScreen(loader(), {
      ...base,
      api: { ...base.api, ...answers },
      ...more,
    })
    const { Alert } = require("react-native")
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
    return { session, alert }
  }

  const act = (
    session: Awaited<ReturnType<typeof openScreen>>,
    env: ParityEnv,
    steps: Step[]
  ) =>
    steps.reduce(
      (previous, step) =>
        previous.then(() =>
          session.act(() => {
            step(session.root, env)
          })
        ),
      Promise.resolve()
    )

  it.each(PARITY_MATRIX)(
    "the chevron goes back [$language $platform]",
    async (env) => {
      const { session } = await open(env)
      try {
        await act(session, env, [
          (root) => pressIcon(root, { icon: "svg:chevron-left" }),
        ])
        expect(
          session.navigation.actions.map((action) => (action as Action).type)
        ).toEqual(["GO_BACK"])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Submit sends the review once and says so [$language $platform]",
    async (env) => {
      const { session, alert } = await open(
        env,
        {},
        { createReview: { data: { id: 1 } } }
      )
      try {
        await act(session, env, [
          YES(env),
          star(0, 5),
          star(1, 4),
          star(2, 3),
          star(3, 2),
          star(4, 1),
          comment("Clean work, on time."),
          press(copy(env, "submit_review")),
        ])
        const sent = session
          .requests()
          .filter((request) => request.endpoint === "createReview")
        expect(sent).toHaveLength(1)
        expect(JSON.stringify(sent[0].args)).toContain(
          JSON.stringify({
            jobId: JOB.id,
            proId: 1001,
            qualityScore: 5,
            completionInTimeScore: 4,
            jobAwarenessScore: 3,
            honestyScore: 2,
            responseTimeScore: 1,
            comment: "Clean work, on time.",
            proCompletedJob: true,
          }).slice(1, -1)
        )
        expect(alert).toHaveBeenCalledTimes(1)
        expect(alert.mock.calls[0][0]).toBe(copy(env, "review_submitted"))
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a refused review says so, and No sends proCompletedJob false [$language $platform]",
    async (env) => {
      const { session, alert } = await open(
        env,
        {},
        {
          createReview: {
            error: { status: 400, data: { message: "Already reviewed" } },
          },
        }
      )
      try {
        await act(session, env, [
          press(copy(env, "no")),
          ...FILL_SCORES,
          press(copy(env, "submit_review")),
        ])
        const sent = session
          .requests()
          .filter((request) => request.endpoint === "createReview")
        expect(sent).toHaveLength(1)
        expect(JSON.stringify(sent[0].args)).toContain(
          '"proCompletedJob":false'
        )
        expect(JSON.stringify(sent[0].args)).toContain('"comment":" "')
        expect(alert).toHaveBeenCalledWith(
          copy(env, "error"),
          "Already reviewed"
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Submit does nothing until the form is complete [$language $platform]",
    async (env) => {
      const { session } = await open(env)
      try {
        await act(session, env, [YES(env), ...SOME_SCORES])
        expect(() =>
          pressTitled(session.root, copy(env, "submit_review"))
        ).toThrow(/disabled/)
        expect(
          session
            .requests()
            .filter((request) => request.endpoint === "createReview")
        ).toHaveLength(0)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a photo opens the viewer, its X closes it, a delete removes the photo [$language $platform]",
    async (env) => {
      const { session } = await open(env)
      try {
        const viewers = () =>
          session.root.findAll(
            (node) =>
              (node.type as unknown) === "Modal" && node.props.visible === true
          ).length
        await act(session, env, [upload(env)])
        expect(viewers()).toBe(0)
        await act(session, env, [preview(1)])
        expect(viewers()).toBe(1)
        // the four previews' delete crosses come first, the viewer's close last
        await act(session, env, [deletePhoto(4)])
        expect(viewers()).toBe(0)
        const images = () =>
          session.root.findAll(
            (node) =>
              (node.type as unknown) === "Image" &&
              typeof node.props.style?.width === "number" &&
              node.props.style.width === 80
          ).length
        expect(images()).toBe(4)
        await act(session, env, [deletePhoto(0)])
        expect(images()).toBe(3)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a refused gallery says why instead of opening it [$language $platform]",
    async (env) => {
      const { session, alert } = await open(env, {
        permissions: {
          "ios.permission.PHOTO_LIBRARY": "denied",
          "android.permission.READ_MEDIA_IMAGES": "denied",
          "android.permission.READ_EXTERNAL_STORAGE": "denied",
        },
      })
      try {
        await act(session, env, [upload(env)])
        expect(alert).toHaveBeenCalledTimes(1)
        expect(alert.mock.calls[0][0]).toBe(copy(env, "permission_denied"))
        expect(
          session.root.findAll(
            (node) =>
              (node.type as unknown) === "Image" &&
              node.props.style?.width === 80
          )
        ).toHaveLength(0)
      } finally {
        session.unmount()
      }
    }
  )
})
