/* eslint-disable global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires, no-restricted-syntax, no-await-in-loop, no-continue --
   every file is loaded on purpose, in each platform's registry, and the
   renders run one after another in it. */
import { afterAll, describe, expect, it } from "@jest/globals"
import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import ts from "typescript"

import { openScreen, type KitPlatform } from "testing/screenKit"
import { screenState, type ScreenStateName } from "testing/screenKit/states"
import { COMPONENT_PROPS } from "testing/screenKit/fixtures/components"
import { ROUTE_PARAMS, ROUTE_VARIANTS } from "testing/screenKit/fixtures/routes"

/*
 * The screen kit over every screen file: each file under src/screens loads,
 * and each one the navigator registers renders, in each state, on each
 * platform, and the components a screen drew are traced back to their
 * files (a screen's own components are covered by rendering the screen).
 *
 *   yarn ds:parity:screens       (writes the report when
 *                                 DS_SCREENKIT_REPORT=<file> is set)
 *
 * A file "renders" when the kit can draw it in at least one state without
 * throwing: as a registered screen, or inside one. The report lists every
 * file that doesn't, with the error.
 */

const SRC = path.resolve(__dirname, "../../..")
const SCREENS = path.join(SRC, "screens")
// The stack's routes, and the four tabs HomeTabs registers.
const NAVIGATORS = [
  path.join(SRC, "navigation", "Navigator.tsx"),
  path.join(SRC, "navigation", "HomeTabs.tsx"),
]

// Read through a variable: react-native-dotenv inlines a literal
// `process.env.NAME` at transform time, and jest caches that.
const ENV = globalThis.process.env as Record<string, string | undefined>
const REPORT = ENV.DS_SCREENKIT_REPORT
const PLATFORMS = (ENV.DS_SCREENKIT_PLATFORMS ?? "ios,android").split(
  ","
) as KitPlatform[]
const STATES: ScreenStateName[] = ["data", "loading"]

const CLASS_ATTRIBUTE = /\s(className|className[A-Z]\w*|\w+ClassName)=/

const walk = (dir: string, out: string[] = []) => {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!["__tests__", "__fixtures__", "__parity__"].includes(entry.name)) {
        walk(full, out)
      }
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(full)
    }
  })
  return out
}

const FILES = walk(SCREENS).sort()
const rel = (file: string) => path.relative(path.join(SRC, ".."), file)

/**
 * The navigators' registrations: route name and the module it imports.
 * customerapp names its routes with string literals
 * (`<Stack.Screen name="JobDetailScreen" component={JobDetailScreen} />`).
 */
const registrations = () =>
  NAVIGATORS.flatMap((navigator) => registrationsIn(navigator))

const registrationsIn = (navigator: string) => {
  const source = ts.createSourceFile(
    navigator,
    fs.readFileSync(navigator, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const imports = new Map<string, string>()
  source.statements.forEach((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith("screens/") &&
      statement.importClause?.name
    ) {
      imports.set(
        statement.importClause.name.text,
        statement.moduleSpecifier.text
      )
    }
  })
  const found: { route: string; spec: string }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const attribute = (name: string) =>
        node.attributes.properties.find(
          (p): p is ts.JsxAttribute =>
            ts.isJsxAttribute(p) && p.name.getText() === name
        )
      const component = attribute("component")
      const name = attribute("name")
      const value = (a?: ts.JsxAttribute) =>
        a?.initializer &&
        ts.isJsxExpression(a.initializer) &&
        a.initializer.expression
          ? a.initializer.expression
          : undefined
      let comp = value(component)
      while (comp && ts.isAsExpression(comp)) comp = comp.expression
      const routeExpr = value(name)
      const route =
        name?.initializer && ts.isStringLiteral(name.initializer)
          ? name.initializer.text
          : routeExpr && ts.isStringLiteral(routeExpr)
            ? routeExpr.text
            : undefined
      if (comp && ts.isIdentifier(comp) && imports.has(comp.text) && route) {
        found.push({ route, spec: imports.get(comp.text)! })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

type FileReport = {
  file: string
  className: boolean
  routes: string[]
  import: Record<string, string>
  render: Record<string, Record<string, string>>
  renderedIn: Record<string, string[]>
  requests: Record<string, string[]>
}

const reports = new Map<string, FileReport>(
  FILES.map((file) => [
    file,
    {
      file: rel(file),
      className: CLASS_ATTRIBUTE.test(fs.readFileSync(file, "utf8")),
      routes: [],
      import: {},
      render: {},
      renderedIn: {},
      requests: {},
    },
  ])
)

const firstLine = (error: unknown) =>
  String(error instanceof Error ? error.message : error)
    .split("\n")
    .find((line) => line.trim())
    ?.slice(0, 220) ?? "unknown"

/** Every component type a render drew, composite ones included. */
const drawnTypes = (root: {
  findAll: (p: () => boolean) => { type: unknown }[]
}) => new Set(root.findAll(() => true).map((instance) => instance.type))

/** The components a module exports (memo and forwardRef unwrapped too). */
const exportedComponents = (loaded: Record<string, unknown>) => {
  const out = new Set<unknown>()
  Object.values(loaded ?? {}).forEach((value) => {
    if (!value) return
    out.add(value)
    const inner = value as { type?: unknown; render?: unknown }
    if (inner.type) out.add(inner.type)
    if (inner.render) out.add(inner.render)
  })
  return out
}

const covered = (report: FileReport, platform: string) =>
  report.import[platform] === "ok" &&
  (Object.values(report.render[platform] ?? {}).some((o) => o === "ok") ||
    (report.renderedIn[platform]?.length ?? 0) > 0)

/**
 * The sweep of one platform: every file loaded, every registered screen and
 * every other file rendered, into `reports`. Run once per platform, by
 * whichever of the platform's two tests comes first: `yarn
 * test:parity:reverse` runs them in the other order. Returns how many
 * routes the navigators register.
 */
const sweep = async (platform: KitPlatform): Promise<number> => {
  // The first render loads this platform's registry; every require
  // after it lands in the same one.
  await openScreen(() => ({ default: () => null }), {
    platform,
    navigation: "none",
  }).then((session) => session.unmount())
  const loaded = new Map<string, Record<string, unknown>>()
  FILES.forEach((file) => {
    const report = reports.get(file)!
    try {
      loaded.set(file, require(file))
      report.import[platform] = "ok"
    } catch (error) {
      report.import[platform] = firstLine(error)
    }
  })
  const routes = registrations()

  /** One render: record its outcome, its requests, and every file it drew. */
  const renderInto = async (
    file: string,
    label: string,
    component: unknown,
    options: Parameters<typeof openScreen>[1]
  ) => {
    const report = reports.get(file)!
    let drawn = new Set<unknown>()
    let outcome = "ok"
    try {
      const session = await openScreen(() => component, {
        ...options,
        platform,
        settleMs: 600,
      })
      try {
        drawn = drawnTypes(session.root as never)
        report.requests[label] = [
          ...new Set(
            session
              .requests()
              .filter((r) => r.unanswered)
              .map((r) => r.endpoint)
          ),
        ]
        session.tree()
      } finally {
        session.unmount()
      }
    } catch (error) {
      outcome = firstLine(error)
    }
    report.render[platform] = {
      ...report.render[platform],
      [label]: outcome,
    }
    if (outcome !== "ok") return
    loaded.forEach((exports, other) => {
      if (other === file) return
      const components = exportedComponents(exports)
      if ([...components].some((c) => drawn.has(c))) {
        const into = reports.get(other)!
        const list = into.renderedIn[platform] ?? []
        if (!list.includes(rel(file))) list.push(rel(file))
        into.renderedIn[platform] = list
      }
    })
  }

  const params = ROUTE_PARAMS as Record<string, object | undefined>
  const screens = new Set<string>()
  for (const { route, spec } of routes) {
    let component: unknown
    try {
      component = (require(path.join(SRC, spec)) as { default: unknown })
        .default
    } catch {
      component = undefined
    }
    const file = FILES.find((f) => loaded.get(f)?.default === component)
    if (!file || !component) continue
    screens.add(file)
    const report = reports.get(file)!
    if (!report.routes.includes(route)) report.routes.push(route)
    for (const state of STATES) {
      // eslint-disable-next-line no-await-in-loop
      await renderInto(file, `${route} ${state}`, component, {
        ...screenState(state),
        route: { name: route, params: params[route] },
      })
    }
    for (const variant of ROUTE_VARIANTS[route] ?? []) {
      // eslint-disable-next-line no-await-in-loop
      await renderInto(file, `${route} ${variant.name}`, component, {
        ...screenState("data"),
        ...(variant.state ? { state: variant.state } : {}),
        route: { name: route, params: variant.params ?? params[route] },
      })
    }
  }

  // Every other file's default export, as a component given no props
  // (a skeleton, a static block): it renders, or it needs props, which
  // only its screen can give it.
  for (const file of FILES) {
    if (screens.has(file)) continue
    const component = loaded.get(file)?.default
    if (!component) continue
    const props = COMPONENT_PROPS[path.relative(SRC, file)]
    // eslint-disable-next-line no-await-in-loop
    await renderInto(file, props ? "props" : "no props", component, {
      ...screenState("data"),
      props,
    })
  }
  return routes.length
}

const swept = new Map<KitPlatform, Promise<number>>()
const sweptOnce = (platform: KitPlatform) => {
  if (!swept.has(platform)) swept.set(platform, sweep(platform))
  return swept.get(platform)!
}

// A cold transform cache makes the first load slow; the sweep runs in
// whichever test comes first.
const SWEEP_MS = 30 * 60 * 1000

describe.each(PLATFORMS)("every screen file [%s]", (platform) => {
  it(
    "loads, and the registered screens render",
    async () => {
      // 40 stack routes with a screen of src/screens (HomeTabs is the tab
      // navigator itself) and the 4 tabs.
      expect(await sweptOnce(platform)).toBe(44)
    },
    SWEEP_MS
  )

  // proapp's W1.5 target was the screen files with class names (the ones W2
  // converts), nine in ten of them rendering. W2 is done and none is left, so
  // the ratio over them is 0 of 0: the target now holds over every screen
  // file, and the files with a class name must stay none.
  it(
    "renders at least 90% of the screen files, none with a class name left",
    async () => {
      await sweptOnce(platform)
      const all = [...reports.values()]
      expect(all.length).toBeGreaterThan(0)
      expect(all.filter((r) => r.className).map((r) => r.file)).toEqual([])
      const rendered = all.filter((r) => covered(r, platform))
      expect(rendered.length / all.length).toBeGreaterThanOrEqual(0.9)
    },
    SWEEP_MS
  )
})

afterAll(() => {
  const all = [...reports.values()]
  const summarize = (list: FileReport[]) =>
    Object.fromEntries(
      PLATFORMS.map((platform) => [
        platform,
        {
          files: list.length,
          load: list.filter((r) => r.import[platform] === "ok").length,
          render: list.filter((r) => covered(r, platform)).length,
          // How: as a registered screen, drawn inside one, or only on its own.
          asScreen: list.filter(
            (r) =>
              covered(r, platform) &&
              r.routes.length > 0 &&
              Object.values(r.render[platform] ?? {}).some((o) => o === "ok")
          ).length,
          insideScreen: list.filter(
            (r) =>
              covered(r, platform) &&
              r.routes.length === 0 &&
              (r.renderedIn[platform]?.length ?? 0) > 0
          ).length,
          onItsOwn: list.filter(
            (r) =>
              covered(r, platform) &&
              r.routes.length === 0 &&
              (r.renderedIn[platform]?.length ?? 0) === 0
          ).length,
        },
      ])
    )
  const summary = {
    all: summarize(all),
    withClassName: summarize(all.filter((r) => r.className)),
    screens: summarize(all.filter((r) => r.routes.length > 0)),
  }
  // eslint-disable-next-line no-console
  console.log(`screen kit coverage: ${JSON.stringify(summary, null, 1)}`)
  if (REPORT) {
    const head = (dir: string) => {
      try {
        return execFileSync(
          "git",
          ["-C", dir, "rev-parse", "--short", "HEAD"],
          {
            encoding: "utf8",
          }
        ).trim()
      } catch {
        return "unknown"
      }
    }
    fs.writeFileSync(
      REPORT,
      `${JSON.stringify(
        {
          customerapp: head(path.join(SRC, "..")),
          shared: head(path.join(SRC, "..", "..", "tappler-shared")),
          summary,
          files: all,
        },
        null,
        1
      )}\n`
    )
  }
})
