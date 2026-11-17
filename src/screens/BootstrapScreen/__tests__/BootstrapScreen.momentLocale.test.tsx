import { describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import TestRenderer from "react-test-renderer"
import moment from "moment"

/*
 * BootstrapScreen's language effect sets moment's global locale to the app's
 * language (and registers the Arabic locale once), as proapp's does, so every
 * date formatted without its own `.locale()` reads in the app's language.
 * The navigator, the store and the API are stand-ins.
 */

let mockLanguage: "en" | "ar" = "en"
// moment's global locale as the first child draws, i.e. on the first frame.
const mockSeenByChild: string[] = []

jest.mock("navigation/Navigator", () => () => {
  mockSeenByChild.push((jest.requireActual("moment") as typeof moment).locale())
  return null
})
jest.mock("react-redux", () => ({ useDispatch: () => jest.fn() }))
jest.mock("store", () => ({
  useTypedSelector: (select: (state: unknown) => unknown) =>
    select({ auth: { language: mockLanguage, isAuth: false } }),
}))
jest.mock("store/cart/slice", () => ({ sweepStaleCarts: () => ({}) }))
jest.mock("services/api", () => ({
  useGetCustomerMeQuery: () => ({ data: undefined }),
  useUpdateCustomerMutation: () => [jest.fn()],
}))
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

import "locales/i18n"
import BootstrapScreen from "../BootstrapScreen"

const AT = "2026-10-20T12:47:00.000Z"

const draw = async (language: "en" | "ar") => {
  mockLanguage = language
  await act(async () => {
    TestRenderer.create(<BootstrapScreen />)
  })
}

describe("BootstrapScreen and moment", () => {
  it("loading the module leaves English global: the Arabic locale it registers does not leak", () => {
    expect(moment.locale()).toBe("en")
  })

  it("the first frame already reads the app's language, not the other one", async () => {
    mockSeenByChild.length = 0
    await draw("ar")
    expect(mockSeenByChild[0]).toBe("ar")
    await draw("en")
    expect(mockSeenByChild.at(-1)).toBe("en")
  })

  it("Arabic app: the global locale is Arabic, with the locale registered", async () => {
    await draw("ar")
    expect(moment.locale()).toBe("ar")
    expect(moment.utc(AT).format("dddd")).toBe("الثلاثاء")
  })

  it("English app: the global locale is English, never Arabic", async () => {
    await draw("ar")
    await draw("en")
    expect(moment.locale()).toBe("en")
    expect(moment.utc(AT).format("dddd")).toBe("Tuesday")
  })
})
