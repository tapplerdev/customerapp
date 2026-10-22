/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressText,
  renderScreen,
  rowsByPlatform,
} from "testing/screenKit"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * TabBar as HomeTabs hands it its props (`tabBar={(props) => <TabBar {...props}
 * t={t} />}`: the navigator's state, descriptors and insets): each of the four
 * tabs focused, the bottom gap its inset formula gives (the formula reads
 * `insets.bottom`: 0, 20 and 34 draw 31, 11 and 31), the unread badge on the
 * messages tab (a count and the capped one), and the two phone widths its
 * StyleSheet reads as it loads (a tab's width follows the window). The kit,
 * for the icons, i18next and the shadow's host.
 *
 * Its props are a React Navigation tab bar's, so the harness builds them as
 * the navigator does: routes named as HomeTabs names them, each descriptor's
 * `tabBarIcon` a RenderTabBarIcon (HomeTabs:48-75). It is drawn with the
 * kit's real RenderTabBarIcon and i18next, nothing stood in.
 *
 *   yarn ds:parity:capture <this file> --force   recapture, on the old code only
 */

const ROUTES = ["home", "talabati", "messages", "account"] as const

type Row = {
  name: string
  index: number
  bottom: number
  window: number
  badge?: number
}

const loadWith = () => {
  const React = require("react") as typeof import("react")
  const { useTranslation } = require("react-i18next")
  const TabBar = require("../TabBar").default
  const Icon = require("components/RenderTabBarIcon/RenderTabBarIcon").default
  const Harness = (props: {
    index: number
    bottom: number
    badge?: number
    emit?: () => { defaultPrevented: boolean }
    navigate?: (name: string) => void
  }) => {
    const { t } = useTranslation()
    const state = {
      index: props.index,
      routes: ROUTES.map((name) => ({ key: `${name}-key`, name })),
    }
    const descriptors = Object.fromEntries(
      ROUTES.map((name) => [
        `${name}-key`,
        {
          options: {
            tabBarIcon: ({ focused }: { focused: boolean }) =>
              React.createElement(Icon, {
                focused,
                type: name,
                badge: name === "messages" ? props.badge : undefined,
              }),
          },
        },
      ])
    )
    const navigation = {
      emit: props.emit ?? (() => ({ defaultPrevented: false })),
      navigate: props.navigate ?? (() => {}),
    }
    return React.createElement(TabBar, {
      state,
      descriptors,
      navigation,
      insets: { top: 0, left: 0, right: 0, bottom: props.bottom },
      t,
    })
  }
  return { default: Harness }
}

// Windows are separate registries: keep a window's rows together.
const ROWS: Row[] = [
  ...[0, 1, 2, 3].map((index) => ({
    name: `${ROUTES[index]} focused`,
    index,
    bottom: 34,
    window: 402,
  })),
  { name: "home focused, no inset", index: 0, bottom: 0, window: 402 },
  { name: "home focused, inset 20", index: 0, bottom: 20, window: 402 },
  {
    name: "messages focused, badge 7",
    index: 2,
    bottom: 34,
    window: 402,
    badge: 7,
  },
  {
    name: "account focused, badge 120",
    index: 3,
    bottom: 34,
    window: 402,
    badge: 120,
  },
  {
    name: "talabati focused, badge 7 (not on messages)",
    index: 1,
    bottom: 34,
    window: 402,
    badge: 7,
  },
  { name: "home focused", index: 0, bottom: 34, window: 390 },
  {
    name: "messages focused, badge 7",
    index: 2,
    bottom: 34,
    window: 390,
    badge: 7,
  },
]

const windows = [402, 390]
const ordered = windows.flatMap((window) =>
  rowsByPlatform(
    ROWS.filter((row) => row.window === window),
    PARITY_MATRIX
  )
)

describe("TabBar draws as before", () => {
  it.each(ordered)(
    "$name (window $window) [$env.language $env.platform]",
    async (row) => {
      const tree = await renderScreen(loadWith, {
        lang: row.env.language,
        platform: row.env.platform,
        window: { width: row.window },
        navigation: "none",
        props: { index: row.index, bottom: row.bottom, badge: row.badge },
      })
      expectParity(parityName(`${row.name} @${row.window}`, row.env), tree)
    }
  )
})

// The converted tabs' handlers run (functions don't show in a tree): a tab
// press tells the navigator (tabPress), and goes there unless it is the
// focused tab or something prevented it.
describe("a tab takes a press", () => {
  it.each(PARITY_MATRIX)("[$language $platform]", async (env) => {
    const emit = jest.fn(() => ({ defaultPrevented: false }))
    const navigate = jest.fn()
    const session = await openScreen(loadWith, {
      lang: env.language,
      platform: env.platform,
      window: { width: 402 },
      navigation: "none",
      props: { index: 0, bottom: 34, emit, navigate },
    })
    try {
      await session.act(() => {
        pressText(session.root, copy(env, "messages"))
      })
      expect(emit).toHaveBeenCalledWith({
        type: "tabPress",
        target: "messages-key",
        canPreventDefault: true,
      })
      expect(navigate).toHaveBeenCalledWith("messages")
      await session.act(() => {
        pressText(session.root, copy(env, "home"))
      })
      expect(emit).toHaveBeenCalledTimes(2)
      expect(navigate).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })
})
