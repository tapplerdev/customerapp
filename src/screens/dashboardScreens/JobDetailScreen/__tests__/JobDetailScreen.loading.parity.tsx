/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * JobDetail's loading skeleton (:546-565): the header's two bars, the heading
 * and the two pro rows. SkeletonLoader is imported by file path, so the
 * `className` five of its bars carry reached it as a style it never read
 * (the review saw a style twin make them draw marginTop 6/8/8/8/10 and these
 * rows fail 4/4): captured before W1's prep deleted them.
 */

const load = () => require("../JobDetailScreen")
const rows = rowsByPlatform([{ state: "loading" }], PARITY_MATRIX)

describe("JobDetailScreen loading skeleton, captured before the dead classNames went", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, env }) => {
    const tree = await renderScreen(load, {
      ...screenState("loading"),
      lang: env.language,
      platform: env.platform,
      route: {
        name: "JobDetailScreen",
        params: ROUTE_PARAMS.JobDetailScreen,
      },
    })
    expectParity(parityName(state, env), tree)
  })
})
