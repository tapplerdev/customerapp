/**
 * The lint warnings on a ratchet. .eslintrc.js warns on each of these, and
 * `yarn lint:ratchet` (scripts/lint-ratchet.js, run in CI) fails when a
 * count rises above scripts/lint-ratchet-baseline.json. Each count can only
 * go down. Known gaps: an aliased Alert (`A.alert`), `require(...).Alert`,
 * and colours built in template literals.
 */
const COLOUR =
  "No colour literals in .tsx. Use a ds colour token (color.* from " +
  "@tappler/shared/src/ds, or <Text color>), and add one to ds/colors.ts " +
  "if it's missing."

const ratcheted = [
  {
    key: "alert",
    selector:
      "CallExpression[callee.object.name='Alert'][callee.property.name='alert']",
    message:
      "Alert.alert is only for a permission denial, through openPermissionAlert. " +
      "Show a request failure with ErrorModal.",
  },
  {
    key: "dsColorsImport",
    selector: "ImportDeclaration[source.value=/dsColors$/]",
    message:
      "No new dsColors imports. Use the ds colours: color.* from " +
      "@tappler/shared/src/ds, or <Text color>.",
  },
  {
    key: "colourLiteral",
    selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
    message: COLOUR,
    tsxOnly: true,
  },
  {
    key: "colourLiteral",
    selector: "Literal[value=/^rgba?\\(/]",
    message: COLOUR,
    tsxOnly: true,
  },
]

// The no-restricted-syntax entries for a kind of file: the .tsx-only ones
// only for .tsx, and without the keys in `except`.
const selectorsFor = ({ tsx, except = [] }) =>
  ratcheted
    .filter((r) => (tsx || !r.tsxOnly) && !except.includes(r.key))
    .map(({ selector, message }) => ({ selector, message }))

module.exports = { ratcheted, selectorsFor }
