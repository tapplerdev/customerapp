# src/testing: parity tooling for the design-system migration

Everything in this directory is jest-only. Nothing here may be imported from app code.

Pass 1 of the migration (NativeWind to StyleSheet and the ds tokens) has to be pixel-identical, and
the proof is host-tree parity: what a component or a screen hands React Native's native views,
compared against a fixture captured from the code before the change. This file is the workflow a
wave 2 agent follows, and a reference for the tools behind it.

| Piece | What it is |
|---|---|
| `hostTreeParity.ts` | Renders in an environment (language, RTL, platform, fonts, insets), normalizes the host tree, captures and compares fixtures. The gate. |
| `screenKit/` | Renders a whole screen the way the app does, with mocked data and native modules, under `jest.parity.config.js`. |
| `harvest/` | Reads a component's real call sites into prop sets, freezes them with their class strings compiled, and checks those classes compiled. `twinCases` hands each set to the codemod as a call site of its own, for a component's twin test. |
| `buttonLooks/` | ActionBtn's own harvest and translator (the codemod loads `translate.ts`). The generic harvest grew out of it. |
| `sharedComponents/` | tappler-shared's components' parity harness (`yarn ds:parity:shared` on the API branch). |
| `nativewind.ts`, `svgStub.ts` | NativeWind's output for a class string; an SVG icon as a host element named after it. |

## The two jest configs

`yarn test` is the default config. Component parity tests live there (`*.test.tsx`).

`yarn test:parity` is `jest.parity.config.js`, which runs every `*.parity.tsx` under `src` and
nothing else. The default config ignores `*.parity.tsx`. Screen parity tests live here, because a
screen needs the kit's setup: every native module mocked, the network shut, a real store, a real
navigator, Egypt's time zone, and a module registry per platform.

A parity row gets 120 s (`testTimeout` in `jest.parity.config.js`), not jest's 5 s: a file's first
render in each platform's registry loads the app, and on a cold transform cache that took 39 s for
HomeScreen (most screens 5 to 9 s). A row needs no timeout of its own.

Both are gates. Run jest with your own cache and two workers:

```
node_modules/.bin/jest --cacheDirectory ~/develop/ds-migration/jest-cache-<you> --maxWorkers=2
node_modules/.bin/jest -c jest.parity.config.js --cacheDirectory ~/develop/ds-migration/jest-cache-<you> --maxWorkers=2
```

## The workflow, for every file you convert

The order matters. The fixture has to come from the code before your change, or it proves nothing.

1. **Capture before you edit.** Write the parity test for what you're about to convert (a
   component: "A component" below; a screen: "A screen"). Capture it on the unconverted code with
   `yarn ds:parity:capture <test file>`. Commit the test and its fixtures on their own, before the
   conversion commit. Capture refuses to overwrite a case; `--force` is only for recapturing from
   old code.
2. **Convert.** The codemod (`yarn ds:codemod`, with your own `--latent latent-bugs/<area>.md`),
   then whatever it left, by hand.
3. **Assert.** Run the test normally. Every case must be equal. A missing case fails instead of
   capturing itself.
4. **The allowance opt-in, for ActionBtn to Button only.** Button differs from ActionBtn in three
   listed ways that draw nothing different. A case opts into exactly the ones its conversion makes:

   ```ts
   expectParity(name, tree, { allow: ["buttonHeight", "buttonAccessibility"] })
   ```

   - `buttonHeight`: Button's `minHeight` where ActionBtn had the same `height`.
   - `buttonAccessibility`: Button's `accessibilityLabel`, `accessibilityRole` and
     `accessibilityState`, which ActionBtn never set.
   - `buttonDisabledView`: the `disabled` flag ActionBtn hands its View when there is no onPress.

   Each one applies only on a button's root (a node holding Button's label box or its spinner),
   with every other style key equal. Anywhere else, the same difference still fails, and so does a
   lost accessibility prop. `expectParity` returns what it accepted, if you want to pin it. No
   other difference is allowed in pass 1. If a tree differs, the conversion is wrong.
5. **The compiled-class control.** NativeWind compiles a class only where it finds it in a `.tsx`
   file's text, and draws an uncompiled class as nothing, without a word. A fixture whose classes
   never compiled matches a conversion that drops them too. So every fixture with class strings
   outside the component's own `.tsx` (harvested cases, JSON) does three checks first, in capture
   and in compare runs: a control class draws, the classes file lists every string, and every
   token draws exactly what `scripts/nw-resolve` says. `describeCompiledClasses` declares all
   three. If one fails, fix the classes file (re-harvest) and recapture from the old code. Never
   recapture from converted code.
6. **The other gates.** tsc has no new errors against the baseline (compare the error set for your
   files, not the total). Full `yarn test` and `yarn test:parity` are green except the pre-existing
   `OfferFlowContext`. `yarn ds:ratchet` is OK (never `--update`), and so is
   `yarn ds:ratchet --strict '<area>/**' --strict-metrics className` (`className,primitives` also
   wants no `<DmText>` or `<ActionBtn>` left, the gate before W3). The ratchet counts
   `<LegacyText>` (shared's pass-1 stand-in for a DmText that ds Text can't express, imported
   from `@tappler/shared/src/components/LegacyText`, under any name) as `bridge`: it may rise
   only in a file whose DmText/ActionBtn count falls by at least as much. `yarn
   ds:probe` shows 0 BUG.
   `yarn ds:compiler-coverage --ref <integration branch>` shows OK.

## A component (W2a)

The templates are `components/VerifyScreenComponent/__tests__/VerifyScreenComponent.parity.test.tsx`
(3 sites, typed states) and `components/HeaderOnboarding/__tests__/HeaderOnboarding.defaults.test.tsx`
(98 sites).

1. Tell the harvest what each prop is:

   ```ts
   const FILES = harvestFilesFor(__dirname, "MyComponent")
   const OPTIONS: HarvestOptions = {
     srcRoot: path.resolve(__dirname, "../../.."),
     importFrom: /(^|\/)components\/MyComponent$/,
     props: { title: "text", className: "class", disabled: "bool", Icon: "node", onPress: "fn", item: "any" },
     rewrites: { "screens/X/X.tsx:120": { reason: "forwards its caller's class", values: { className: 'oneOf("mt-[4]", "mt-[8]")' } } },
     skip: { "components/Wrapper/Wrapper.tsx:40": "spreads its callers' props" },
   }
   ```

   `text` becomes a placeholder (a literal stays as written, `t("key")` becomes `t:key`), `fn` a
   marker, `bool` a condition (both values), `any` a marker you give a value for, and `class`,
   `node` and `value` must settle or come from a rewrite. A site's conditions are shared across its
   props, so no impossible set is made. An unknown prop, a stale rewrite or a stale skip stops the
   harvest. A file that imports the component under more than one name (FilterScreen draws
   FilterItem as `FilterItem` and `FilterModalItem`) is harvested under every one.
2. Harvest: `DS_HARVEST=1 node_modules/.bin/jest <test file>`. It writes
   `__fixtures__/MyComponent.cases.json` (the sets and the sites behind each one) and
   `__fixtures__/MyComponent.classes.tsx` (every class string, so NativeWind compiles them). Import
   the classes file at the top of the test. It lives in `__fixtures__`, not `__tests__`, because
   jest would take a `.tsx` under `__tests__` for a test, and the style ratchet and the codemod
   skip `__fixtures__`.
3. In the test: `describeCompiledClasses(cases, FILES, classStringsOf(cases.cases))` (cases that
   pass no class string get the control and the list only, so call it either way), then one row
   per case and environment:

   ```ts
   expectParity(parityName(id, env), hostTree(<MyComponent {...buildProps(entry.props, { elements, opaque })} />, env))
   ```

   `elements` maps the tags an element prop names (DmText, DmView...; anything else becomes an
   SVG stand-in), and `opaque` gives values for the `any` markers (or a function for all of them).
4. Capture, convert, assert, as above. The cases stay frozen while you convert the call sites, so
   the fixture keeps describing the class-name path.

## A screen (W2b)

The template is `testing/screenKit/__tests__/workflow.parity.tsx`.

```tsx
import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { screenState, type ScreenStateName } from "testing/screenKit/states"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

const load = () => require("../MyScreen")
const STATES: ScreenStateName[] = ["data", "empty", "loading", "error"]
const rows = rowsByPlatform(STATES.map((state) => ({ state })), PARITY_MATRIX)

it.each(rows)("$state [$env.language $env.platform]", async ({ state, env }) => {
  const tree = await renderScreen(load, {
    ...screenState(state),
    lang: env.language,
    platform: env.platform,
    route: { name: "my-screen", params: ROUTE_PARAMS["my-screen"] },
  })
  expectParity(parityName(state, env), tree)
})
```

- **Name it `*.parity.tsx`.** Put it in the screen's `__tests__`; its fixture lands in
  `__tests__/__parity__/MyScreen.parity.json`. `yarn ds:parity:capture <file>` picks the kit's
  config for a `*.parity.tsx`.
- **Pass the screen as a loader**, `() => require("../MyScreen")` (or a path under `src`). Each
  platform's renders load in a module registry of their own, decided before anything loads, so the
  files that read `Platform.OS` at import really draw Android. A component imported at the top of
  the test belongs to the wrong registry. For the same reason, a harness component that calls
  hooks has to be defined inside the loader. Order the table with `rowsByPlatform`, so the file
  switches registries once.
- **Cover the states a user sees**: data, empty, loading and error, a modal open, long Arabic
  copy. When the pro has to press or type first, give `treeAfter` the steps (the helpers below):

  ```ts
  const tree = await treeAfter(load, options, env, [
    (root) => typeInto(root, 0, "new-secret"),
    (root, env) => pressTitled(root, copy(env, "save")),
    wait(1000),
  ])
  expectParity(parityName("after save", env), tree)
  ```

  `treeAfter` opens the screen, runs each step inside `act` with a settle after it (500 ms, or
  the step's `settleMs`), reads the tree and unmounts. For more than that, `openScreen` gives the
  session itself:

  ```ts
  const session = await openScreen(load, options)
  try {
    // Braces: the press returns nothing (see below).
    await session.act(() => {
      pressTitled(session.root, copy(env, "save"))
    })
    expectParity(parityName("after save", env), session.tree())
  } finally {
    session.unmount()
  }
  ```

  **A press must not hand the handler's promise to `act`.** `act` waits for what its function
  returns, and a save whose request the backend leaves loading (no fixture, or a mutation, which
  defaults to "loading") never settles. Write `() => { onPress() }`, not `() => onPress()`: a
  tap doesn't wait for its handler either, and the settle after `act` runs what the press
  started. (The helpers below return nothing already.) A returned promise still pending after
  1,000 turns of the event loop fails the row at once, naming the press (`act(fn, settleMs,
  what)` names it `what`, else by fn's source; `treeAfter` names the step), instead of hanging it
  until jest's timeout.

- **Press and type by what the pro sees.** A screen has no testIDs (and can't get them in pass 1:
  a testID is a host prop, so the tree would change). From `testing/screenKit` (`interact.ts`):

  | Helper | What it does |
  |---|---|
  | `copy(env, key)` | The string for `key` in the row's language, falling back to English as the app's i18next does; throws on a key neither file has. |
  | `pressTitled(root, title, { allowDisabled }?)` | Calls the onPress of the one outermost element with that `title` (ActionBtn, Button, a My Account row). A disabled control throws: anything a tap on it goes through, down to the touchable's native view, says `disabled`/`disable`, or that view's `accessibilityState` does (loading sets it too, and so does a row's own lock on the touchable it draws): a tap does nothing there. `allowDisabled` presses it anyway, for a test of the handler, never a pro's step. |
  | `pressText(root, text, { nth, allowDisabled }?)` | Calls the onPress of the innermost element whose text is `text` (a link: a pressable view around a text). Two separate controls showing those words throw unless `nth` (0-based, in screen order) picks one; a disabled one throws, as `pressTitled`'s does. |
  | `typeInto(root, index, text)` | Types into the `index`th field (DmInput, PhoneInput: composite elements taking onChangeText, outermost first) through the TextInput it draws, as `fireEvent.changeText` does, so the field's own handler runs (`fromArabic` for digits). A field with no TextInput (a DmInput with onPress) or one that isn't editable throws. |
  | `enterCode(root, code)` | Types into VerifyCodeInput's hidden one-time-code field. |
  | `fields(root)`, `only(root, predicate, what)` | The fields `typeInto` counts; the one outermost match, or a throw saying how many. |
  | `treeAfter(load, options, env, steps)` | The tree after `steps` (each a `Step`: `(root, env) => void`, with an optional `settleMs`). |
  | `wait(ms)` | A step that only lets `ms` pass (a card's close; see the Modal in "What the kit mocks"). |
  | `BOTTOM_GAP_INSETS` | `[0, 48]`: the bottom insets to add for a screen with today's `insets.bottom > 45 ? 0 : 45 - insets.bottom` gap (rows with `insets: { bottom }`). |

  **Bottom-gap rows: 0 and 48, beside the default.** The kit's default bottom inset is 34 on iOS
  (24 on Android), so an "inset 34" row on iOS repeats the screen's default state, and 34 is where
  an "11 + inset" mistake still draws 45. A screen with the gap formula needs rows at 0 and 48
  beyond its default rows.

- **Small phones: give the row a `window`.** tappler-shared's helpers work out `isSmallPhone`
  (width under 393), `isLittlePhone` (under 375), `isBigPhone`, `isSmallPhoneHeight` (height 864
  or less), `SCREEN_WIDTH` and `SCREEN_HEIGHT` once, when they load, and so do a few modules of
  ours (MessagesComponent, InAppNotification, BottomPopup, MediaViewer's styles). A row's
  `window` is part of its registry, like its platform, and is applied before anything loads:
  `window: { width: 390 }` draws the small-phone branch, `{ width: 402 }` the large one. Screens
  that branch on it: RegistrationFlowScreen, SocialMediaItem and FilterScreen (`isSmallPhone`),
  HomeScreen (`isSmallPhoneHeight`). Each window is its own registry, so keep a window's rows
  together. A row without `window` loads the app as every fixture so far was captured, with
  jest's 750 x 1334 (`LOADED_AS_BEFORE`), and renders at 402 x 874; VerifyCodeInput's boxes,
  sized from `SCREEN_WIDTH` at load, come out 143.75 wide there, not 56.75. Give `window` (even
  `{ width: 402 }`) where a load-time value should be the device's.

  A component test doesn't use the kit (DashboardCategoryItem, BusinessHoursItem,
  RegisterFlowProgressBar, WaitAMomentModal, FoodMenuSectionMenuItem branch on `isSmallPhone`
  too). It can do the same in a registry of its own, set up before the component loads:

  ```ts
  const treeAt = (width: number, props: Props, env: ParityEnv) => {
    let tree: HostNode | null = null
    jest.isolateModules(() => {
      const { Dimensions } = require("react-native")
      const size = { width, height: 874, scale: 3, fontScale: 1 }
      Dimensions.set({ window: size, screen: size })
      // Everything the render uses, from this registry (not the file's imports).
      const React = require("react")
      const { hostTree } = require("testing/hostTreeParity")
      const Item = require("../BusinessHoursItem").default
      tree = hostTree(React.createElement(Item, props), env)
    })
    return tree
  }
  ```

  The file's own `jest.mock()`s (its SVG icons...) apply inside it too.

- **Mock data and native modules only.** Never mock your own child components. A parity test
  built on stand-ins compares stand-ins.

### renderScreen's options

| Option | Default | What it does |
|---|---|---|
| `lang` | `en` | i18next, RTL, the ds language provider, moment's locale and `auth.language`. |
| `platform` | `ios` | The registry the render loads in. |
| `route` | `{ name: "parity-screen" }` | Name and params of the screen's route. |
| `state` | initial state | The store's slices, over each slice's initial state (`auth`, `service`, `setting`, `serviceMutations`). |
| `api` | `{}` | The backend's answers by endpoint name: `{ data }`, `{ error: { status, data } }`, `"loading"`, or a function of the request. An unlisted endpoint stays loading. |
| `cache` | none | RTK Query entries present before the screen opens. |
| `storage` | none | MMKV keys present before the render (the app's memos and flags). |
| `insets` | iPhone 16 Pro on iOS (62/34), 24/24 on Android | Safe-area insets. |
| `window` | 402 x 874 @3x | The window `Dimensions` reports. A row that gives one gets it applied before the app loads (see "Small phones" above); a row without one loads as the fixtures so far were captured. |
| `now` | 2026-10-20T08:00:00Z | The frozen clock. The settle loop moves it. |
| `settleMs` | 1000 | How long the settle loop runs the clock after mounting. |
| `navigation` | `container` | A real NavigationContainer and stack. `none` renders the bare component. |
| `props` | none | Props for the component, beside `navigation` and `route`. |

`renderScreen` returns the normalized host tree. `openScreen` returns a session: `tree()`,
`settle(ms)`, `act(fn, settleMs?, what?)`, `root` (the test renderer), `store`, `requests()` (every request the screen
sent, with whether a fixture answered it), `navigation.actions` (navigations the one-route stack
couldn't handle, like a navigate elsewhere) and `unmount()`.

### Fixtures

- `states.ts`: `screenState("data" | "empty" | "loading" | "error")` gives a signed-in individual
  pro and the backend answering that way. Spread it and add your own.
- `fixtures/users.ts`: `PRO_INDIVIDUAL`, `PRO_COMPANY`, `signedIn(user)`, `signedOut`.
- `fixtures/entities.ts`: services (plain, food with a menu, pending interview), jobs (opportunity,
  lead, offered lead, food order), chats, notifications, points, settings, profile params.
- `fixtures/api.ts`: `DATA`, `EMPTY` and `ERROR` for the 49 endpoints the screens open with.
- `fixtures/routes.ts`: `ROUTE_PARAMS` for every registered screen that reads params, typed by the
  navigator's param list, and `ROUTE_VARIANTS` (the registration flow at each step).
- `fixtures/components.ts`: props for the screen-local components only a tap reaches.

Everything is typed by the app's own types, so a field a screen reads can't drift. A big record is
`some<T>()`: only the fields the screens read, each one typed. Add what your screen needs. These
files belong to the main session, so ask for additions rather than editing them in an area branch.

### What the kit mocks, and what it doesn't

- **Native modules and views** (`screenKit/nativeMocks.ts`). A view becomes a host named after it,
  carrying every prop it was given, with its children (MapView, LinearGradient, LottieView, Video,
  WebView, FastImage, DropShadow...). A module answers like a device that has said nothing yet:
  permissions granted, a picker that never returns, a thumbnail that never arrives. Reanimated has
  `Animated.View`, `Text`, `ScrollView`, `FlatList`, `Image` and `createAnimatedComponent`, with
  `entering`, `exiting` and `layout` dropped the way the library drops them. FlashList, the
  sortable grid and the carousel draw every row. Paymob has the SDK's own exports (pinned against
  its `src/index.js`): the module's setters and `presentPayVC` do nothing, `PaymobCheckoutView`
  is a host, `PaymobCheckout`'s commands (configure, setPaymentKeys, payFromOutside,
  revealValidationErrors) do nothing, and no outcome ever arrives, so a payment sheet opens with
  no override in the test. React Native's Modal is its own jest mock (a `Modal` host while
  visible, nothing after), and on iOS rows a shown modal told to hide calls `onDismiss` right
  after the closing commit, as UIKit's dismissal does (Android's Modal has none). So MainModal's
  `onModalHide` handoff ("close this, then open that") needs no wait for its 2 s backstop. Its
  `onShow` isn't reported: a close within 2 s of the open still waits for the rest of the open's
  backstop.
- **The network is shut.** RTK Query's `fetchBaseQuery` is answered by the kit's backend. Any other
  `fetch`, XMLHttpRequest or WebSocket goes nowhere and is listed (`networkAttempts()` from
  `testing/screenKit`). The app's backend is production.
- **Real**: the store (the app's reducers and middleware, fresh per render; a test pins the reducer
  list against `src/store/index.ts`), React Navigation, i18next, NativeWind, tappler-shared,
  react-native-safe-area-context, gesture-handler (its own jest setup), rn-tourguide, every one of
  our components.

### Traps

- An env switch must be read through a variable key (`globalThis.process.env[key]`).
  react-native-dotenv inlines a literal `process.env.NAME` at transform time, and jest caches it.
- A `t("key")` prop is drawn as `t:key`. Translate it in the test if the component reads the text.
- `Image.prefetch` resolves and `Image.getSize` gives 1440 x 1080. React Native's preset leaves
  them without an answer.
- A new native library a screen imports needs a stand-in in `nativeMocks.ts` and a line in
  `setup.ts`. A new ESM package needs a line in `jest.parity.config.js`'s allowlist.
- react-native-shadow-2 names each Shadow's gradients from a counter that runs on across a
  registry's renders (`start.24`, `url(#start.24)`), so a row's raw ids depend on the rows before
  it. `expectParity` numbers them by appearance on both sides (`withStableShadowIds`), so a row
  run alone (`-t`) or moved compares like the full run, and a fixture captured with raw ids needs
  no recapture. A reference that points at another Shadow's gradient still fails.

## Coverage: `yarn ds:parity:screens`

Every file under `src/screens` loads in each platform's registry. Each registered screen renders in
the data and loading states, plus its route variants. Every other file's component renders on its
own (with props where only a tap reaches it). The components a render drew are traced back to their
files. The gate is nine in ten of the screen files with class names, per platform.
`DS_SCREENKIT_REPORT=<file>` writes every file's outcome, its error, and the requests nothing
answered.

At the time of writing (proapp `ds/w15-parity`, shared e817689), on iOS and on Android alike:

- 350 of 350 screen files load, and 346 render.
- All 152 registered screens render.
- All 223 files with class names render: 151 as screens, 58 inside one, and 14 only on their own.

## React Compiler coverage: `yarn ds:compiler-coverage`

A converted file must not drop out of the React Compiler, since a refusal silently brings back the
re-renders it removed. The script compiles every src file through `babel.config.js`, with a logger on
the compiler and nothing else changed, and names each compiled function.

- `yarn ds:compiler-coverage --ref <branch>` compiles each file that differs from `<branch>` as it
  is there and as it is now. It fails if a function that compiled stops compiling, and gives the
  compiler's reason. This is the W2 gate.
- `yarn ds:compiler-coverage` checks the tree against `scripts/compiler-coverage-baseline.json`.
- `--update` rewrites the baseline, and only the main session runs it, after a merge.

## Without NativeWind's types: `yarn ds:tsc:nonw`

tsc as if `src/types/declarations.d.ts` didn't have its `/// <reference types="nativewind/types" />`
line, the one that gives every React Native view, text, image and list a `className` prop. No
file is written or edited: it is tsc's own program (the TypeScript API over `tsconfig.json`; with
the line kept, the same run prints exactly what `tsc --noEmit -p tsconfig.json` prints), with
that file handed to the compiler minus the line.

- `scripts/tsc-nonw-baseline.json` is tsc's own error set (NativeWind's types in), the 114. What
  the run adds to it is what NativeWind's types were hiding: each `className` still handed to
  something whose own types don't take it, or an ordinary error that is new. Errors compare by
  file, code and message, counted, so a moved line isn't new.
- `yarn ds:tsc:nonw <your area>` (a directory, file or glob) lists the area's new errors in full
  and fails on them. After a conversion, every one is a class name left in app code (or a twin
  call site that still passes a class to a component without the prop): fix it or say why. A
  className on one of our own components that still declares the prop isn't an error until W3
  removes it.
- With no path it prints the whole app's new errors by directory (1,296 in 325 files at the
  capture), and `--list` every error in scope, `--json` all of it.
- `--update` rewrites the baseline from tsc's own run, and only the main session runs it.

## The capture flags

- `yarn ds:parity:capture <test file> [--force]`: capture mode, stamped with the commit.
- `DS_HARVEST=1`: re-harvest a component's call sites (writes the cases and the classes file).
- `DS_SCREENKIT_REPORT=<file>`, `DS_SCREENKIT_PLATFORMS=ios`: the coverage report, one platform.
