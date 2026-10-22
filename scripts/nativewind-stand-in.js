/**
 * A stand-in for `nativewind/babel`, for the checks that prove they can see
 * the plugin come back (W4: the package left node_modules, so a control can't
 * put the real one back).
 *
 * `plugin` is the absolute path of a Babel plugin that sits in a
 * `nativewind` folder of a temp directory, so what Babel reports for it
 * names nativewind, as it did for the real one. What the plugin does to a
 * file is what the real one did to one with a class, as far as the checks
 * read it: it loads `nativewind`, wraps each JSX element that carries a
 * `className` in `StyledComponent`, and registers a stylesheet with
 * `NativeWindStyleSheet.create` (it runs as the program is entered, before
 * the preset's JSX transform, as the real one did). The temp directory is made once per process
 * and removed when it exits.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nativewind-stand-in-"))
const folder = path.join(dir, "node_modules", "nativewind")
fs.mkdirSync(folder, { recursive: true })
const plugin = path.join(folder, "babel.js")
fs.writeFileSync(
  plugin,
  `
module.exports = function nativewindStandIn(api) {
  return {
    visitor: {
      Program: {
        enter(program) {
          let wrapped = false
          program.traverse({
            JSXOpeningElement(element) {
              const hasClass = element.node.attributes.some(
                (attribute) =>
                  attribute.name && attribute.name.name === "className"
              )
              if (hasClass) wrapped = true
            },
          })
          if (!wrapped) return
          const source = [
            'var _nativewind = require("nativewind");',
            "_nativewind.StyledComponent;",
            "_nativewind.NativeWindStyleSheet.create({});",
          ].join(" ")
          program.unshiftContainer("body", api.template.ast(source))
        },
      },
    },
  }
}
`
)
process.on("exit", () => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // a leftover temp directory is harmless
  }
})

module.exports = { plugin }
