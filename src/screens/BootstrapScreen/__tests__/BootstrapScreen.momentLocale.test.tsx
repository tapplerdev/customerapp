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

jest.mock("navigation/Navigator", () => () => null)
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

const AT = "2026-10-20T08:47:00.000Z"

const draw = async (language: "en" | "ar") => {
  mockLanguage = language
  await act(async () => {
    TestRenderer.create(<BootstrapScreen />)
  })
}

describe("BootstrapScreen and moment", () => {
  it("Arabic app: the global locale is Arabic, with the locale registered", async () => {
    await draw("ar")
    expect(moment.locale()).toBe("ar")
    expect(moment(AT).format("dddd")).toBe("الثلاثاء")
  })

  it("English app: the global locale is English, never Arabic", async () => {
    await draw("ar")
    await draw("en")
    expect(moment.locale()).toBe("en")
    expect(moment(AT).format("dddd")).toBe("Tuesday")
  })
})
