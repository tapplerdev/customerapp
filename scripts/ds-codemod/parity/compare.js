/**
 * Comparing two flattened host trees (plain data, so the runner can use it
 * outside jest).
 */
const { loadDs } = require("../dsload")

const sortedEntries = (style) =>
  JSON.stringify(Object.entries(style || {}).sort())

/**
 * A ds Button's root as a host tree shows it: among its children (an icon on
 * either side at most) Button's label box (LABEL_BOX, read from
 * tappler-shared; `labelInset` may change its side margins), or the spinner
 * while it loads. ActionBtn's root has no such box.
 */
const isLabelBox = (k) => {
  if (!k || typeof k !== "object" || k.type !== "View") return false
  const { marginLeft, marginRight, ...rest } = k.props.style || {}
  const {
    marginLeft: l,
    marginRight: r,
    ...box
  } = loadDs().buttonStyles.LABEL_BOX
  return (
    marginLeft === marginRight && sortedEntries(rest) === sortedEntries(box)
  )
}
const isButtonRoot = (node) => {
  const kids = [].concat(node.children || [])
  if (kids.length === 0 || kids.length > 3) return false
  if (kids.length === 1 && kids[0] && kids[0].type === "ActivityIndicator")
    return true
  return kids.some(isLabelBox)
}

/**
 * Differences between two host trees: [{ path, a, b }]. `allow(path, a, b)`
 * may accept a listed difference (Button's minHeight for ActionBtn's
 * height) by returning its label.
 */
const diffTrees = (a, b, allow = () => null, at = "root") => {
  const out = []
  const accepted = []
  const walk = (x, y, p) => {
    if (
      typeof x === "string" ||
      typeof y === "string" ||
      x === null ||
      y === null
    ) {
      if (x !== y) out.push({ path: p, a: x, b: y })
      return
    }
    if (Array.isArray(x) || Array.isArray(y)) {
      const xs = Array.isArray(x) ? x : [x]
      const ys = Array.isArray(y) ? y : [y]
      if (xs.length !== ys.length)
        out.push({ path: `${p}.length`, a: xs.length, b: ys.length })
      for (let i = 0; i < Math.min(xs.length, ys.length); i++)
        walk(xs[i], ys[i], `${p}[${i}]`)
      return
    }
    if (x.type !== y.type) {
      out.push({ path: `${p}.type`, a: x.type, b: y.type })
      return
    }
    const here = `${p}<${x.type}>`
    const label = allow(x, y)
    const xp = label ? label.a : x.props
    const yp = label ? label.b : y.props
    if (label) accepted.push({ path: here, what: label.what })
    for (const key of new Set([...Object.keys(xp), ...Object.keys(yp)])) {
      const xv = JSON.stringify(xp[key])
      const yv = JSON.stringify(yp[key])
      if (key === "style") {
        const xs = xp.style || {}
        const ys = yp.style || {}
        for (const k of new Set([...Object.keys(xs), ...Object.keys(ys)]))
          if (JSON.stringify(xs[k]) !== JSON.stringify(ys[k]))
            out.push({ path: `${here}.style.${k}`, a: xs[k], b: ys[k] })
      } else if (xv !== yv)
        out.push({ path: `${here}.${key}`, a: xp[key], b: yp[key] })
    }
    walk(x.children, y.children, here)
  }
  walk(a, b, at)
  return { diffs: out, accepted }
}

/**
 * The one listed pass-1 difference: Button sets minHeight where ActionBtn
 * set height. Accepted only on a Button's root (the converted side's node
 * holds Button's label box) whose style has `height` before and the same
 * `minHeight` (and no height) after, every other key equal. Anywhere else a
 * height turned minHeight is a difference.
 */
const buttonHeight = (x, y) => {
  if (!isButtonRoot(y)) return null
  const xs = x.props.style
  const ys = y.props.style
  if (!xs || !ys || xs.height === undefined || ys.minHeight === undefined)
    return null
  if (
    ys.height !== undefined ||
    xs.minHeight !== undefined ||
    xs.height !== ys.minHeight
  )
    return null
  const { height, ...xRest } = xs
  const { minHeight, ...yRest } = ys
  if (
    JSON.stringify(Object.entries(xRest).sort()) !==
    JSON.stringify(Object.entries(yRest).sort())
  )
    return null
  return {
    what: `height ${height} -> minHeight ${minHeight} (Button)`,
    a: { ...x.props, style: { ...xRest, minHeight: height } },
    b: { ...y.props, style: ys },
  }
}

/**
 * ActionBtn without an onPress draws a View that still carries `disabled`
 * (DmView hands it on); Button's View doesn't. A View has no such prop and
 * native ignores it: the second listed delta (build-p2b.md, Button.test).
 */
const disabledView = (x, y) => {
  if (x.type !== "View" || y.type !== "View") return null
  if (!("disabled" in x.props) || "disabled" in y.props) return null
  const { disabled, ...rest } = x.props
  return {
    what: `disabled=${disabled} on a View (ActionBtn without onPress)`,
    a: rest,
    b: y.props,
  }
}

/** The pass-1 deltas a Button conversion is allowed, both draw nothing different. */
const allowButtonHeight = (x, y) => {
  const d = disabledView(x, y)
  const xx = d ? { ...x, props: d.a } : x
  const h = buttonHeight(xx, y)
  if (!d && !h) return null
  return {
    what: [d && d.what, h && h.what].filter(Boolean).join("; "),
    a: h ? h.a : xx.props,
    b: h ? h.b : y.props,
  }
}

module.exports = { allowButtonHeight, diffTrees, isButtonRoot }
