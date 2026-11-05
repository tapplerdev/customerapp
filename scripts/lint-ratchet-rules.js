/**
 * The lint warnings on a ratchet. .eslintrc.js warns on each of these, and
 * `yarn lint:ratchet` (scripts/lint-ratchet.js, run in CI) fails when a
 * count rises above scripts/lint-ratchet-baseline.json. Each count can only
 * go down. Known gap: colours built in template literals. (Alert was on the
 * ratchet until it reached 0; it is an import ban at error now, in
 * .eslintrc.js.)
 */
const COLOUR =
  "No colour literals in .tsx. Use a ds colour token (color.* from " +
  "@tappler/shared/src/ds, or <Text color>), and add one to ds/colors.ts " +
  "if it's missing."

const ratcheted = [
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

/*
 * Bans held at 0: errors in .eslintrc.js that `yarn lint:ratchet` counts too,
 * so CI fails on one (CI doesn't gate the rest of lint). Matched by message.
 * Alert came off the ratchet at 0 and became an import ban: Alert is for a
 * permission denial (utils/openPermissionAlert) only.
 */
const ALERT_BAN_MESSAGE =
  "Alert is only for a permission denial (utils/openPermissionAlert). " +
  "Show a request failure with ErrorModal."

const banned = [{ key: "alertImport", message: ALERT_BAN_MESSAGE }]

// The no-restricted-syntax entries for a kind of file: the .tsx-only ones
// only for .tsx, and without the keys in `except`.
const selectorsFor = ({ tsx, except = [] }) =>
  ratcheted
    .filter((r) => (tsx || !r.tsxOnly) && !except.includes(r.key))
    .map(({ selector, message }) => ({ selector, message }))

module.exports = { ratcheted, selectorsFor, banned, ALERT_BAN_MESSAGE }
