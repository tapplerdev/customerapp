/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { copy, openScreen } from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { GUEST_LOCATION } from "testing/screenKit/fixtures/users"
import { pressContaining } from "testing/pressContaining"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * AddressSelectionModal's rows do what they say: the last-used address hands
 * onSelectAddress the guest's address as it is; a saved address hands it the
 * saved street, city, governorate and the coordinates (lat, lon: the saved
 * ones' lng); New Location calls onSelectNewLocation. Each exactly once, and
 * none of the others. (A handler swapped for one that does nothing draws the
 * same tree until it is pressed.)
 */

const LAST_USED = GUEST_LOCATION!.address!

describe.each(PARITY_MATRIX)(
  "AddressSelectionModal's rows [$language $platform]",
  (env) => {
    const open = (
      who: ReturnType<typeof screenState>,
      handlers: Record<string, unknown>
    ) => {
      const load = () => {
        const React = require("react") as typeof import("react")
        const Modal = require("../AddressSelectionModal").default
        const Harness = () =>
          React.createElement(Modal, {
            isVisible: true,
            onClose: () => undefined,
            ...handlers,
          })
        return { default: Harness }
      }
      return openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        ...who,
      })
    }

    it("the last-used address hands over the guest's address", async () => {
      const onSelectAddress = jest.fn()
      const onSelectNewLocation = jest.fn()
      const session = await open(guestState("data"), {
        onSelectAddress,
        onSelectNewLocation,
      })
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "last_used_address"))
        })
        expect(onSelectAddress).toHaveBeenCalledTimes(1)
        expect(onSelectAddress).toHaveBeenCalledWith(LAST_USED)
        expect(onSelectNewLocation).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("a saved address hands over its street, city, governorate and coordinates", async () => {
      const onSelectAddress = jest.fn()
      const onSelectNewLocation = jest.fn()
      const session = await open(screenState("data"), {
        onSelectAddress,
        onSelectNewLocation,
      })
      try {
        await session.act(() => {
          pressContaining(session.root, "3 Nile Corniche")
        })
        expect(onSelectAddress).toHaveBeenCalledTimes(1)
        expect(onSelectAddress).toHaveBeenCalledWith({
          address: "3 Nile Corniche",
          city: "Zamalek",
          governorate: "Cairo",
          coords: { lat: 30.0626, lon: 31.2197 },
        })
        await session.act(() => {
          pressContaining(session.root, "12 Tahrir Street")
        })
        expect(onSelectAddress).toHaveBeenCalledTimes(2)
        expect(onSelectAddress).toHaveBeenLastCalledWith({
          address: "12 Tahrir Street",
          city: "Dokki",
          governorate: "Giza",
          coords: { lat: 30.0444, lon: 31.2357 },
        })
        expect(onSelectNewLocation).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("New Location asks for a new location", async () => {
      const onSelectAddress = jest.fn()
      const onSelectNewLocation = jest.fn()
      const session = await open(guestState("data"), {
        onSelectAddress,
        onSelectNewLocation,
      })
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "choose_another_address"))
        })
        expect(onSelectNewLocation).toHaveBeenCalledTimes(1)
        expect(onSelectAddress).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })
  }
)
