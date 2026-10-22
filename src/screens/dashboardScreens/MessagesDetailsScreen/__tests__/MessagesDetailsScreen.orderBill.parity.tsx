/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressText,
  rowsByPlatform,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import {
  CHAT,
  CHAT_PREVIEW,
  JOB_FOOD,
} from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * The chat's "My Request" sheet for a food order, which ends in the itemised
 * bill. OrderBill is imported by file path, so the `className` the sheet gave
 * it (:862) reached the bill as a style it never read: captured before W1's
 * prep deleted it. Delivery and pickup, because the bill's delivery line
 * follows it.
 */

const load = () => require("../MessagesDetailsScreen")

const foodPreview = (placeOfService: string) => ({
  ...CHAT_PREVIEW,
  chat: {
    ...CHAT,
    jobId: JOB_FOOD.id,
    job: { ...JOB_FOOD, placeOfService },
  },
})

const CASES = [
  { name: "my request, food delivery", placeOfService: "customerPlace" },
  { name: "my request, food pickup", placeOfService: "pickup" },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("MessagesDetails food request sheet, captured before the dead className went", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (row) => {
    const { env } = row
    const preview = foodPreview(row.placeOfService)
    const session = await openScreen(load, {
      ...screenState("data"),
      api: {
        ...screenState("data").api,
        // The screen prefers the live chat list's entry over the route's.
        getChats: { data: { data: [preview] } },
        getCustomerJobDetails: { data: preview.chat.job },
      },
      lang: env.language,
      platform: env.platform,
      route: {
        name: "MessagesDetailsScreen",
        params: { chatPreview: preview },
      },
    })
    try {
      await session.act(() => {
        pressText(session.root, copy(env, "my_request"))
      })
      expectParity(parityName(row.name, env), session.tree())
    } finally {
      session.unmount()
    }
  })
})
