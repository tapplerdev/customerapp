/**
 * Style twins. tappler-shared's components style themselves with styles now,
 * and right after each class prop they declare what replaces it
 * (build-shared-components.md): a style twin, `StyleProp<...>`, applied after
 * the classes so it wins where they would have, and for a text a typography
 * twin, `TextType` (or a field's `FieldType`). The codemod reads the twins
 * off the props type, in declaration order, so renaming a twin in the
 * component needs no change here.
 *
 * What the order can't say lives in three tables, one line per prop:
 * - PARSED: a token the component reads out of a class string itself, and
 *   the prop that carries it now (MainModal copies the card's rounded-NN to
 *   its wrapper: `radius`; DmInput places its raised label from h-[n]:
 *   `height`; JobLocationMap's height class: `height`). `tokens` names the
 *   ds table whose values the prop takes as they are (anything else is
 *   px(n)); `consume` takes the key out of the style twin, which refuses it.
 * - TWIN_NAMES: a twin the order doesn't give (none today).
 * - TWIN_RENAMES: a twin a call site already passes under an old name, and
 *   the new one (MainModal's styleHightWrapper is wrapperStyle now, drawn in
 *   the same place when only one is given).
 * All are keyed by the shared component's file name. And one for the app's
 * own components:
 * - HAND_EDITS: a class string a component draws as a typed prop the codemod
 *   can't prove from the classes (proapp's MyServiceDetailItem's white badge
 *   drew `classNameBtn="border-red"` as `btnHairline="brand"`, shown by its
 *   own parity test): the site is left, and its reason says the edit.
 *
 * And what a twin refuses: the keys its type bans (`NoShorthands`,
 * `NoFieldTypography`, `{ height?: never }`...), read from the type text and
 * tappler-shared's classStyles.ts, so a class that would land one there is
 * left rather than written into a type error.
 */
const path = require("path")

const CLASS_ATTR = /^className|ClassName$/

const PARSED = {
  MainModal: {
    className: [
      {
        prop: "radius",
        match: /rounded-\d\d/,
        key: "borderTopLeftRadius",
        tokens: "radius",
      },
    ],
  },
  DmInput: {
    className: [
      { prop: "height", match: /h-\[(\d+)\]/, key: "height", consume: true },
    ],
  },
  JobLocationMap: {
    heightClassName: [{ prop: "height", key: "height", whole: true }],
  },
}

const TWIN_NAMES = {}

const TWIN_RENAMES = {
  MainModal: { styleHightWrapper: "wrapperStyle" },
}

// By component file name, then class prop: the whole class string (as
// written, spaces aside), the literal props the site must also pass, and the
// edit (review-w2a-0.md S2). proapp's one entry was its MyServiceDetailItem's
// white badge; customerapp has none yet (W1 adds one where a component draws
// a class string a twin can't say).
const HAND_EDITS = {}

// Fields whose input and placeholder classes both write one FieldType
// (typetwin.js convertFields): the type prop, and the two class props.
const FIELDS = {
  DmInput: {
    typeProp: "inputType",
    field: "inputClassName",
    placeholder: "classNamePlaceholder",
  },
  DmAuthInput: {
    typeProp: "inputType",
    field: "inputClassName",
    placeholder: "placeholderClassName",
  },
}

/**
 * { style, styleType, type, parsed } for a class prop: the first StyleProp
 * member declared after it, and the first TextType / FieldType one, before
 * the next class prop. Null when there is no style twin and nothing parsed.
 */
const twinsOf = (members, attr, component) => {
  const named = TWIN_NAMES[component] && TWIN_NAMES[component][attr]
  const keys = [...members.own.keys()]
  const at = keys.indexOf(attr)
  if (at < 0) return null
  let style = named || null
  let type = null
  for (const key of keys.slice(at + 1)) {
    if (CLASS_ATTR.test(key)) break
    const t = members.own.get(key) || ""
    if (!style && /StyleProp</.test(t)) style = key
    if (!type && /\b(TextType|FieldType)\b/.test(t)) type = key
  }
  const parsed = (PARSED[component] && PARSED[component][attr]) || []
  if (!style && parsed.length === 0) return null
  return {
    style,
    styleType: style ? members.own.get(style) || "" : "",
    type,
    parsed,
  }
}

// ---------------------------------------------------------------------------
// The keys a twin's type refuses

let aliases
/**
 * classStyles.ts's type aliases, each as the keys it bans: a union of string
 * literals (Shorthand), an object of `?: never` members, a mapped type over
 * a union (`{ [K in Shorthand]?: never }`), an intersection of those.
 */
const classStyleAliases = () => {
  if (aliases) return aliases
  // eslint-disable-next-line global-require
  const { SHARED, parseFile } = require("./modules")
  const file = path.join(SHARED, "src", "components", "classStyles.ts")
  const { ast } = parseFile(file)
  const decls = new Map()
  for (const stmt of ast.program.body) {
    const d =
      stmt.type === "ExportNamedDeclaration" && stmt.declaration
        ? stmt.declaration
        : stmt
    if (d.type === "TSTypeAliasDeclaration")
      decls.set(d.id.name, d.typeAnnotation)
  }
  aliases = new Map()
  const keysOf = (node, seen = new Set()) => {
    if (!node) return []
    switch (node.type) {
      case "TSUnionType":
        return node.types.flatMap((t) => keysOf(t, seen))
      case "TSLiteralType":
        return node.literal.type === "StringLiteral" ? [node.literal.value] : []
      case "TSIntersectionType":
        return node.types.flatMap((t) => keysOf(t, seen))
      case "TSTypeLiteral":
        return node.members
          .filter(
            (m) =>
              m.type === "TSPropertySignature" &&
              m.typeAnnotation &&
              m.typeAnnotation.typeAnnotation.type === "TSNeverKeyword"
          )
          .map((m) => (m.key.type === "Identifier" ? m.key.name : m.key.value))
      case "TSMappedType": {
        // { [K in Shorthand]?: never }
        const constraint = node.typeParameter
          ? node.typeParameter.constraint
          : node.constraint
        return node.typeAnnotation &&
          node.typeAnnotation.type === "TSNeverKeyword"
          ? keysOf(constraint, seen)
          : []
      }
      case "TSTypeReference": {
        const name = node.typeName.name
        if (!decls.has(name) || seen.has(name)) return []
        seen.add(name)
        return keysOf(decls.get(name), seen)
      }
      default:
        return []
    }
  }
  for (const [name, node] of decls) aliases.set(name, new Set(keysOf(node)))
  return aliases
}

/** The keys a twin's type text bans: its classStyles aliases and `{ k?: never }`s. */
const bannedKeys = (typeText) => {
  const out = new Set()
  if (!typeText) return out
  for (const [name, keys] of classStyleAliases())
    if (keys.size && new RegExp(`\\b${name}\\b`).test(typeText))
      for (const k of keys) out.add(k)
  for (const m of typeText.matchAll(/\b(\w+)\?\s*:\s*never\b/g)) out.add(m[1])
  return out
}

module.exports = {
  FIELDS,
  HAND_EDITS,
  PARSED,
  TWIN_NAMES,
  TWIN_RENAMES,
  bannedKeys,
  twinsOf,
}
