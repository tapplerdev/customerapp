# src/testing: parity tooling for the design-system migration

Everything in this directory is jest-only. Nothing here may be imported from app code.

Pass 1 of the migration (NativeWind to StyleSheet and the ds tokens) has to be pixel-identical, and
the proof is host-tree parity: what a component or a screen hands React Native's native views,
compared against a fixture captured from the code before the change. This file is the workflow a
W1 or W2 agent follows, and a reference for the tools behind it. It is customerapp's copy of
proapp's kit (proapp `feature/design-system` @ 84f2287c, with archive/ds-pass1-tools' normaliser
rule); what differs from proapp is called out where it matters.

| Piece | What it is |
|---|---|
| `hostTreeParity.ts` | Renders in an environment (language, RTL, platform, fonts, insets), normalizes the host tree, captures and compares fixtures. The gate. |
| `screenKit/` | Renders a whole screen the way the app does, with mocked data and native modules, under `jest.parity.config.js`. |
| `harvest/` | Reads a component's real call sites into prop sets and freezes them (`<Name>.cases.json`). A component's twin test draws its frozen call sites (`<Name>.twins.json`: each set as the codemod converted it at the W3.1 freeze, `frozenTwinCases`); every other harvest test checks its cases hand the component no class (`expectClassFree`). |
| `buttonLooks/` | B's two Button look files (`ButtonLooks.cases.json`, `ButtonLooks.table.json`), pinned by hash in `frozenLooks.test.ts`. ActionBtn's harvest, translator and live comparison went in W3.4 (see "The archive tag"). |
| `classGuard.ts` | The runtime guard (W3.4): an element with a class string, or a DmText or ActionBtn, fails where it is made. The screen kit runs every render under it. See "The guards" below. |
| `trueSheet.tsx` | The stand-in for `@lodev09/react-native-true-sheet` in both jest configs (see "What the kit mocks"). |
| `svgStub.ts` | An SVG icon as a host element named after it. |

## After W3.1, W3.2, W3.3 and W3.4: the proofs need no NativeWind

W3.2 took NativeWind's Babel plugin (babel.config.js) and types
(`src/types/declarations.d.ts`) out of the build, so a class string draws
nothing. W3.1 had made every proof independent of it:

- **Fixtures are JSON captured with NativeWind on**: every `__parity__/*.json`
  tree, `*.cases.json` harvest, `ButtonLooks.cases.json` / `ButtonLooks.table.json`
  (B's looks, hash-pinned in `buttonLooks/__tests__/frozenLooks.test.ts`) and
  `__tests__/__parity__/hostTreeParity.test.json` (which also holds four real
  ActionBtn trees). Never recapture one from converted code.
- **A component that took a class** proves its twins from the frozen call
  sites: `__fixtures__/<Name>.twins.json` (9 files, 141 cases: the 7
  `*.twins.test.tsx` and the kit's `OrderBill` and `scroll` twins). A twin test
  draws each frozen site and compares it with the trees its class-name test
  captured (`file:` the `__parity__` JSON, which stays); `expectFrozenCover`
  fails when the file loses a case or holds a stray drop. A failing frozen twin
  means the component changed what it draws, never that the frozen file is
  wrong. No codemod runs and no class compiles.
- **A component that takes none** hands its harvested cases to
  `expectClassFree`, which fails on a non-empty className-family value or a
  DmText/ActionBtn spec in them.
- **The class-name path is gone**: the class-name parity tests of the 9
  class-taking components, every `*.classes.tsx`, `describeCompiledClasses`,
  `twinCases` and the compiled-class reference were deleted in W3.1, and a
  harvest writes only its cases. They live at the local tag
  `archive/ca-pass1-tools` (the last commit with the plugin on and every
  gate green), with the live halves that ran under `yarn test:pass1-tools`
  (`*.pass1.test.*`: the class-era tools, `hostTreeParity.pass1.test.tsx`).
  W3.4 then deleted those tools too: see "The archive tag" below.
- **The frozen set** that must stay byte-identical until the pass-1 proof is
  done: `**/__parity__/**`, `*.twins.json`, `*.cases.json`, `*.hand.tsx`,
  `*.handCases.tsx`, `buttonLooks/__fixtures__/ButtonLooks.*.json`.
  `git diff --stat <W3.2> -- <those>` is empty at every later gate.
- **Refreezing a twin file** was W3.1 only (it ran the codemod): `DS_FREEZE_TWINS=1`
  refuses now, naming the archive tag, where the freeze and the codemod live on.
  Re-running it over the 9 files there rewrote them byte-identically.

What W3.2 flipped, in one commit:

- **The build**: `'nativewind/babel'` out of babel.config.js, the nativewind
  types reference out of declarations.d.ts, and metro.config.js's cacheVersion
  prefixed `ds-w3-`. Metro's transform key never sees babel.config.js, so the
  prefix (not `--reset-cache`, which empties the cache every Metro on the
  machine shares) is what stops a transform made with the plugin being served.
  Bump it again after any change to babel.config.js. `nativewind`, `tailwindcss`
  and `clsx` stay in package.json: removing them is an install, which is not
  part of W3 (`tailwind.config.js` went in W3.4).
- **The control**: `__tests__/noPluginControl.test.tsx` in `yarn test` draws a
  className on a View (`__fixtures__/ClassNameOnView.tsx`) and expects it on
  the host as a plain prop, then resolves babel.config.js's plugins for an app
  file and a shared one, and compiles the canary as Metro does, under Babel's
  `test`, `development` and `production` envs: no NativeWind plugin, wrap or
  require. A plugin put back anywhere fails it (jest alone runs in `test`, so
  the other two envs are what the Metro bundles use).
- **W3.3 stripped the class plumbing** from customerapp's own components: the
  twin slots of AnimatedSelectCategory (ClassNameText to ds `Text`), BannerContainer
  (two), ImageWithCheckmarkButton, ImageWithTextButton, OrderBill, PromoLine,
  SkeletonLoader and TextWithCheckmarkButton (`classNameSlot(DmView)` to a
  DmView with `style`), and the three className threadings in
  `components/scroll/index.tsx`. 13 className attributes and 9 className prop
  types went; every frozen proof stayed byte-identical.

### tsc

The set is d35860c's 32 errors: W3.2 added the six className errors in
`src/components/scroll/index.tsx` (React Native's ScrollView, FlatList and
KeyboardAwareScrollView take no className without the types), which W3.3
stripped with the threadings. tsconfig.json's `exclude` is back to
`**/Pods/**` (W3.2 listed the codemod's class-era fixtures there; W3.4 deleted
them). `yarn ds:paths --write` keeps the `exclude` key but not its comment. Count
a TS2578 (an unused `@ts-expect-error`, which the no-plugin control's
ClassNameOnView carries) as new: it is what fails if the nativewind types come
back.

### The DmText/ActionBtn scan (back since review-ca-w3 F1)

`buttonLooks/legacyPrimitives.ts` reads the AST of every app file and fails on
any way to bring DmText or ActionBtn back: a name, a string, a path, a barrel
taken whole (however spelled: trailing `/`, `/index.ts`), a computed-key
destructure, or an import from `src/testing` or a `__fixtures__` folder, which
the scan itself skips. It needs no NativeWind, and its suite
(`buttonLooks/__tests__/legacyPrimitives.test.ts`) runs in `yarn test`. It is
the one check that sees a DmText in a state no kit row draws.

### The archive tag (W3.4)

W3.4 deleted from customerapp everything that needed NativeWind to run: the
codemod (`scripts/ds-codemod.js` and `ds-codemod/`, `yarn ds:codemod`,
`ds:codemod:parity`), `nw-resolve.js` (`ds:resolve`), `nw-wrap-probe.js`
(`ds:probe`), `ds-colors.js` (`ds:colors`), their fixtures and suites,
`testing/nativewind.ts`, `buttonLooks`' harvest, translator, rewrites,
handLooks and `*.pass1` suites (B's two JSON files and `frozenLooks.test.ts`
stay; `legacyPrimitives.ts` and its suite came back, see below), `harvest/freezeTwins.ts`, `harvestJsxProps.ts`,
every `*.pass1.test.*` half, `jest.pass1.config.js` (`yarn test:pass1-tools`)
and `tailwind.config.js`. `src/styles/dsColors.ts` is kept by hand since; its
header says what pins it.

They live on at the local tag `archive/ca-pass1-tools` (customerapp c5a9e8e, the
last commit with the plugin on and every gate green). To run them, export the
tag and give the export a node_modules (an APFS clone, `cp -cR`, of this one),
the `.env` and a real sibling `tappler-shared` (a real directory, as jest.config.js
requires), then `yarn test:pass1-tools` there (8 suites, 213 tests when W3.2 ran it
at the tag), or the tools themselves:

```
git -C <customerapp> archive archive/ca-pass1-tools | tar -x -C <scratch>/customerapp
cp -cR <customerapp>/node_modules <scratch>/customerapp/ && cp <customerapp>/.env <scratch>/customerapp/
```

The codemod suite's `--proven` row needs e30b19a in the checkout's history, so
run that one in a clone with history (a fresh `git init` fails it). The tag is local: `git push`
doesn't send tags, and pushing it is Omar's call.

### The guards (W3.4)

Nothing draws through a class in customerapp any more, so nothing may hand one
over. Ported from proapp's W3.4 (customerapp-plan.md, skeptic H5):

- **The style ratchet, in `yarn test`** (and in `yarn ds:ratchet` on this tree's
  own baseline). `scripts/__tests__/style-ratchet.test.js`'s W3.4 block reads the
  tree, not the baseline, and wants six totals at 0: className (JSX attributes,
  `tw` included), DmText/ActionBtn elements, and four counts of app code
  (src/testing, whose harnesses build classes and DmTexts on purpose, is left
  out): className-family keys in object literals (also set as a member),
  className-family property signatures in prop types, `nativewind` and `clsx`
  imports, and DmText/ActionBtn imports from tappler-shared. `--update
  --accept-rises` can't bring one back (the CLI refuses to write one). The
  baseline scans `src`, pinned. LegacyText is the bridge (`bridge`), never a
  primitive; pass 2 takes it to 0.
- **The class guard, in `yarn test:parity`** (`classGuard.ts`, installed by
  `screenKit/setup.ts`). Every element a kit render makes goes through
  react/jsx-runtime, react/jsx-dev-runtime, React.createElement or
  React.cloneElement, each wrapped in place in every registry the kit loads. An
  element with a non-empty className-family string, or of shared's DmText or
  ActionBtn, throws where it is made, naming the prop, the element, the
  component that made it and the ones above it. shared's components still take a
  class and hand it on as `className={undefined}` or `""` when a caller gives
  none, and those pass. A refusal an error boundary catches fails the test in
  the setup's afterEach, and a session's `tree()` fails on a host that still
  carries a class (`refuseHostClasses`). Component tests stay out (their
  stand-ins carry harvested props); a render can opt in with
  `withClassGuard(() => ...)`. The proof is
  `screenKit/__tests__/classGuard.parity.tsx`, on
  `screenKit/__fixtures__/ClassGuardProbe.tsx`. A key the ratchet can't read as a
  literal (`{ ["class" + "Name"]: x }`) belongs to the guard alone.
- **The build, in `yarn test`.** `scripts/__tests__/noNativewindTransform.test.js`:
  babel.config.js resolves no NativeWind plugin or preset in envs test,
  development and production (Metro on each platform and babel-jest; a file under
  src, one in shared, one at the root, a plugin handed over as a function
  included), and a canary under src comes out with no `nativewind` in it. The
  resolved lists are the check that counts: a plugin put back with no tailwind
  config compiles nothing. `noPluginControl.test.tsx` (W3.2) is the other half,
  and draws a className under jest. Not ported from proapp: its per-file
  `ds:transform-sweep` (every src file and the shared modules it reaches,
  compiled and read, for before a capture); the served bundle's check (W3 plan
  §5.4) is what stands in for it.
- **Types.** tsc refuses className on React Native's components and on every
  customerapp component, none of which declares one (the ratchet keeps it so).
  tappler-shared's components keep their class props for proapp until W4; the
  ratchet and the class guard cover those.

## The jest configs

`yarn test` is the default config. Component parity tests live there (`*.test.tsx`). It ignores
`*.parity.tsx`. It, and
so every config built on it, refuses to run with `../tappler-shared` a symlink or missing (jest
then drew shared's components without their NativeWind styles: `yarn test` failed 17 tests, and a
capture would have baked in uncompiled classes, so parity passed for the wrong reason).

`yarn test:parity` is `jest.parity.config.js`, which runs every `*.parity.tsx` under `src` (and the
App smoke test, `__tests__/App.parity.tsx`) and nothing else. Screen parity tests live here,
because a screen needs the kit's setup: every native module mocked, the network shut, a real store,
a real navigator, Egypt's time zone, and a module registry per platform and direction.

`yarn test:parity:reverse` is `jest.parity.reverse.config.js`: the same suite with every file's
rows run in reverse order, in every describe block (`screenKit/reverseEnvironment.js`). A fixture
is captured in file order, so a row whose tree depends on the rows before it (module state nobody
resets, a refresh that outlived its row) matches it in file order and passed for the wrong reason
(review M6: with shared's dimProgress off the reset list, FoodCheckout's leaky capture compared
8/8 in order). Reversed, every row runs after different rows, and such a row fails. It only
compares (a capture run is refused), and a test must not lean on the order of the tests before it
(the coverage sweep runs once per platform, in whichever of its two tests comes first).

`yarn test:parity:fresh` is `jest.parity.fresh.config.js`: the same suite with every row in a
module registry of its own (`screenKit/freshEnvironment.js`), as if it ran alone. Reversing can't
see a leak with a source on both sides of a row: with dimProgress off the reset list, a FoodCheckout
idle row between two open-sheet rows follows an open sheet in either order, so its leaky capture
passed 12/12 forward and reversed and failed 4/4 alone (the K re-check). Here it fails.
`freshRegistry.parity.tsx` pins that. A row's renders still share its registry; what lives outside
the registry (the globals, jest's timers, a module the test file imports at its top) the reverse
pass covers. It only compares, and it is for the wave merges (it costs about one app load per row).

A parity row gets 120 s (`testTimeout`), not jest's 5 s: a file's first render in each registry
loads the app, which on a cold transform cache is slow. A row needs no timeout of its own.

All four are gates (the fresh pass at the wave merges). Run jest with your own cache and two
workers:

```
node_modules/.bin/jest --cacheDirectory ~/develop/ds-migration/jest-cache-<you> --maxWorkers=2
node_modules/.bin/jest -c jest.parity.config.js --cacheDirectory ~/develop/ds-migration/jest-cache-<you> --maxWorkers=2
node_modules/.bin/jest -c jest.parity.reverse.config.js --cacheDirectory ~/develop/ds-migration/jest-cache-<you> --maxWorkers=2
node_modules/.bin/jest -c jest.parity.fresh.config.js --cacheDirectory ~/develop/ds-migration/jest-cache-<you> --maxWorkers=2
```

**`@env` is stubbed in both.** react-native-dotenv inlines `@env` when a file is transformed, and
jest caches the transform, so a test's answer would depend on which `.env` filled the cache.
`jest.config.js` sets every key `src/types/env.d.ts` declares (`API_URL`, `HERE_MAPS_API_KEY`) to a
stub before babel runs, and puts the stub in the cache key; `__tests__/env.test.ts` pins it. Never
read a real key or URL in a test.

## The workflow, for every file you convert

This is pass 1's W1/W2 workflow, as it was run (the class-name path it
captured from, its codemod, `describeCompiledClasses`, `twinCases` and the
`*.classes.tsx` are gone since W3.1, and the codemod and the other class-era
tools since W3.4: see above, and `archive/ca-pass1-tools`).
Pass 2 captures from the code as it is, with steps 1 and 3 and the gates in 6.

The order matters. The fixture has to come from the code before your change, or it proves nothing.

1. **Capture before you edit.** Write the parity test for what you're about to convert (a
   component: "A component" below; a screen: "A screen"). Capture it on the unconverted code with
   `yarn ds:parity:capture <test file>` (add `--cacheDirectory <yours>`). Commit the test and its
   fixtures on their own, before the conversion commit. Capture refuses to overwrite a case;
   `--force` is only for recapturing from old code.
2. **Convert.** The codemod (`yarn ds:codemod`, with your own `--latent latent-bugs/<area>.md`;
   at the archive tag since W3.4, and there is no class left for it here),
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
     `accessibilityState`, which ActionBtn never set, and only Button's own values: the label is
     what its label box draws (title, second title, description, joined with ", "; while it
     loads, any non-empty name, as only the spinner is drawn), the role `button`, the state
     ActionBtn's touchable had plus `busy` while it loads. Anything else on a Button's root
     throws, naming the prop (busy while disabled, disabled while enabled, a wrong label).
   - `buttonDisabledView`: the `disabled` flag ActionBtn hands its View when there is no onPress.

   Each one applies only on a button's root (a node holding Button's label box or its spinner),
   with every other style key equal. Anywhere else, the same difference still fails, and so does a
   lost accessibility prop. `expectParity` returns what it accepted, if you want to pin it. No
   other difference is allowed in pass 1. If a tree differs, the conversion is wrong.
5. **The compiled-class control.** NativeWind compiles a class only where it finds it in a `.tsx`
   file's text (tailwind.config.js's `content`: `src/**` and `../tappler-shared/src/**`), and draws
   an uncompiled class as nothing, without a word. A fixture whose classes never compiled matches a
   conversion that drops them too. So every fixture with class strings outside the component's own
   `.tsx` (harvested cases, JSON) does three checks first, in capture and in compare runs: a
   control class draws, the classes file lists every string, and every token draws exactly what
   `scripts/nw-resolve` says. `describeCompiledClasses` declares all three. If one fails, fix the
   classes file (re-harvest) and recapture from the old code. Never recapture from converted code.
6. **The other gates** (the tools are CA-W0-T's; their own docs sit with them in `scripts/`). tsc
   has no new errors against the W0 baseline (compare the error set for your files, not the
   total). Full `yarn test`, `yarn test:parity` and `yarn test:parity:reverse` are green.
   `yarn ds:ratchet` is OK (never `--update`), and so is
   `yarn ds:ratchet --strict '<area>/**' --strict-metrics className`.
   (`yarn ds:probe` showed 0 BUG until W3.2 took the plugin out; it is at the archive tag.)
   customerapp has no React Compiler, so proapp's compiler-coverage gate doesn't apply.

**Prove each pressable.** A handler swapped for one that does nothing draws the same tree until it
is pressed (the example's fifth mutant), so give every converted pressable a row that presses it
and draws what the press did (a modal, a navigation in `session.navigation.actions`, a request in
`session.requests()`). The W2 review neuters each handler and expects a row to fail.

## A component (W1)

The templates are proapp's `components/VerifyScreenComponent/__tests__/VerifyScreenComponent.parity.test.tsx`
(3 sites, typed states) and `components/HeaderOnboarding/__tests__/HeaderOnboarding.defaults.test.tsx`
(98 sites); read them with `git -C <proapp> show 84f2287c:<path>`.

1. Tell the harvest what each prop is:

   ```ts
   const FILES = harvestFilesFor(__dirname, "SkeletonLoader")
   const OPTIONS: HarvestOptions = {
     srcRoot: path.resolve(__dirname, "../../.."),
     importFrom: componentImport("SkeletonLoader"),
     props: { title: "text", className: "class", disabled: "bool", Icon: "node", onPress: "fn", item: "any" },
     rewrites: { "screens/X/X.tsx:120": { reason: "forwards its caller's class", values: { className: 'oneOf("mt-[4]", "mt-[8]")' } } },
     skip: { "components/Wrapper/Wrapper.tsx:40": "spreads its callers' props" },
   }
   ```

   **customerapp imports a component two ways**: `components/X` (the folder's index, 71 imports at
   e30b19a) and `components/X/X` (the file, 80). The harvest matches an import's text, so use
   `componentImport(name)`, which matches both and nothing else; a regex for one style misses
   half the call sites without a word.

   `text` becomes a placeholder (a literal stays as written, `t("key")` becomes `t:key`), `fn` a
   marker, `bool` a condition (both values), `any` a marker you give a value for, and `class`,
   `node` and `value` must settle or come from a rewrite. A site's conditions are shared across its
   props, so no impossible set is made. An unknown prop, a stale rewrite or a stale skip stops the
   harvest. A file that imports the component under more than one name is harvested under every
   one.
2. Harvest: `DS_HARVEST=1 node_modules/.bin/jest <test file>`. It writes
   `__fixtures__/X.cases.json` (the sets and the sites behind each one) and
   `__fixtures__/X.classes.tsx` (every class string, so NativeWind compiles them). Import the
   classes file at the top of the test. It lives in `__fixtures__`, not `__tests__`, because jest
   would take a `.tsx` under `__tests__` for a test, and the style ratchet and the codemod skip
   `__fixtures__`.
3. In the test: `describeCompiledClasses(cases, FILES, classStringsOf(cases.cases))` (cases that
   pass no class string get the control and the list only, so call it either way), then one row
   per case and environment:

   ```ts
   expectParity(parityName(id, env), hostTree(<X {...buildProps(entry.props, { elements, opaque })} />, env))
   ```

   `elements` maps the tags an element prop names (DmText, DmView...; anything else becomes an
   SVG stand-in), and `opaque` gives values for the `any` markers (or a function for all of them).
4. **The twins** (W2-CARD's workflow): `twinCases` hands each harvested set to the codemod as a
   call site of its own and renders what it writes, so a component's style twin is proved on every
   real call site's classes. It loads the codemod (`scripts/ds-codemod`) on first use.
5. Capture, convert, assert, as above. The cases stay frozen while you convert the call sites, so
   the fixture keeps describing the class-name path.

A component test that needs a sheet, a map or a press gets the same stand-ins in `yarn test`
(jest.setup.js registers the sheet, Reanimated and worklets ones); a screen-sized render belongs
in the kit.

## A screen (W2)

The templates are `testing/screenKit/__tests__/workflow.parity.tsx` (capture, converted, mutant, on
the kit's own ExampleScreen) and `example.parity.tsx` (a real customer screen, WelcomeScreen, with
presses and five mutants).

```tsx
import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { screenState, type ScreenStateName } from "testing/screenKit/states"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

const load = () => require("../JobDetailScreen")
const STATES: ScreenStateName[] = ["data", "empty", "loading", "error"]
const rows = rowsByPlatform(STATES.map((state) => ({ state })), PARITY_MATRIX)

it.each(rows)("$state [$env.language $env.platform]", async ({ state, env }) => {
  const tree = await renderScreen(load, {
    ...screenState(state),
    lang: env.language,
    platform: env.platform,
    route: { name: "JobDetailScreen", params: ROUTE_PARAMS.JobDetailScreen },
  })
  expectParity(parityName(state, env), tree)
})
```

- **Name it `*.parity.tsx`.** Put it in the screen's `__tests__`; its fixture lands in
  `__tests__/__parity__/MyScreen.parity.json`. `yarn ds:parity:capture <file>` picks the kit's
  config for a `*.parity.tsx`.
- **Pass the screen as a loader**, `() => require("../MyScreen")` (or a path under `src`). Each
  render loads in a module registry decided before anything loads: one per platform, so the files
  that read `Platform.OS` at import (the map pickers' `isAndroid`, ProsListing's and
  SearchLocationModal's StyleSheets) draw Android; one per layout direction, so the files that read
  `I18nManager.isRTL` at import (FoodCheckoutScreen/styles.ts:15) draw their Arabic branch in
  Arabic rows, as the app does after its language restart (proapp's kit couldn't: there it was
  device-only); and one per window, below. A component imported at the top of the test belongs to
  the wrong registry (see Traps: one that reads `I18nManager.isRTL` there throws). For the same
  reason, a harness component that calls hooks has to be defined
  inside the loader. Order the table with `rowsByPlatform` (platform, then English before Arabic),
  so the file switches registries as few times as it can.
- **Cover the states a customer sees**: data, empty, loading and error, signed in and as a guest
  (`guestState`: AccountScreen, TalabatiScreen, MessagesScreen and HomeHeader branch on `isAuth`),
  a modal or sheet open, long Arabic copy. When the customer has to press or type first, give
  `treeAfter` the steps (the helpers below):

  ```ts
  const tree = await treeAfter(load, options, env, [
    (root) => typeInto(root, 0, "Mona"),
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
  tap doesn't wait for its handler either, and the settle after `act` runs what the press started.
  (The helpers below return nothing already.) A returned promise still pending after 1,000 turns
  of the event loop fails the row at once, naming the press, instead of hanging it until jest's
  timeout.

- **Press and type by what the customer sees.** A screen has no testIDs (and can't get them in
  pass 1: a testID is a host prop, so the tree would change). From `testing/screenKit`
  (`interact.ts`):

  | Helper | What it does |
  |---|---|
  | `copy(env, key)` | The string for `key` in the row's language (customerapp's locale files are flat), falling back to English as i18next does; throws on a key neither file has. |
  | `pressTitled(root, title, { allowDisabled }?)` | Calls the onPress of the one outermost element with that `title` (ActionBtn, Button, an account row). A disabled control throws: anything a tap on it goes through, down to the touchable's native view, says `disabled`/`disable`, or that view's `accessibilityState` does: a tap does nothing there. `allowDisabled` presses it anyway, for a test of the handler, never a customer's step. |
  | `pressText(root, text, { nth, allowDisabled }?)` | Calls the onPress of the innermost element whose text is `text` (a link: a pressable view around a text). Two separate controls showing those words throw unless `nth` (0-based, in screen order) picks one; a disabled one throws, as `pressTitled`'s does. |
  | `pressIcon(root, { icon, nth, allowDisabled }?)` | Calls the onPress of an icon-only control (one that draws something and shows no words: a back chevron, a close X, JobDetail's ••• dots), the innermost of its chain. `icon` names a host it draws (`svg:close`: the kit's svg transformer names each icon after its file; or `Image`, `LottieView`); `nth` picks by place among the screen's icon-only controls. Several throw, listing what each draws (`[0] svg:chevron-left, [1] 5 views`); a disabled one throws, as `pressTitled`'s does. |
  | `typeInto(root, index, text)` | Types into the `index`th field (DmInput, DmAuthInput: composite elements taking onChangeText, outermost first) through the TextInput it draws, as `fireEvent.changeText` does, so the field's own handler runs (`fromArabic` for digits). A field with no TextInput (a DmInput with onPress) or one that isn't editable throws. |
  | `fireHost(root, type, prop, args?, { nth }?)` | Calls a native view stand-in's callback as the device does: `fireHost(root, "MapView", "onRegionChangeComplete", [region])` (PickAddress reverse-geocodes from it), `fireHost(root, "LottieView", "onAnimationFinish", [false])` (RequestSuccess, Talabati). |
  | `closeSheetAsUser(root, { nth, refused }?)` | Closes a presented sheet the way a customer does (a swipe, the dim): the sheet reports its dismissal with nobody's dismiss() behind it, so shared's NativeSheet calls `onDismissed` (a close the screen asked for calls only `onClosed`). A sheet that isn't dismissible throws: NativeSheet hands true-sheet `dismissible={false}` for `dismissable={false}` and every `interceptBackPress` sheet (QuestionFlowSheet), and the device refuses the swipe. Close it with its own controls; `{ refused: true }` draws the refused swipe (the sheet stays up, `onDismissAttempt` fires). `presentedSheets(root)` lists them. |
  | `fields(root)`, `only(root, predicate, what)` | The fields `typeInto` counts; the one outermost match, or a throw saying how many. |
  | `treeAfter(load, options, env, steps)` | The tree after `steps` (each a `Step`: `(root, env) => void`, with an optional `settleMs`). |
  | `wait(ms)` | A step that only lets `ms` pass. |
  | `BOTTOM_GAP_INSETS` | `[0, 48]`: the bottom insets to add for a screen with an `insets.bottom > 45 ? 0 : 45 - insets.bottom` gap (rows with `insets: { bottom }`). |

- **Small phones: give the row a `window`.** tappler-shared's helpers work out `isSmallPhone`
  (width under 393), `isLittlePhone` (under 375), `isBigPhone`, `isSmallPhoneHeight`,
  `SCREEN_WIDTH` and `SCREEN_HEIGHT` once, when they load, and so do customerapp's ReviewFormScreen,
  MessagesComponent (and its styles), MessageComponent (and its styles), TabBar's styles,
  FoodMenuItemRow's styles, OffersSection and ImageViewerModal. A row's `window` is part of its
  registry, like its platform and direction, and is applied before anything loads:
  `window: { width: 390 }` draws the small-phone branch, `{ width: 402 }` the large one. Each window
  is its own registry, so keep a window's rows together. A row without `window` loads the app with
  jest's 750 x 1334 (`LOADED_AS_BEFORE`) and renders at 402 x 874; give `window` (even
  `{ width: 402 }`) where a load-time value should be the device's.

  A component test doesn't use the kit; it can do the same in a registry of its own, set up
  before the component loads:

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
      const Item = require("../OffersSection").default
      tree = hostTree(React.createElement(Item, props), env)
    })
    return tree
  }
  ```

- **Mock data and native modules only.** Never mock your own child components. A parity test
  built on stand-ins compares stand-ins.

### renderScreen's options

| Option | Default | What it does |
|---|---|---|
| `lang` | `en` | i18next, RTL (and the registry's direction), the ds language provider and `auth.language`. moment stays on the device's locale (see Traps). |
| `platform` | `ios` | The registry the render loads in. |
| `route` | `{ name: "parity-screen" }` | Name and params of the screen's route (`ROUTE_PARAMS` has every param route's). |
| `state` | initial state | The store's slices, over each slice's initial state (`auth`, `cart`). |
| `api` | `{}` | The backend's answers by endpoint name: `{ data }`, `{ error: { status, data } }`, `"loading"`, or a function of the request. An unlisted endpoint stays loading. `authRefresh` answers the refresh a 401 sends; a refresh nothing answers fails the row (Traps). |
| `http` | `{}` | The app's plain fetches (HERE's geocoding, the SVG art cache), by URL with HERE's `apiKey` taken out (`httpKey`): `{ json }` or `{ text }` with an optional `status`, or `"loading"`; or a function of the key. An unlisted URL never answers. |
| `permissions` | all granted | The device's answers by react-native-permissions name (`ios.permission.LOCATION_WHEN_IN_USE`...) or `notifications` (notifee and Firebase messaging read it too): `granted`, `limited`, `denied`, `blocked`, `unavailable`. |
| `location` | `"pending"` | What a location request answers: no fix ever, a `{ latitude, longitude }`, or `{ error: { code, message } }`. |
| `cache` | none | RTK Query entries present before the screen opens (a prefetch-before-navigate, a list's entry). |
| `storage` | none | MMKV keys present before the render (the app's memos and flags). |
| `insets` | iPhone 16 Pro on iOS (62/34), 24/24 on Android | Safe-area insets. |
| `window` | 402 x 874 @3x | The window `Dimensions` reports; applied before the app loads when given (see "Small phones"). |
| `now` | 2026-10-20T08:00:00Z | The frozen clock (fixtures' dates count back from it: `HOURS_AGO`, `DAYS_AGO`). The settle loop moves it. |
| `settleMs` | 1000 | How long the settle loop runs the clock after mounting. |
| `navigation` | `container` | A real NavigationContainer and stack. `none` renders the bare component. |
| `props` | none | Props for the component, beside `navigation` and `route`. |

`renderScreen` returns the normalized host tree. `openScreen` returns a session: `tree()`,
`settle(ms)`, `act(fn, settleMs?, what?)`, `root` (the test renderer), `store`, `requests()` (every
request the screen sent, with whether a fixture answered it), `fetches()` (every plain fetch, by
key), `navigation.actions` (navigations the one-route stack couldn't handle, like a navigate
elsewhere) and `unmount()`.

### Fixtures

- `states.ts`: `screenState(name)` (a signed-in customer), `guestState(name)` (signed out, with a
  picked location) and `freshInstallState()` (no language picked), with the backend answering
  `data`, `empty`, `loading` or `error`. Spread one and add your own.
- `fixtures/users.ts`: `CUSTOMER` (GET /customers/me, two saved addresses), `signedIn(customer)`,
  `guest`, `freshInstall`.
- `fixtures/entities.ts`: services and categories (plumbing with questions, a food category),
  the Home preset, pros (individual, company, a food pro with its menu), a service request with
  one offer in, a food order, a chat and its messages (text both ways, a photo, a location),
  notifications (read, unread), the map's areas, a fresh cart draft (dated from the kit's clock:
  drafts expire after an hour).
- `fixtures/api.ts`: `DATA`, `EMPTY` and `ERROR` for the 18 queries (pinned against
  services/api.ts). Mutations have no default: give one an answer where a row presses its save.
- `fixtures/routes.ts`: `ROUTE_PARAMS` for every param route, typed by the navigator's param
  list, and `ROUTE_VARIANTS` (JobDetail as a food order).
- `fixtures/components.ts`: props for the screen-local components only a tap reaches (none yet).

One answer per endpoint is the kit's core (skeptic M9): the states an area needs (a job in every
status, each message kind on its own row) belong to that area's tests, built from these, and move
here when a second area wants them. Everything is typed by the app's own types; a big record is
`some<T>()`. These files belong to the main session from W1, so ask for additions rather than
editing them in an area branch.

### What the kit mocks, and what it doesn't

- **Native modules and views** (`screenKit/nativeMocks.ts`). A view becomes a host named after it,
  carrying every prop it was given, with its children (MapView and its Marker/Polygon, LinearGradient,
  LottieView, Video, WebView, FastImage, DropShadow, Slider...). A module answers like a device
  that has said nothing yet: permissions granted (unless the row says otherwise), a picker that
  never returns, a thumbnail that never arrives, a Firebase token that never comes, a socket that
  never connects. Reanimated has `Animated.View`, `Text`, `ScrollView`, `FlatList`, `Image` and
  `createAnimatedComponent`, with `entering`, `exiting` and `layout` dropped the way the library
  drops them. FlashList and the carousel draw every row. React Native's Modal is its own jest mock
  (a `Modal` host while visible, nothing after), and on iOS rows a shown modal told to hide calls
  `onDismiss` right after the closing commit, as UIKit's dismissal does (Android's Modal has none).
  customerapp has no payment SDK (both methods are collected on delivery), so there is none to
  stand in for.
- **The sheet** (`trueSheet.tsx`, both configs). The library's own mock drew the header, children
  and footer into a plain View whether the sheet was open or not, and handed it only `style`, so
  an open sheet, a closed one and one whose props changed drew the same tree (proapp's B1, B2, B3,
  B5, B6 and B7 reviews). The stand-in draws a `TrueSheet` host with every prop it was given plus the
  state it is in, `presented` and `detentIndex`, and mounts the content (`TrueSheetHeader`,
  `TrueSheetContent` with `style`, `TrueSheetFooter`) only while the library would: from
  `present()` until the sheet is dismissed (always with `lazy={false}`, from the start with an
  `initialDetentIndex`). `present()`, `dismiss()` and `resize()` answer at once with their events
  (`dismiss()` reports onWillDismiss and onDidDismiss before its promise settles, which is how
  shared's NativeSheet tells its own closes from the customer's). A customer's swipe is
  `closeSheetAsUser`, which a sheet with `dismissible={false}` refuses as the library does (it
  stays up and reports `onDismissAttempt`). The true-sheet reanimated entry (shared's NativeSheet.tsx:4) is the library's
  mock: its position handler never runs, so the dim's drag never moves.
- **The network is shut.** RTK Query's `fetchBaseQuery` is answered by the kit's backend. A plain
  `fetch` is answered only by the render's `http`; any other fetch, XMLHttpRequest or WebSocket
  goes nowhere and is listed (`networkAttempts()` from `testing/screenKit`). The app's backend is
  production.
- **Module state is fresh for every row** (`screenKit/rowState.ts`). The kit reuses a registry for
  every row of a platform, direction and window, and some app modules keep state at module scope:
  chatReadRegistry's read chats (a 20 s TTL the frozen clock never reaches: one MessagesDetails
  row's mark-all zeroed that chat's unread count in every later row), svgCache's art, chatCache's
  open chat, useAttachments' optimistic ids, layoutAnimation's frame flag, the event buses'
  listeners and shared's sheet dim. Each is the module's own code, evaluated again from its source
  for every row (`PER_ROW`, mocked in setup.ts and pinned against it). A module that keeps state
  and isn't listed still leaks: add it. `yarn test:parity:reverse` and `yarn test:parity:fresh`
  are what find one (the pin can't see a module taken off both lists): reversed, a leak shows when
  the rows before a row change; fresh, whatever is on both sides of it.
- **Real**: the store (the app's reducers and middleware, fresh per render; a test pins the reducer
  list and the app-state middleware's tags against `src/store/index.ts`), React Navigation,
  i18next, NativeWind, tappler-shared, react-native-safe-area-context, react-native-screens,
  gesture-handler (its own jest setup), react-native-calendars, the keyboard-aware scroll view,
  rn-tourguide, every one of our components.

### The App smoke test

`__tests__/App.parity.tsx` boots `src/App` itself in the kit: the store, the persist gate (the
kit's persistor is bootstrapped from the start), the realtime manager (socket and push, which never
connect), the navigator and BootstrapScreen's effects. A fresh install opens on WelcomeScreen
asking nothing of the backend; a guest lands on Home on anonymous requests; a signed-in customer
lands on Home with the account fetched; in Arabic the boot PATCHes `preferredLanguage` (the rig's
proxy answers it 503) and Home still draws.

### Traps

- **Nothing a row draws is imported at the top of the test.** A top-level import loads in the test
  file's own module registry, which is no row's: LTR, iOS, jest's window. A styles file that reads
  `I18nManager.isRTL` as it loads (FoodCheckoutScreen/styles.ts:15), imported there, kept its
  English branch in every Arabic row, in the capture and the compare alike. So the kit's setup
  makes that registry's I18nManager throw when it is read, naming the fix: require the module in
  the loader (a harness defined inside it) or in a step (`screenKit/__tests__/topRegistry.parity.tsx`).
  `Platform.OS` and `Dimensions` can't be guarded that way (React Native reads them as it loads):
  a module that reads those at import, imported at the top, draws iOS and jest's window in every
  row without a word.
- **moment's locale is the device's, not the app's language.** customerapp's BootstrapScreen sets
  i18next and RTL but never moment, so moment keeps what shared's setupI18n gave it: RNLocalize's
  tag (the mock's `en-US`). The kit puts it back before every row, after the screen loads, because
  importing `moment/locale/ar` (MessageComponent does) switches moment's global locale as a side
  effect (moment's defineLocale). On the device that import runs only once a chat is first drawn
  (Metro's inline requires), and from then on in that session every date formatted with the global
  locale (NotificationItem, OfferHistorySheet, RequestSummary's deadline) comes out Arabic, in
  English too. The kit draws a fresh session; the device rig's order decides what it draws.
- An env switch must be read through a variable key (`globalThis.process.env[key]`).
  react-native-dotenv inlines a literal `process.env.NAME` at transform time, and jest caches it.
- A `t("key")` prop is drawn as `t:key` by the harvest. Translate it in the test if the component
  reads the text.
- `Image.prefetch` resolves and `Image.getSize` gives 1440 x 1080. React Native's preset leaves
  them without an answer.
- A new native library a screen imports needs a stand-in in `nativeMocks.ts` and a line in
  `setup.ts`. A new ESM package needs a line in `jest.parity.config.js`'s allowlist.
- **A 401 needs its refresh answered, or the row fails.** baseQueryWithReauth sends
  `/auth/refresh/<token>` through the 401'd endpoint's own call; the kit answers it as
  `authRefresh` (`AUTH_REFRESH`): `{ data: { token, refreshToken } }` (the request is retried),
  `{ error: { status: 401 } }` (the app signs out), `REFRESH_TIMED_OUT` (unreachable: the session
  stays and the 401 stands) or `"loading"` (in flight). services/api.ts keeps `isRefreshing` and
  the refresh's promise at module scope, and the store holds that module, so the per-row reset
  can't renew it: a refresh left pending used to hold every later 401 in the registry, which then
  drew a stuck skeleton that the same-order compare passed (review H1). So a row whose refresh
  nothing answers fails (at the open, the first `tree()` or `unmount()`), and a refresh still in
  flight when its row ends is ended the way the device's ends (fetchBaseQuery's 20 s timeout,
  `REFRESH_TIMED_OUT`), so the next row starts clean (`screenKit/__tests__/refresh.parity.tsx`).
- **Ids from a counter or a random source compare stable.** `expectParity` numbers gesture
  handler's `handlerTag`s by appearance (the library's counter runs on across a registry's renders,
  so a row inserted mid-file shifted every later row's tags: proapp's B7), trims a native stack's
  `screenId` to the route's name (React Navigation's keys end in a random nanoid: proapp's B3
  trimmed them by hand), and would number react-native-shadow-2's gradient ids, which customerapp
  doesn't install. A fixture captured with raw ids needs no recapture; a reference to another
  handler or screen still fails.
- **Before W3** (done in W3.1): the self-tests that drew class names were
  rewritten: KitProbe's face is ds Text, workflow.parity compares the converted and
  mutant ExampleScreens only (the class-name one stays as the fixture's record, rendered by
  nothing), and the five WelcomeScreen mutants are copies of the converted screen.

## Coverage: `yarn ds:parity:screens`

Every file under `src/screens` loads in each platform's registry. Each registered screen (the
stack's 40 with a screen of `src/screens` and HomeTabs' 4 tabs) renders in the data and loading
states, plus its route variants. Every other file's component renders on its own (with props where
only a tap reaches it). The components a render drew are traced back to their files. The gate is
nine in ten of the screen files with class names, per platform.
`DS_SCREENKIT_REPORT=<file>` writes every file's outcome, its error, and the requests nothing
answered; `DS_SCREENKIT_PLATFORMS=ios` runs one platform.

At the time of writing (customerapp e30b19a with the kit, shared 6dcf214), on iOS and Android
alike: 66 of 66 screen files load and render (44 as registered screens, 16 inside one, 6 only on
their own); 64 of 64 with class names; in the data state nothing is left unanswered but the two
writes screens send on open (MessagesDetails' mark-all, an unread NotificationDetails' mark-read).

## The capture flags

- `yarn ds:parity:capture <test file> [--force]`: capture mode, stamped with the commit. When
  anything but test material (`__tests__`, `__fixtures__`, `__parity__`, `*.parity.*`,
  `*.test.*`) differs from HEAD, the stamp is `<HEAD>-dirty.<hash of those changes>` and the
  capture lists them: commit the code you capture first.
- `DS_HARVEST=1`: re-harvest a component's call sites (writes the cases and the classes file).
- `DS_SCREENKIT_REPORT=<file>`, `DS_SCREENKIT_PLATFORMS=ios`: the coverage report, one platform.
