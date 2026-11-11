/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  typeInto,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { CUSTOMER, signedIn } from "testing/screenKit/fixtures/users"
import type { CustomerMeResponse } from "types/auth"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * My information: the two name fields, the email and its Change link, the
 * gender checkboxes and Save, whose look follows `hasChanges` and `isLoading`
 * (the disabled grey, the red, the spinner). Edited states are reached by
 * typing and pressing, never by setting state. The save is answered three
 * ways in the tree rows: pending (the spinner), a server message, no message.
 * An accepted save draws what "first name edited" draws (the screen goes
 * back, which only the navigation record shows): the press block asserts it.
 */

const load = () => require("../MyInformationScreen")

// The backend says whether photos can be stored private (file privacy on). The
// picker is drawn only then; every state below is "on" unless it says so.
const ME_ON = { data: { ...CUSTOMER, profilePhotoEnabled: true } }
const withMe = (me: { data: CustomerMeResponse }) => ({
  ...screenState("data"),
  api: { ...screenState("data").api, getCustomerMe: me },
})

const BLANK = {
  state: {
    auth: signedIn({
      ...CUSTOMER,
      firstName: "",
      lastName: "",
      gender: undefined as never,
      email: "",
    }),
  },
  api: withMe(ME_ON).api,
}

// The account answers with a private link to the photo (it expires, so the
// screen reads it fresh and never stores it).
const WITH_PHOTO = withMe({
  data: {
    ...CUSTOMER,
    profilePhotoEnabled: true,
    profilePhotoUrl: "https://api.example.com/api/files/private/1/me.jpg",
  },
})
// File privacy is off: the server says no (or, an older backend, says nothing).
const PICKER_OFF = withMe({
  data: { ...CUSTOMER, profilePhotoEnabled: false },
})
const PICKER_UNSAID = withMe({ data: CUSTOMER })

const SAVE = {
  pending: "loading" as const,
  rejected: {
    error: { status: 400, data: { message: "Name is not allowed" } },
  },
  "rejected, no message": { error: { status: 500, data: {} } },
  accepted: { data: CUSTOMER },
}

const base = withMe(ME_ON)
const optionsFor = (
  env: ParityEnv,
  who: typeof base = base,
  save: keyof typeof SAVE = "pending"
) => ({
  ...who,
  api: { ...who.api, updateCustomer: SAVE[save] },
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "MyInformationScreen" },
})

const openPhotoSheet: Step = (root, env) =>
  pressText(root, copy(env, "profile_photo"))

const typeFirst: Step = (root) => typeInto(root, 0, "Monica")
const typeLast: Step = (root) => typeInto(root, 1, "Adel-Hassan")
const pickMale: Step = (root, env) => pressTitled(root, copy(env, "male"))
const pickFemale: Step = (root, env) => pressTitled(root, copy(env, "female"))
const save: Step = (root, env) => pressTitled(root, copy(env, "save"))

// Save is an ActionBtn turned into a ds Button by the conversion: Button's own
// height and accessibility props, on every row (the button is always drawn).
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = {
  label: string
  who?: typeof base
  save?: keyof typeof SAVE
  steps?: Step[]
}
const CASES: Case[] = [
  { label: "as opened, nothing changed" },
  { label: "blank names, no gender, no email", who: BLANK },
  { label: "the picker off: photos not available yet", who: PICKER_OFF },
  { label: "the picker off: the server says nothing", who: PICKER_UNSAID },
  { label: "a photo on the account", who: WITH_PHOTO },
  { label: "the photo sheet opened, no photo", steps: [openPhotoSheet] },
  {
    label: "the photo sheet opened, with a photo",
    who: WITH_PHOTO,
    steps: [openPhotoSheet],
  },
  { label: "first name edited", steps: [typeFirst] },
  { label: "both names edited", steps: [typeFirst, typeLast] },
  { label: "male picked", steps: [pickMale] },
  {
    label: "blank names, male then female picked",
    who: BLANK,
    steps: [pickMale, pickFemale],
  },
  { label: "edited, save pending", steps: [typeFirst, save] },
  {
    label: "edited, save refused with a message",
    save: "rejected",
    steps: [typeFirst, save],
  },
  {
    label: "edited, save refused without one",
    save: "rejected, no message",
    steps: [typeFirst, save],
  },
]

describe("MyInformationScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, who, save: answer, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, who, answer), env, steps),
        { allow: BUTTON }
      )
    }
  )
})

describe("MyInformationScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)

  it.each(envs)(
    "Save is refused until something changes [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, optionsFor(env))
      try {
        expect(() => pressTitled(session.root, copy(env, "save"))).toThrow()
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Save sends the edited name and gender [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, optionsFor(env, base, "accepted"))
      try {
        await session.act(() => {
          typeFirst(session.root, env)
        })
        await session.act(() => {
          pickMale(session.root, env)
        })
        await session.act(() => {
          save(session.root, env)
        })
        const sent = session
          .requests()
          .filter((r) => r.endpoint === "updateCustomer")
        expect(sent).toHaveLength(1)
        expect(JSON.stringify(sent[0].args)).toContain('"firstName":"Monica"')
        expect(JSON.stringify(sent[0].args)).toContain('"gender":"male"')
        expect(session.navigation.actions).toEqual([
          expect.objectContaining({ type: "GO_BACK" }),
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Change opens the email screen; the chevron goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, optionsFor(env))
      try {
        await session.act(() => {
          pressText(session.root, copy(env, "change"))
        })
        expect(session.navigation.actions).toEqual([
          expect.objectContaining({
            type: "NAVIGATE",
            payload: expect.objectContaining({ name: "UpdateEmailScreen" }),
          }),
        ])
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:chevron-left" })
        })
        expect(session.navigation.actions).toHaveLength(2)
        expect(session.navigation.actions[1]).toEqual(
          expect.objectContaining({ type: "GO_BACK" })
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Remove photo is only offered with a photo, and sends profilePhoto null [$env.language $env.platform]",
    async ({ env }) => {
      const without = await openScreen(load, optionsFor(env))
      try {
        await without.act(() => {
          openPhotoSheet(without.root, env)
        })
        expect(() =>
          pressText(without.root, copy(env, "gallery"))
        ).not.toThrow()
        expect(() =>
          pressText(without.root, copy(env, "remove_photo"))
        ).toThrow()
      } finally {
        without.unmount()
      }

      const session = await openScreen(
        load,
        optionsFor(env, WITH_PHOTO, "accepted")
      )
      try {
        await session.act(() => {
          openPhotoSheet(session.root, env)
        })
        await session.act(() => {
          pressText(session.root, copy(env, "remove_photo"))
        })
        const sent = session
          .requests()
          .filter((r) => r.endpoint === "updateCustomer")
        expect(sent).toHaveLength(1)
        expect(JSON.stringify(sent[0].args)).toContain(
          '"body":{"profilePhoto":null}'
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Save does not touch the photo [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        optionsFor(env, WITH_PHOTO, "accepted")
      )
      try {
        await session.act(() => {
          typeFirst(session.root, env)
        })
        await session.act(() => {
          save(session.root, env)
        })
        const sent = session
          .requests()
          .filter((r) => r.endpoint === "updateCustomer")
        expect(sent).toHaveLength(1)
        expect(JSON.stringify(sent[0].args)).not.toContain("profilePhoto")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the picker is not offered while photos are off [$env.language $env.platform]",
    async ({ env }) => {
      for (const who of [PICKER_OFF, PICKER_UNSAID]) {
        // eslint-disable-next-line no-await-in-loop
        const session = await openScreen(load, optionsFor(env, who))
        try {
          expect(() =>
            pressText(session.root, copy(env, "profile_photo"))
          ).toThrow()
        } finally {
          session.unmount()
        }
      }
      const on = await openScreen(load, optionsFor(env))
      try {
        expect(() =>
          pressText(on.root, copy(env, "profile_photo"))
        ).not.toThrow()
      } finally {
        on.unmount()
      }
    }
  )
})
