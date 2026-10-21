/**
 * Before any parity result means anything: NativeWind really styles the
 * shared components in this run (a worktree whose tappler-shared resolves
 * outside tailwind `content` renders them unstyled, and two unstyled trees
 * compare equal).
 */
const React = require("react")
const { renderTree } = require("./render")

// Read through globalThis: babel here (react-native-dotenv) inlines a
// literal `process.env.NAME` at transform time, and jest caches the result.
const ENV = globalThis.process.env

const find = (node, type) => {
  if (!node || typeof node === "string") return null
  if (node.type === type) return node
  for (const c of node.children || []) {
    const hit = find(c, type)
    if (hit) return hit
  }
  return null
}

describe("the parity run's NativeWind", () => {
  it.each(["en", "ar"])(
    "styles a DmText from its className (%s)",
    async (lang) => {
      const {
        SanityText,
      } = require("../../__fixtures__/ds-codemod/sanity/Sanity")
      const tree = await renderTree(React.createElement(SanityText), lang)
      const text = find(tree, "Text")
      expect(text.props.style.fontSize).toBe(20)
      expect(text.props.style.lineHeight).toBe(lang === "ar" ? 24 * 1.32 : 24)
      expect(text.props.style.fontFamily).toBe(
        lang === "ar" ? "TheSans-Bold" : "Poppins-Bold"
      )
    }
  )

  it("styles a DmView from its className", async () => {
    const {
      SanityView,
    } = require("../../__fixtures__/ds-codemod/sanity/Sanity")
    const tree = await renderTree(React.createElement(SanityView), "en")
    const view = find(tree, "View")
    expect(view.props.style).toEqual({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: "0%",
      paddingLeft: 20,
      paddingRight: 20,
    })
  })

  it("runs on the platform it was asked for", () => {
    const { Platform } = require("react-native")
    expect(Platform.OS).toBe(ENV.DS_PARITY_PLATFORM || "ios")
  })
})
