/**
 * run-real's --sweep verdict, as plain data: the files the codemod changes,
 * each drawn with no props before and after converting (real.parity.js),
 * per platform and language.
 *
 * A row is what one draw gave:
 *   { lang, tree }                 it drew
 *   { lang, kind: "render", error } it threw while drawing: most often a
 *                                  prop it needs, so both sides throwing is
 *                                  counted (needProps), not compared
 *   { kind: "load", error }        the file didn't even import (an ESM
 *                                  package this config doesn't transform, a
 *                                  native module with no mock): nothing in it
 *                                  was checked
 *   { kind: "export", error }      it has no default component to draw
 * A load failure or a file with no component is never "needs props": each
 * fails the run unless sweep-gaps.js lists it, with its cause (a render
 * failure the list names is a known gap too, not needProps). A listed gap
 * that no longer happens fails as well, so the list stays true.
 */

const kindOf = (rows) => {
  const first = rows[0] || {}
  if (first.kind === "load" || /^import: /.test(first.error || ""))
    return "load"
  if (first.kind === "export" || first.error === "no component export")
    return "export"
  return "draw"
}

const sweepVerdict = ({
  files,
  before,
  after,
  gaps = [],
  diffTrees,
  allow,
}) => {
  const v = {
    files: files.length,
    drawn: 0,
    equal: 0,
    accepted: 0,
    needProps: 0,
    loadFailures: [],
    noComponent: [],
    gaps: [],
    stale: [],
    problems: [],
  }
  const hit = new Map() // gap -> the platforms it happened on
  const listed = (file, kind, error) =>
    gaps.find(
      (g) => g.file === file && g.kind === kind && g.match.test(error || "")
    )
  const noted = (gap, platform) => {
    const platforms = hit.get(gap) || []
    if (!platforms.includes(platform)) hit.set(gap, [...platforms, platform])
  }
  const noComponent = new Set()
  for (const platform of Object.keys(before)) {
    for (const file of files) {
      const xs = before[platform][file] || []
      const ys = (after[platform] || {})[file] || []
      if (xs.length === 0 || ys.length === 0) {
        v.problems.push({ file, platform, problem: "no result" })
        continue
      }
      const kx = kindOf(xs)
      const ky = kindOf(ys)
      if (kx !== "draw" || ky !== "draw") {
        if (kx !== ky) {
          v.problems.push({
            file,
            platform,
            problem:
              kx === "draw"
                ? `${ky === "load" ? "loads" : "has a component"} before, not after`
                : `${kx === "load" ? "loads" : "has a component"} after, not before`,
            before: xs[0].error || "drew",
            after: ys[0].error || "drew",
          })
          continue
        }
        const gap = listed(file, kx, xs[0].error)
        if (gap) noted(gap, platform)
        else if (kx === "load")
          v.loadFailures.push({ file, platform, error: xs[0].error })
        else noComponent.add(file)
        continue
      }
      xs.forEach((x, i) => {
        const y = ys[i] || {}
        if (x.error && y.error) {
          const gap = listed(file, "render", x.error)
          if (gap) noted(gap, platform)
          else v.needProps++
          return
        }
        if (x.error || y.error) {
          v.problems.push({
            file,
            platform,
            lang: x.lang,
            before: x.error || "drew",
            after: y.error || "drew",
          })
          return
        }
        v.drawn++
        const d = diffTrees(x.tree, y.tree, allow)
        v.accepted += d.accepted.length
        if (d.diffs.length)
          v.problems.push({
            file,
            platform,
            lang: x.lang,
            diffs: d.diffs.slice(0, 4),
          })
        else v.equal++
      })
    }
  }
  // (A gap in a file the codemod no longer changes is out of the sweep.)
  for (const gap of gaps) {
    if (!files.includes(gap.file)) continue
    const platforms = hit.get(gap) || []
    if (platforms.length)
      v.gaps.push({
        file: gap.file,
        kind: gap.kind,
        cause: gap.cause,
        platforms,
      })
    else v.stale.push(gap.file)
  }
  v.noComponent = [...noComponent]
  v.ok =
    v.problems.length === 0 &&
    v.loadFailures.length === 0 &&
    v.noComponent.length === 0 &&
    v.stale.length === 0
  return v
}

module.exports = { sweepVerdict, kindOf }
