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
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { DATA, ERROR } from "testing/screenKit/fixtures/api"
import {
  HOURS_AGO,
  NOTIFICATION_READ,
  NOTIFICATION_UNREAD,
  PRESET,
  SERVICE,
  SERVICE_FOOD,
  some,
} from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { PresetSectionType, PresetType } from "types/cms"
import type { NotificationsItemType } from "types/notification"

/*
 * HomeScreen (HomeHeader, PresetSection, PresetCard, and HomeSkeletonScreen
 * while the preset loads), captured from the unconverted code: the skeleton,
 * the active preset for a signed-in customer (bell, unread badge) and for a
 * guest (no bell), every card shape (square, wide, two stacked, rectangle
 * with a text), a card named by its own name, its service or its category,
 * a card with no picture, a section with only a title or only a description,
 * the "99+" badge, an empty preset and a failed one. Then the presses: the
 * bell, the search bar, the categories button and a card (both ways a card
 * finds its service).
 */

const load = () => require("../HomeScreen")

const pic = (name: string) => ({
  id: name.length,
  url: `https://example.com/parity/${name}.jpg`,
  url720: `https://example.com/parity/${name}-720.jpg`,
  url150: `https://example.com/parity/${name}-150.jpg`,
})

const item = (id: number, groupId: number, extra: object = {}) =>
  ({
    id,
    groupId,
    pictureEn: pic(`item-${id}-en`),
    pictureAr: pic(`item-${id}-ar`),
    ...extra,
  }) as PresetSectionType["groups"][number]["items"][number]

const section = (
  id: number,
  order: number,
  shapeType: PresetSectionType["shapeType"],
  items: object[][],
  extra: Partial<PresetSectionType> = {}
): PresetSectionType => ({
  id,
  order,
  shapeType,
  titleEn: `Section ${id} title`,
  titleAr: `عنوان القسم ${id}`,
  descriptionEn: `Section ${id} description`,
  descriptionAr: `وصف القسم ${id}`,
  dataSource: "mainCategories",
  viewAll: false,
  groups: items.map((group, index) => ({
    id: id * 100 + index,
    order: index + 1,
    sectionId: id,
    items: group as PresetSectionType["groups"][number]["items"],
  })),
  ...extra,
})

const SUB = some<import("types/cms").ServiceCategoryType>({
  id: 8801,
  nameEn: "Leak repairs",
  nameAr: "إصلاح التسريب",
  serviceId: SERVICE.id,
})

/** Every shape, listed out of order (the screen sorts by `order`). */
const RICH: PresetType = {
  ...PRESET,
  sections: [
    // Sorted third: two stacked cards a column, two columns.
    section(
      23,
      3,
      "doubleRectangles",
      [
        [
          item(2301, 2300, { nameEn: "Cleaning", nameAr: "التنظيف", services: [SERVICE] }),
          item(2302, 2300, { nameEn: "Painting and decoration", nameAr: "الدهان والديكور", services: [SERVICE_FOOD] }),
        ],
        [
          item(2303, 2301, { nameEn: "Moving", nameAr: "النقل", services: [SERVICE] }),
          item(2304, 2301, { nameEn: "Gardening", nameAr: "البستنة", services: [SERVICE] }),
        ],
      ]
    ),
    // Sorted first: squares, one named by its service, one by its category,
    // one with no picture and no name at all.
    section(21, 1, "squareWithOverlay", [
      [
        item(2101, 2100, { nameEn: "Home repairs", nameAr: "إصلاحات المنزل", services: [SERVICE] }),
        item(2102, 2100, { services: [SERVICE_FOOD] }),
        item(2103, 2100, { serviceCategories: [SUB] }),
        item(2104, 2100, {
          nameEn: "No picture",
          nameAr: "بلا صورة",
          pictureEn: undefined,
          pictureAr: undefined,
          services: [SERVICE],
        }),
        item(2105, 2100, {}),
      ],
    ]),
    // Sorted second: wide cards, a long title.
    section(
      22,
      2,
      "rectangleWithOverlay",
      [
        [
          item(2201, 2200, {
            nameEn: "A very long category name that has to wrap onto a second line",
            nameAr: "اسم فئة طويل جدا يجب أن ينتقل إلى السطر الثاني في البطاقة",
            services: [SERVICE],
          }),
          item(2202, 2200, { nameEn: "Electrical", nameAr: "الكهرباء", services: [SERVICE] }),
        ],
      ],
      { titleEn: "", titleAr: "" }
    ),
    // Sorted fourth: rectangles with a text under them, no description.
    section(
      24,
      4,
      "rectangleWithText",
      [
        [
          item(2401, 2400, { nameEn: "Appliances", nameAr: "الأجهزة", services: [SERVICE] }),
          item(2402, 2400, { nameEn: "Carpentry", nameAr: "النجارة", services: [SERVICE] }),
        ],
      ],
      { descriptionEn: "", descriptionAr: "" }
    ),
    // Sorted fifth: nothing in it, so nothing drawn.
    section(25, 5, "squareWithOverlay", [[]]),
    // Sorted sixth: only a description.
    section(
      26,
      6,
      "rectangleWithText",
      [[item(2601, 2600, { nameEn: "Only a description", nameAr: "وصف فقط", services: [SERVICE] })]],
      { titleEn: "", titleAr: "" }
    ),
  ],
}

const preset = (value: PresetType) => ({ getActivePreset: { data: value } })

const unread = (count: number): NotificationsItemType[] =>
  Array.from({ length: count }, (_, index) => ({
    ...NOTIFICATION_UNREAD,
    id: 6000 + index,
    createdAt: HOURS_AGO(index + 1),
  }))

const notifications = (rows: NotificationsItemType[]) => ({
  getNotifications: {
    data: { data: rows, page: 1, perPage: 100, total: rows.length },
  },
})

type Case = {
  state: string
  options: Omit<RenderScreenOptions, "lang" | "platform">
  steps?: Step[]
}

const SIGNED = screenState("data")
const GUEST = guestState("data")

const CASES: Case[] = [
  { state: "loading, signed in", options: screenState("loading") },
  { state: "loading, guest", options: guestState("loading") },
  { state: "the active preset, signed in", options: SIGNED },
  { state: "the active preset, guest", options: GUEST },
  {
    state: "every card shape, signed in",
    options: { ...SIGNED, api: { ...DATA, ...preset(RICH) } },
  },
  {
    state: "every card shape, guest",
    options: { ...GUEST, api: { ...DATA, ...preset(RICH) } },
  },
  {
    state: "no unread notifications, no badge",
    options: {
      ...SIGNED,
      api: { ...DATA, ...notifications([NOTIFICATION_READ]) },
    },
  },
  {
    state: "120 unread, the 99+ badge",
    options: { ...SIGNED, api: { ...DATA, ...notifications(unread(120)) } },
  },
  {
    state: "9 unread",
    options: { ...SIGNED, api: { ...DATA, ...notifications(unread(9)) } },
  },
  { state: "no preset sections, signed in", options: screenState("empty") },
  { state: "no preset sections, guest", options: guestState("empty") },
  {
    state: "the preset failed, signed in",
    options: { ...SIGNED, api: { ...ERROR } },
  },
  { state: "the preset failed, guest", options: guestState("error") },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("HomeScreen, captured from the unconverted code", () => {
  it.each(rows)(
    "$state [$env.language $env.platform]",
    async ({ state, options, steps, env }) => {
      const tree = await treeAfter(
        load,
        {
          ...options,
          lang: env.language,
          platform: env.platform,
          route: { name: "home" },
        },
        env,
        steps
      )
      expectParity(parityName(state, env), tree)
    }
  )
})

describe.each(PARITY_MATRIX)("HomeScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (options: RenderScreenOptions = {}) =>
    openScreen(load, {
      ...SIGNED,
      ...options,
      lang: env.language,
      platform: env.platform,
      route: { name: "home" },
    })

  const session_ = (
    session: Awaited<ReturnType<typeof open>>,
    press: () => void
  ) =>
    session.act(() => {
      press()
    })

  const navigated = (session: Awaited<ReturnType<typeof open>>) =>
    session.navigation.actions.map((action) => ({
      type: action.type,
      ...(action.payload as object),
    }))

  it("the bell opens the notifications, with or without a badge on it", async () => {
    // One unread: the badge is inside the bell's touchable, so it has words.
    const badged = await open()
    try {
      await session_(badged, () =>
        pressText(badged.root, env.language === "ar" ? "١" : "1")
      )
      expect(navigated(badged)).toEqual([
        expect.objectContaining({ name: "NotificationsScreen" }),
      ])
    } finally {
      badged.unmount()
    }
    const plain = await open({
      api: { ...DATA, ...notifications([NOTIFICATION_READ]) },
    })
    try {
      await session_(plain, () => pressIcon(plain.root, { icon: "svg:bell" }))
      expect(navigated(plain)).toEqual([
        expect.objectContaining({ name: "NotificationsScreen" }),
      ])
    } finally {
      plain.unmount()
    }
  })

  it("the search bar opens Tapply AI and the filter button the categories", async () => {
    const session = await open()
    try {
      await session.act(() => {
        pressText(session.root, copy(env, "search_for_a_service"))
      })
      expect(navigated(session)).toEqual([
        expect.objectContaining({ name: "TapplyAIScreen" }),
      ])
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:categories" })
      })
      expect(navigated(session)[1]).toEqual(
        expect.objectContaining({ name: "CategoriesScreen" })
      )
    } finally {
      session.unmount()
    }
  })

  it("a card opens its service's categories, from /services or from its own category", async () => {
    const session = await open({
      api: { ...DATA, ...preset(RICH) },
    })
    try {
      await session.act(() => {
        pressContaining(session.root, env.language === "ar" ? "إصلاحات المنزل" : "Home repairs")
      })
      expect(navigated(session)).toEqual([
        expect.objectContaining({
          name: "SubCategoriesScreen",
          params: { service: expect.objectContaining({ id: SERVICE.id }) },
        }),
      ])
      await session.act(() => {
        pressContaining(session.root, env.language === "ar" ? "إصلاح التسريب" : "Leak repairs")
      })
      expect(navigated(session)[1]).toEqual(
        expect.objectContaining({
          name: "SubCategoriesScreen",
          params: {
            service: expect.objectContaining({
              nameEn: "Leak repairs",
              categories: [expect.objectContaining({ id: 8801 })],
            }),
          },
        })
      )
    } finally {
      session.unmount()
    }
  })
})

describe("what the rows drew", () => {
  it("the rich preset draws every shape's cards, in `order`, and skips an empty section", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const tree = JSON.stringify(
      await treeAfter(
        load,
        {
          ...SIGNED,
          api: { ...DATA, ...preset(RICH) },
          lang: env.language,
          platform: env.platform,
          route: { name: "home" },
        },
        env
      )
    )
    for (const words of [
      "Section 21 title",
      "Home repairs",
      "Food", // the card with no name of its own: its service's
      "Leak repairs", // ... or its category's
      "No picture",
      "A very long category name that has to wrap onto a second line",
      "Painting and decoration",
      "Gardening",
      "Appliances",
      "Only a description",
    ]) {
      expect(tree).toContain(words)
    }
    expect(tree).not.toContain("Section 25 title")
    const order = [
      "Section 21 title",
      "Electrical",
      "Section 23 title",
      "Section 24 title",
    ].map((s) => tree.indexOf(s))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})
