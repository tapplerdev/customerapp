// The app's tailwind config, with the codemod's fixture directories added to
// `content` so NativeWind compiles them as it compiles src/ (parity runs only).
const app = require("../../../tailwind.config.js")

module.exports = {
  ...app,
  content: [
    ...app.content,
    "./scripts/__fixtures__/ds-codemod/**/*.{jsx,tsx}",
    "./scripts/__fixtures__/ds-codemod-out/**/*.{jsx,tsx}",
  ],
}
