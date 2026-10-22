import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * The live half of hostTreeParity.test.tsx (`yarn test:pass1-tools`): the
 * class-name and ActionBtn sides of its fixture, drawn with NativeWind on.
 * - "row": the class-name row the fixture's first four cases were captured
 *   from (the kept test compares the token row with them);
 * - "actionBtn", "actionBtn without onPress", "actionBtn disabled",
 *   "actionBtn loading": a real ActionBtn, the trees the kept test's
 *   allowance rows compare Button with
 *   (`yarn ds:parity:capture <this file> -t ActionBtn` captured them);
 * - DmText resolving its own faces and line heights per language.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import {
  PARITY_MATRIX,
  expectParity,
  hostTree,
  parityName,
  type HostNode,
} from "../hostTreeParity"
/* eslint-enable import/first */

const FIXTURE = path.join(__dirname, "__parity__", "hostTreeParity.test.json")
const noop = () => undefined

// The row the fixture's "row" cases were captured from.
const before = () => (
  <DmView className="flex-row px-[16] pt-[20]">
    <DmText className="text-15 leading-[19px] font-custom600">
      Account details
    </DmText>
  </DmView>
)

describe("the fixture's class-name row, live", () => {
  it.each(PARITY_MATRIX)("the before tree [$language $platform]", (env) => {
    expectParity(parityName("row", env), hostTree(before(), env), {
      file: FIXTURE,
    })
  })

  it("English and Arabic resolve DmText's own faces and line heights", () => {
    const text = (tree: HostNode | null) =>
      (tree?.children[0] as HostNode).props.style
    expect(text(hostTree(before(), { language: "en" }))).toMatchObject({
      fontFamily: "Montserrat-SemiBold",
      lineHeight: 19,
    })
    expect(text(hostTree(before(), { language: "ar" }))).toMatchObject({
      fontFamily: "TheSans-Bold",
      lineHeight: 19 * 1.32,
    })
  })
})

describe("a real ActionBtn, live", () => {
  it.each(PARITY_MATRIX)(
    "draws the fixture's ActionBtn [$language $platform]",
    (env) => {
      expectParity(
        parityName("actionBtn", env),
        hostTree(<ActionBtn title="Save" onPress={noop} />, env),
        { file: FIXTURE }
      )
    }
  )

  it.each(PARITY_MATRIX)(
    "draws the fixture's ActionBtn without onPress [$language $platform]",
    (env) => {
      // `disable || isLoading` is false here, and ActionBtn hands it on.
      expectParity(
        parityName("actionBtn without onPress", env),
        hostTree(<ActionBtn title="Save" isLoading={false} />, env),
        { file: FIXTURE }
      )
    }
  )

  it.each(PARITY_MATRIX)(
    "draws the fixture's disabled ActionBtn [$language $platform]",
    (env) => {
      expectParity(
        parityName("actionBtn disabled", env),
        hostTree(<ActionBtn title="Save" onPress={noop} disable />, env),
        { file: FIXTURE }
      )
    }
  )

  it.each(PARITY_MATRIX)(
    "draws the fixture's loading ActionBtn [$language $platform]",
    (env) => {
      expectParity(
        parityName("actionBtn loading", env),
        hostTree(<ActionBtn title="Save" onPress={noop} isLoading />, env),
        { file: FIXTURE }
      )
    }
  )
})
