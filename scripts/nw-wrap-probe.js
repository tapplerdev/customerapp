#!/usr/bin/env node
/**
 * yarn ds:probe [file or dir ...] [--json] [--quiet] [--consumer Name ...] [--platform ios|android]
 *
 * Lists every JSX element NativeWind v2 wraps, file by file, as the app's
 * real babel.config.js builds it, and fails on the wraps that break things.
 *
 * Why it matters: nativewind/babel replaces `<X className="...">` with
 * `<_StyledComponent component={X} className="...">` whenever X is
 * capitalised and not on the file's import block list. The wrapper resolves
 * the className to a `style` array and does NOT pass className on. That is
 * fine for React Native and third-party components (SafeAreaView,
 * Animated.View), which read `style`, and for DmView, which forwards `style`.
 * It is the bug for a component that reads className itself: DmText derives
 * its font family and Arabic line height from it, ActionBtn and MainModal
 * size and round themselves from it. Two ways in, both seen in proapp:
 * - an import NativeWind can't trace to a folder index, such as a file path
 *   (`.../UI/ActionBtn/ActionBtn`, proapp's confirm cards on 2026-10-15), or
 *   a component defined in the same file;
 * - a React Compiler temporary: compiled, `<ActionBtn>` can become
 *   `const T0 = ActionBtn; <T0 ...>`, and T0 is on no block list.
 * customerapp has no React Compiler (babel.config.js), so only the first way
 * exists here, and it does: at e30b19a seven of the app's own components are
 * imported by file path at twelve call sites, and wrapped there (`review`
 * below; none of the seven reads `style`, so on device those classes draw
 * nothing). So the rule
 * (design-system plan, Revision 2 item 6): no wrap whose component, directly
 * or through a temporary, is a className-consuming component. Converted
 * files should show no wraps on them at all.
 *
 * Each wrap is one of:
 *   BUG     a known className consumer (DmText, ActionBtn, MainModal,
 *           DmInput, DmChecbox, plus --consumer), wherever it was imported
 *           from, or a same-file component that reads `className`
 *   review  our own component (src or tappler-shared) that isn't known to
 *           forward `style`: it now gets style instead of className; or
 *           anything the probe can't pin down
 *   ok      an import that resolves into node_modules (react-native and
 *           other third-party components), or DmView; or one of
 *           tappler-shared's className slots (components/classNameSlots.ts):
 *           ClassNameText, or a classNameSlot()/lazyClassNameSlot() over a
 *           host that is itself ok. A slot exists to be wrapped (NativeWind
 *           resolves the caller's classes and the slot draws them after the
 *           component's base), so its verdict is its host's: a slot over
 *           DmText is a BUG, a slot over our own unknown component is
 *           review, and a classNameSlot() that isn't that module's is
 *           review like any other call.
 * A tag that is reassigned (`let Label = DmView; if (big) Label = DmText`)
 * is every value it can hold, and the worst verdict wins. Wraps reached
 * through a compiler temporary say so (`via T0`); the compiler's memo-cache
 * reads (`T0 = $[3]`) count as whatever was stored in that slot.
 *
 * How: the real config is loaded per file (babel.loadPartialConfig, so any
 * per-directory override applies, as proapp's compiler one did), and a
 * read-only plugin goes in right after nativewind/babel. Babel runs Program
 * `enter` in plugin order and NativeWind (and a compiler, where there is one)
 * does all its work there, so the probe sees exactly NativeWind's output,
 * before the preset compiles the JSX away. Each file is then checked against itself:
 * the number of wraps the probe saw must equal the number of
 * `StyledComponent` references in the final output.
 *
 * NativeWind does nothing to a file outside tailwind `content`, so a probe
 * that is looking in the wrong place reports a clean file. Every run first
 * probes scripts/__fixtures__/nw-wrap-probe/PositiveControl.jsx (as if it
 * lived in src/) and stops unless it yields exactly its three known-bad wraps
 * (a file-path import, a same-file consumer, a className slot over DmText,
 * so a slot rule that starts passing hosts it shouldn't stops the run too).
 * proapp's control also expects two React Compiler temporaries; this one
 * expects none, so a compiler added to babel.config.js stops the run until
 * the control expects its temporaries again.
 *
 * The twelve `review` wraps at e30b19a are the twelve call sites whose
 * className draws nothing, frozen in scripts/ds-codemod/dead-at-e30b19a.json
 * (here by file, component, classes and the text of the className line at
 * e30b19a, each row once): they stay review, and any other review wrap fails
 * the run, so a new one is looked at rather than counted. Once W1 deletes
 * those classNames their wraps go, which is fine: only a review wrap the
 * list doesn't hold fails, and a class moved to another element of the same
 * component, or a dead one written after the twelve are gone, is not one of
 * them.
 *
 * Exit 0: no BUG and no review beyond the twelve. Exit 1: a BUG, a review
 * wrap beyond the twelve, or the positive control failed. Exit 2: a file
 * failed to transform, or bad usage.
 */
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const SHARED_SRC = path.join(ROOT, "..", "tappler-shared", "src")
const FIXTURES = path.join(__dirname, "__fixtures__", "nw-wrap-probe")
const CONTROL = path.join(FIXTURES, "PositiveControl.jsx")
// Where fixtures are transformed: inside src/, so tailwind `content` (and
// any src/ override in babel.config.js) applies. Nothing is written there.
const VIRTUAL_DIR = path.join(ROOT, "src", "__nw_wrap_probe__")

// proapp's list less HeaderOnboarding, a proapp component.
const CONSUMERS = ["DmText", "ActionBtn", "MainModal", "DmInput", "DmChecbox"]
const FORWARDERS = ["DmView"]
// Calls whose result is the component passed to them (or defined in them).
const COMPONENT_WRAPPERS = [
  "memo",
  "forwardRef",
  "createAnimatedComponent",
  "styled",
]

// tappler-shared's className slots: a component binds one to a module-level
// const and renders it with the caller's className, on purpose.
const SLOTS_MODULE = path.join(SHARED_SRC, "components", "classNameSlots.ts")
const SLOT_FACTORIES = ["classNameSlot", "lazyClassNameSlot"]
const SLOT_COMPONENTS = ["ClassNameText"]

// What the control must yield, in source order. No compiler temporaries:
// customerapp has no React Compiler (proapp's control starts with two).
const CONTROL_EXPECT = [
  { component: "DmTextByPath", temp: false },
  { component: "Row", temp: false },
  { component: "Title", temp: false },
]

const quietly = (fn) => {
  const { warn } = console
  console.warn = (...args) => {
    if (!String(args[0]).startsWith("[baseline-browser-mapping]")) warn(...args)
  }
  try {
    return fn()
  } finally {
    console.warn = warn
  }
}

// ---------------------------------------------------------------------------
// Resolving what a wrap's `component={...}` is

const readsClassName = (fnPath) => {
  let reads = false
  fnPath.traverse({
    Identifier(p) {
      if (p.node.name === "className") {
        reads = true
        p.stop()
      }
    },
  })
  return reads
}

// `$[3]` where `$` is the React Compiler's memo cache (`const $ = _c(n)`,
// `c` imported from react/compiler-runtime): the right sides of every
// `$[3] = ...` in that function. Null for anything else.
const memoSlot = (valuePath) => {
  const n = valuePath.node
  if (
    n.type !== "MemberExpression" ||
    !n.computed ||
    n.object.type !== "Identifier" ||
    n.property.type !== "NumericLiteral"
  )
    return null
  const cache = valuePath.scope.getBinding(n.object.name)
  const init =
    cache && cache.path.isVariableDeclarator() && cache.path.node.init
  if (
    !init ||
    init.type !== "CallExpression" ||
    init.callee.type !== "Identifier"
  )
    return null
  const c = cache.path.scope.getBinding(init.callee.name)
  if (
    !c ||
    !c.path.isImportSpecifier() ||
    c.path.parent.source.value !== "react/compiler-runtime"
  )
    return null
  const stores = []
  cache.scope.path.traverse({
    AssignmentExpression(a) {
      const left = a.node.left
      if (
        left.type === "MemberExpression" &&
        left.computed &&
        left.object.type === "Identifier" &&
        a.scope.getBinding(left.object.name) === cache &&
        left.property.type === "NumericLiteral" &&
        left.property.value === n.property.value
      )
        stores.push(a.get("right"))
    },
  })
  return { stores }
}

// `() => Animated.Text` or `() => { return Animated.Text }`: the path of what
// it returns, or null.
const returned = (fnPath) => {
  const body = fnPath.get("body")
  if (!body.isBlockStatement()) return body
  const statements = body.get("body")
  return statements.length === 1 && statements[0].isReturnStatement()
    ? statements[0].get("argument")
    : null
}

// A call to an imported classNameSlot()/lazyClassNameSlot(): which one, the
// module it came from (annotate() checks that it is tappler-shared's) and the
// host the slot renders. Null for any other call.
const slotCall = (valuePath, depth) => {
  const { callee } = valuePath.node
  if (callee.type !== "Identifier") return null
  const binding = valuePath.scope.getBinding(callee.name)
  if (!binding || !binding.path.isImportSpecifier()) return null
  const imported =
    binding.path.node.imported.name || binding.path.node.imported.value
  if (!SLOT_FACTORIES.includes(imported)) return null
  const [arg] = valuePath.get("arguments")
  const hostPath =
    imported === "lazyClassNameSlot"
      ? arg && (arg.isArrowFunctionExpression() || arg.isFunctionExpression())
        ? returned(arg)
        : null
      : arg
  const readable =
    hostPath &&
    hostPath.node &&
    (hostPath.isIdentifier() || hostPath.isMemberExpression())
  return {
    factory: imported,
    slotSource: binding.path.parent.source.value,
    host: readable
      ? resolveComponent(hostPath.node, hostPath.scope, [], depth + 1)
      : {
          kind: "unknown",
          name: hostPath && hostPath.node ? hostPath.node.type : "nothing",
          chain: [],
        },
  }
}

// One value a variable can hold (its init, or the right side of an
// assignment to it).
const resolveValue = (valuePath, name, chain, depth) => {
  const value = valuePath.node
  if (value.type === "Identifier" || value.type === "MemberExpression")
    return resolveComponent(value, valuePath.scope, [...chain, name], depth + 1)
  // `const Wrapper = onPress ? TouchableOpacity : View` (DmView.tsx)
  if (
    value.type === "ConditionalExpression" ||
    value.type === "LogicalExpression"
  ) {
    const branches =
      value.type === "ConditionalExpression"
        ? [value.consequent, value.alternate]
        : [value.left, value.right]
    return {
      kind: "either",
      name,
      key: name,
      chain,
      options: branches.map((n) =>
        n.type === "Identifier" || n.type === "MemberExpression"
          ? resolveComponent(n, valuePath.scope, [], depth + 1)
          : { kind: "unknown", name: n.type, chain: [] }
      ),
    }
  }
  if (
    value.type === "ArrowFunctionExpression" ||
    value.type === "FunctionExpression"
  )
    return {
      kind: "local",
      name,
      key: name,
      chain,
      readsClassName: readsClassName(valuePath),
    }
  if (value.type === "CallExpression") {
    const { callee } = value
    const calleeName =
      callee.type === "Identifier"
        ? callee.name
        : callee.type === "MemberExpression" && !callee.computed
          ? callee.property.name
          : null
    // const Box = classNameSlot(DmView), lazyClassNameSlot(() => Animated.Text)
    const slot = slotCall(valuePath, depth)
    if (slot) return { kind: "slot", name, key: name, chain, ...slot }
    // React.memo(X), forwardRef((props, ref) => ...), createAnimatedComponent(X)
    if (COMPONENT_WRAPPERS.includes(calleeName)) {
      const fn = valuePath.get("arguments").find((a) => a.isFunction())
      if (fn)
        return {
          kind: "local",
          name,
          key: name,
          chain,
          readsClassName: readsClassName(fn),
        }
      const arg = value.arguments.find(
        (a) => a.type === "Identifier" || a.type === "MemberExpression"
      )
      if (arg) {
        const inner = resolveComponent(
          arg,
          valuePath.scope,
          [...chain, name],
          depth + 1
        )
        return { ...inner, wrappedBy: name }
      }
    }
    // Any other call: what it returns isn't knowable here.
    return {
      kind: "call",
      name,
      key: name,
      chain,
      callee: calleeName || "a function",
    }
  }
  return { kind: "local-expr", name, key: name, chain }
}

const resolveComponent = (expr, scope, chain = [], depth = 0) => {
  if (depth > 8) return { kind: "unknown", name: "?", chain }
  if (expr.type === "MemberExpression" && !expr.computed) {
    const members = []
    let o = expr
    while (o.type === "MemberExpression" && !o.computed) {
      members.unshift(o.property.name)
      o = o.object
    }
    if (o.type !== "Identifier") return { kind: "unknown", name: "?", chain }
    const root = resolveComponent(o, scope, chain, depth + 1)
    return {
      ...root,
      name: [root.name, ...members].join("."),
      key: members[members.length - 1],
    }
  }
  if (expr.type !== "Identifier")
    return { kind: "unknown", name: expr.type, chain }
  const binding = scope.getBinding(expr.name)
  if (!binding)
    return { kind: "global", name: expr.name, key: expr.name, chain }
  const p = binding.path
  if (
    p.isImportSpecifier() ||
    p.isImportDefaultSpecifier() ||
    p.isImportNamespaceSpecifier()
  ) {
    const source = p.parent.source.value
    const imported = p.isImportSpecifier()
      ? p.node.imported.name || p.node.imported.value
      : null
    // A default import is whatever the module is, whatever it's called
    // locally: `import DmTextByPath from ".../UI/DmText/DmText"` is DmText,
    // `import MainModal from "../MainModal"` (a folder) is MainModal.
    let key = imported || p.node.local.name
    if (p.isImportDefaultSpecifier() && isOurs(source)) {
      const base = path.basename(source).replace(/\.[jt]sx?$/, "")
      key = base === "index" ? path.basename(path.dirname(source)) : base
    }
    return {
      kind: "import",
      name: imported || p.node.local.name,
      key,
      local: p.node.local.name,
      source,
      chain,
    }
  }
  if (p.isFunctionDeclaration() || p.isClassDeclaration())
    return {
      kind: "local",
      name: expr.name,
      key: expr.name,
      chain,
      readsClassName: readsClassName(p),
    }
  if (p.isVariableDeclarator()) {
    if (p.node.id.type !== "Identifier")
      return { kind: "destructured", name: expr.name, key: expr.name, chain }
    // Every value the binding can hold: its init and each later assignment
    // (`let Label = DmView; if (big) Label = DmText`). They are resolved as
    // alternatives and the worst verdict wins, so one that can't be read
    // (`Label = pick()`, `Label += ...`) makes the tag "review", never "ok".
    const values = []
    if (p.node.init) values.push(p.get("init"))
    for (const v of binding.constantViolations) {
      const right =
        v.isAssignmentExpression({ operator: "=" }) &&
        v.get("left").isIdentifier({ name: expr.name })
          ? v.get("right")
          : null
      // The compiler caches its temporaries: `T0 = ActionBtn; $[3] = T0`
      // on a miss, `T0 = $[3]` on a hit. A read from the memo cache is
      // whatever was stored in that slot; a store of T0 itself adds nothing.
      const slot = right && memoSlot(right)
      if (slot)
        values.push(
          ...slot.stores.filter((s) => !s.isIdentifier({ name: expr.name }))
        )
      else values.push(right)
    }
    if (values.length === 0)
      return { kind: "local-expr", name: expr.name, key: expr.name, chain }
    const resolved = values.map((v) =>
      v
        ? resolveValue(v, expr.name, chain, depth)
        : { kind: "unknown", name: `${expr.name} (reassigned)`, chain: [] }
    )
    return resolved.length === 1
      ? resolved[0]
      : {
          kind: "either",
          name: expr.name,
          key: expr.name,
          chain,
          options: resolved,
        }
  }
  return { kind: p.node.type, name: expr.name, key: expr.name, chain }
}

const isOurs = (source) => source.startsWith(".") || source.startsWith("/")

// Third-party means the import really resolves into node_modules, from the
// file (or, for a tappler-shared file, which has none, from the app). Our
// own code reached through a bare specifier (@tappler/shared, an alias)
// isn't, and neither is anything that can't be resolved: "review", not "ok".
const thirdPartyCache = new Map()
const isThirdParty = (source, filename) => {
  if (isOurs(source) || source.startsWith("@tappler/")) return false
  const key = `${path.dirname(filename)}\0${source}`
  if (!thirdPartyCache.has(key)) {
    let answer
    try {
      const resolved = require.resolve(source, {
        paths: [path.dirname(filename), ROOT],
      })
      answer = /[\\/]node_modules[\\/]/.test(resolved)
    } catch (error) {
      // A package whose exports map has no require entry for this path.
      answer = error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED"
    }
    thirdPartyCache.set(key, answer)
  }
  return thirdPartyCache.get(key)
}

// The file an import of our own code names (relative, or @tappler/shared/...),
// symlinks resolved; null for a package or anything that isn't there.
const SOURCE_EXTS = [".ts", ".tsx", ".js", ".jsx"]
const ourFile = (source, filename) => {
  const shared = "@tappler/shared/"
  const base = isOurs(source)
    ? path.resolve(path.dirname(filename), source)
    : source.startsWith(shared)
      ? path.join(SHARED_SRC, "..", source.slice(shared.length))
      : null
  if (!base) return null
  const candidates = [
    base,
    ...SOURCE_EXTS.map((e) => base + e),
    ...SOURCE_EXTS.map((e) => path.join(base, `index${e}`)),
  ]
  const found = candidates.find((c) => {
    try {
      return fs.statSync(c).isFile()
    } catch {
      return false
    }
  })
  return found ? fs.realpathSync(found) : null
}

// Whether an import names tappler-shared's components/classNameSlots.ts
// itself: a module of the same name anywhere else isn't it.
const slotsCache = new Map()
const isSlotsModule = (source, filename) => {
  if (!source || !/(^|\/)classNameSlots(\.[jt]sx?)?$/.test(source)) return false
  const key = `${path.dirname(filename)}\0${source}`
  if (!slotsCache.has(key)) {
    let real = null
    try {
      real = fs.realpathSync(SLOTS_MODULE)
    } catch {
      // no shared checkout next to the app: nothing is that module
    }
    slotsCache.set(key, !!real && ourFile(source, filename) === real)
  }
  return slotsCache.get(key)
}

// Mark every import in a resolution (alternatives and slot hosts included)
// as ours or not, and as tappler-shared's slots module or not.
const annotate = (res, filename) => {
  if (res.kind === "import") {
    res.thirdParty = isThirdParty(res.source, filename)
    if (isSlotsModule(res.source, filename)) res.fromSlots = true
  }
  if (res.kind === "slot") {
    res.fromSlots = isSlotsModule(res.slotSource, filename)
    annotate(res.host, filename)
  }
  if (res.options) for (const o of res.options) annotate(o, filename)
  return res
}

// `res` is a resolveComponent() result or a wrap record built from one.
const classify = (res, consumers) => {
  const name = res.component || res.name
  if (res.kind === "either") {
    const verdicts = res.options.map((o) => classify(o, consumers))
    const worst = ["bug", "review", "ok"].find((s) =>
      verdicts.some((v) => v.status === s)
    )
    return {
      status: worst,
      reason: `one of ${res.options.map((o) => o.name).join(" / ")}: ${verdicts
        .map((v) => v.reason)
        .join("; ")}`,
    }
  }
  // A slot is there to be wrapped; what it hands the classes to decides.
  if (res.kind === "slot") {
    if (!res.fromSlots)
      return {
        status: "review",
        reason: `can't tell what ${name} is: it's what ${res.factory}() from ${res.slotSource} returns, and that isn't tappler-shared's components/classNameSlots`,
      }
    const { host } = res
    if (host.kind === "unknown")
      return {
        status: "review",
        reason: `className slot over a host the probe can't read (${host.name})`,
      }
    const verdict = classify(host, consumers)
    return {
      status: verdict.status,
      reason:
        verdict.status === "ok"
          ? `className slot over ${host.name}, wrapped on purpose: ${host.name} gets the component's base, then the caller's classes, as style; ${verdict.reason}`
          : `className slot over ${host.name}, which gets the caller's classes as style: ${verdict.reason}`,
    }
  }
  // A known consumer is the bug wherever it was imported from.
  if (consumers.includes(res.key))
    return {
      status: "bug",
      reason: `${res.key} reads its className; wrapped, it gets a style array and no className, so what it derives from className is lost`,
    }
  if (res.kind === "import" && res.thirdParty)
    return { status: "ok", reason: `third-party (${res.source}): reads style` }
  if (res.kind === "import" && FORWARDERS.includes(res.key))
    return { status: "ok", reason: `${res.key} forwards style` }
  if (
    res.kind === "import" &&
    res.fromSlots &&
    SLOT_COMPONENTS.includes(res.key) &&
    res.fontClassName === false
  )
    return {
      status: "review",
      reason: `${res.key} without fontClassName={the same classes as className}: a caller's font-customNNN and Arabic leading-[Npx] draw nothing`,
    }
  if (
    res.kind === "import" &&
    res.fromSlots &&
    SLOT_COMPONENTS.includes(res.key)
  )
    return {
      status: "ok",
      reason: `${res.key}, tappler-shared's text slot, wrapped on purpose: the design system Text gets the component's base, then the caller's classes, as style`,
    }
  if (res.kind === "local")
    return res.readsClassName
      ? {
          status: "bug",
          reason: `same-file component that reads className; wrapped, it gets style instead`,
        }
      : {
          status: "review",
          reason: "same-file component: gets style, not className",
        }
  return {
    status: "review",
    reason:
      res.kind === "import"
        ? `our component (${res.source}, not under node_modules): gets style instead of className; check it forwards style`
        : res.kind === "call"
          ? `can't tell what ${name} is: it's what ${res.callee}() returns`
          : `can't tell what ${name} is (${res.kind})`,
  }
}

// The source an expression was written as (its original text where it has
// one, else regenerated: the compiler may have made it).
let generate
const textOf = (node, code) => {
  if (node.start != null && node.end != null && code)
    return code.slice(node.start, node.end)
  if (!generate) generate = require("@babel/generator").default
  return generate(node).code
}

const squash = (s) => s.replace(/\s+/g, " ").trim()

/** A class attribute's classes as dead-at-e30b19a.json keys them (convert.js classesText). */
const classesOf = (attr, code) => {
  const v = attr.value
  if (!v) return ""
  if (v.type === "StringLiteral") return squash(v.value)
  return squash(textOf(v.type === "JSXExpressionContainer" ? v.expression : v, code))
}

/** A line of the source as written, trimmed. */
const lineAt = (code, line) => (code.split("\n")[line - 1] || "").trim()

// ---------------------------------------------------------------------------
// One file

let babel
const loadBabel = () => {
  if (!babel) babel = quietly(() => require("@babel/core"))
  return babel
}

const probePlugin = (sink) => () => ({
  name: "nw-wrap-probe",
  visitor: {
    Program: {
      enter(programPath, state) {
        programPath.scope.crawl()
        const compiled = programPath.node.body.some(
          (s) =>
            s.type === "ImportDeclaration" &&
            s.source.value === "react/compiler-runtime"
        )
        programPath.traverse({
          JSXOpeningElement(p) {
            const attrs = p.node.attributes.filter(
              (a) => a.type === "JSXAttribute"
            )
            const isWrap =
              p.node.name.type === "JSXIdentifier" &&
              p.node.name.name === "_StyledComponent"
            const cls = attrs.find(
              (a) => a.name.name === "className" || a.name.name === "tw"
            )
            if (!isWrap) {
              if (cls) sink.unwrapped++
              return
            }
            const comp = attrs.find((a) => a.name.name === "component")
            const res = annotate(
              resolveComponent(comp.value.expression, p.scope),
              state.filename
            )
            // ClassNameText reads the class string again as fontClassName
            // (S8): the same expression as className, or a font is lost.
            const font = attrs.find((a) => a.name.name === "fontClassName")
            const sourceOf = (attr) =>
              attr && attr.value && attr.value.type === "JSXExpressionContainer"
                ? textOf(attr.value.expression, state.file.code)
                : attr && attr.value
                  ? textOf(attr.value, state.file.code)
                  : null
            const fontClassName =
              !!cls &&
              sourceOf(font) !== null &&
              sourceOf(font) === sourceOf(cls)
            const loc = (cls && cls.loc) || p.node.loc
            sink.wraps.push({
              line: loc ? loc.start.line : null,
              // what pins a review wrap to e30b19a's (KNOWN_REVIEWS)
              classes: cls ? classesOf(cls, state.file.code) : null,
              lineText: loc ? lineAt(state.file.code, loc.start.line) : null,
              component: res.name,
              key: res.key,
              via: res.chain,
              temp: compiled && res.chain.some((n) => /^T\d+$/.test(n)),
              kind: res.kind,
              source: res.source || null,
              thirdParty: res.thirdParty,
              callee: res.callee,
              wrappedBy: res.wrappedBy || null,
              readsClassName: res.readsClassName,
              options: res.options,
              fontClassName,
              factory: res.factory,
              slotSource: res.slotSource,
              host: res.host,
              fromSlots: res.fromSlots,
              className:
                cls && cls.value && cls.value.type === "StringLiteral"
                  ? cls.value.value
                  : null,
            })
          },
        })
      },
    },
  },
})

// The same test nativewind/dist/babel/index.js:56-63 applies before it does
// anything to a file.
let contentGlobs
const inTailwindContent = (filename) => {
  if (!contentGlobs) {
    // eslint-disable-next-line import/no-dynamic-require
    const { content } = require(path.join(ROOT, "tailwind.config.js"))
    const files = Array.isArray(content) ? content : content.files
    contentGlobs = files
      .filter((f) => typeof f === "string")
      .map((f) => path.resolve(ROOT, f).split(path.sep).join("/"))
  }
  const micromatch = require("micromatch")
  return micromatch.isMatch(filename.split(path.sep).join("/"), contentGlobs)
}

const probeFile = (
  file,
  { as, platform = "ios", consumers = CONSUMERS } = {}
) => {
  // NativeWind's block list asks `createRequire(file).resolve(import)`.
  // Plain Node (Metro's workers) can't resolve an extensionless .tsx path, so
  // a file-path import is "a node module" and gets wrapped. jest swaps in its
  // own createRequire, which finds .tsx, so the same import is blocked there
  // and the probe would report a wrap Metro makes as clean.
  if (process.env.JEST_WORKER_ID !== undefined)
    throw new Error(
      "nw-wrap-probe: run it in its own node process (the CLI), not inside jest: jest's module resolver changes what NativeWind wraps"
    )
  const b = loadBabel()
  const filename = path.resolve(as || file)
  if (!inTailwindContent(filename))
    return {
      file,
      filename,
      wraps: [],
      unwrapped: 0,
      counts: { wraps: 0, temps: 0, bug: 0, review: 0 },
      note: "outside tailwind content: NativeWind never touches this file, so 0 wraps here proves nothing",
    }
  const code = fs.readFileSync(file, "utf8")
  const sink = { wraps: [], unwrapped: 0 }
  const caller = { name: "metro", bundler: "metro", platform }
  const partial = quietly(() =>
    b.loadPartialConfig({
      filename,
      cwd: ROOT,
      root: ROOT,
      configFile: path.join(ROOT, "babel.config.js"),
      babelrc: false,
      caller,
    })
  )
  const { options } = partial
  const at = options.plugins.findIndex(
    (p) => p.file && /[\\/]nativewind[\\/]/.test(p.file.resolved)
  )
  if (at < 0)
    return { file, filename, error: "babel.config.js has no nativewind/babel" }
  options.plugins.splice(at + 1, 0, b.createConfigItem(probePlugin(sink)))
  let out
  try {
    out = quietly(() => b.transformSync(code, { ...options, filename, caller }))
  } catch (error) {
    return { file, filename, error: error.message.split("\n")[0] }
  }
  const finalRefs = (out.code.match(/\.StyledComponent\b/g) || []).length
  // Source order: compiled code builds inner elements before outer ones.
  const wraps = sink.wraps
    .map((w) => ({ ...w, ...classify(w, consumers) }))
    .sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity))
  const result = {
    file,
    filename,
    wraps,
    unwrapped: sink.unwrapped,
    counts: {
      wraps: wraps.length,
      temps: wraps.filter((w) => w.temp).length,
      bug: wraps.filter((w) => w.status === "bug").length,
      review: wraps.filter((w) => w.status === "review").length,
    },
  }
  if (finalRefs !== wraps.length)
    result.error = `probe saw ${wraps.length} wraps but the built file references StyledComponent ${finalRefs} times`
  return result
}

const runControl = (opts = {}) => {
  const r = probeFile(CONTROL, {
    ...opts,
    as: path.join(VIRTUAL_DIR, path.basename(CONTROL)),
  })
  const got = (r.wraps || []).map((w) => ({
    component: w.component,
    temp: w.temp,
    status: w.status,
  }))
  const ok =
    !r.error &&
    got.length === CONTROL_EXPECT.length &&
    CONTROL_EXPECT.every(
      (e, i) =>
        got[i].component === e.component &&
        got[i].temp === e.temp &&
        got[i].status === "bug"
    )
  return { ok, result: r, expected: CONTROL_EXPECT, got }
}

// ---------------------------------------------------------------------------
// CLI

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory())
      return e.name === "node_modules" || e.name === "__tests__"
        ? []
        : walk(full)
    return /\.(tsx|jsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [full] : []
  })

const rel = (file) => path.relative(ROOT, path.resolve(file))

// The review wraps known at e30b19a: each frozen row, by file, component,
// classes and the text of its className line there. A count per file and
// component let a class moved to another SkeletonLoader pass, and, once W1
// deletes the twelve, a new dead one (review-ca-w0, the T re-check's L3).
const KNOWN_REVIEWS = Object.freeze(
  // eslint-disable-next-line global-require
  require("./ds-codemod/dead-at-e30b19a.json").sites.map((d) =>
    Object.freeze({
      file: d.file,
      component: d.component,
      classes: d.classes,
      text: d.e30b19aText,
    })
  )
)

/** The review wraps that aren't a known one (each known row taken once), in order. */
const unknownReviews = (results, known = KNOWN_REVIEWS) => {
  const left = [...known]
  const out = []
  for (const r of results)
    for (const w of r.wraps || []) {
      if (w.status !== "review") continue
      const file = rel(r.file)
      const at = left.findIndex(
        (k) =>
          k.file === file &&
          k.component === w.component &&
          k.classes === w.classes &&
          k.text === w.lineText
      )
      if (at >= 0) left.splice(at, 1)
      else out.push({ file, line: w.line, component: w.component })
    }
  return out
}

const formatFile = (r, quiet) => {
  const lines = []
  if (r.error) lines.push(`${rel(r.file)}: ERROR ${r.error}`)
  const shown = quiet ? r.wraps.filter((w) => w.status !== "ok") : r.wraps
  if (!r.error && quiet && shown.length === 0) return ""
  if (!r.error)
    lines.push(
      `${rel(r.file)}: ${r.counts.wraps} wrap${r.counts.wraps === 1 ? "" : "s"}` +
        (r.counts.temps
          ? ` (${r.counts.temps} through a compiler temporary)`
          : "") +
        (r.counts.bug ? `, ${r.counts.bug} BUG` : "") +
        (r.counts.review ? `, ${r.counts.review} to review` : "")
    )
  for (const w of shown) {
    const label =
      w.status === "bug"
        ? "BUG   "
        : w.status === "review"
          ? "review"
          : "ok    "
    const via = w.via.length ? ` via ${w.via.join(" -> ")}` : ""
    const temp = w.temp ? " [compiler temporary]" : ""
    lines.push(
      `  ${label} :${w.line ?? "?"}  <${w.component}>${via}${temp}  ${w.reason}`
    )
  }
  return lines.join("\n")
}

const USAGE = `usage: yarn ds:probe [file or dir ...] [--json] [--quiet] [--consumer Name ...] [--platform ios|android]

  no paths   src/ and ../tappler-shared/src
  --quiet    list only BUG and review wraps
  --consumer one more className-consuming component name (repeatable)
  --as PATH  probe the one given file as if it lived at PATH (fixtures)`

const main = (argv) => {
  const paths = []
  const opts = {
    json: false,
    quiet: false,
    consumers: [...CONSUMERS],
    platform: "ios",
    as: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--json") opts.json = true
    else if (a === "--quiet") opts.quiet = true
    else if (a === "--consumer") opts.consumers.push(argv[++i])
    else if (a === "--platform") opts.platform = argv[++i]
    else if (a === "--as") opts.as = path.resolve(argv[++i])
    else if (a === "--help" || a === "-h") {
      console.log(USAGE)
      return 0
    } else if (a.startsWith("--")) {
      console.error(`nw-wrap-probe: unknown option ${a}\n${USAGE}`)
      return 2
    } else paths.push(path.resolve(a))
  }
  if (!["ios", "android"].includes(opts.platform)) {
    console.error(`nw-wrap-probe: --platform must be ios or android\n${USAGE}`)
    return 2
  }
  if (opts.as && paths.length !== 1) {
    console.error(`nw-wrap-probe: --as takes exactly one file\n${USAGE}`)
    return 2
  }
  const probeOpts = { platform: opts.platform, consumers: opts.consumers }

  const control = runControl(probeOpts)
  if (!control.ok) {
    console.error(
      "nw-wrap-probe: the positive control was not flagged as expected, so nothing this probe says can be trusted.\n" +
        `  expected: ${JSON.stringify(control.expected)}\n  got:      ${JSON.stringify(control.got)}` +
        (control.result.error ? `\n  error: ${control.result.error}` : "")
    )
    return 1
  }

  const roots = paths.length
    ? paths
    : [path.join(ROOT, "src"), SHARED_SRC].filter((p) => fs.existsSync(p))
  const files = []
  for (const p of roots) {
    if (!fs.existsSync(p)) {
      console.error(`nw-wrap-probe: no such file or directory: ${p}`)
      return 2
    }
    if (fs.statSync(p).isDirectory()) files.push(...walk(p))
    else files.push(p)
  }
  const results = files.map((f) => probeFile(f, { ...probeOpts, as: opts.as }))
  const totals = results.reduce(
    (t, r) => {
      if (r.error) t.errors++
      if (r.counts) {
        t.wraps += r.counts.wraps
        t.temps += r.counts.temps
        t.bug += r.counts.bug
        t.review += r.counts.review
      }
      t.unwrapped += r.unwrapped || 0
      return t
    },
    {
      files: results.length,
      wraps: 0,
      temps: 0,
      bug: 0,
      review: 0,
      unwrapped: 0,
      errors: 0,
    }
  )
  const unknown = unknownReviews(results)
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          control: { ok: true, wraps: control.got },
          totals,
          unknownReviews: unknown,
          files: results.map((r) => ({
            ...r,
            file: rel(r.file),
            filename: undefined,
          })),
        },
        null,
        2
      )
    )
  } else {
    const blocks = results
      .filter((r) => r.error || r.note || (r.wraps && r.wraps.length))
      .map((r) =>
        r.note ? `${rel(r.file)}: ${r.note}` : formatFile(r, opts.quiet)
      )
      .filter(Boolean)
    if (blocks.length) console.log(blocks.join("\n"))
    console.log(
      `\nnw-wrap-probe: positive control flagged (${control.got.length} of ${CONTROL_EXPECT.length})\n` +
        `${totals.files} files, ${totals.wraps} wraps (${totals.temps} through a compiler temporary), ` +
        `${totals.unwrapped} className elements passed through unwrapped: ` +
        `${totals.bug} BUG, ${totals.review} to review` +
        (unknown.length
          ? ` (${unknown.length} beyond the twelve known at e30b19a)`
          : totals.review
            ? " (known at e30b19a)"
            : "") +
        (totals.errors ? `, ${totals.errors} files failed` : "")
    )
    for (const u of unknown)
      console.log(
        `  NEW REVIEW ${u.file}:${u.line} <${u.component}>: not one of the twelve at e30b19a (ds-codemod/dead-at-e30b19a.json); look at it`
      )
  }
  if (totals.errors) return 2
  return totals.bug || unknown.length ? 1 : 0
}

module.exports = {
  probeFile,
  runControl,
  classify,
  KNOWN_REVIEWS,
  unknownReviews,
  CONSUMERS,
  FORWARDERS,
  CONTROL,
  CONTROL_EXPECT,
  VIRTUAL_DIR,
  SLOTS_MODULE,
  main,
}

if (require.main === module) process.exitCode = main(process.argv.slice(2))
