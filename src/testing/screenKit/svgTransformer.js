/* eslint-disable @typescript-eslint/no-var-requires -- a CommonJS jest transformer */
/**
 * jest.parity.config.js's transform for `.svg` files: an icon module becomes
 * testing/svgStub's host element named after the file (`svg:close`), which
 * keeps the props the icon was given (width, height, color), where the RN
 * preset's asset transform would hand React a plain object it can't render.
 * The same names the component tests give their hand-written svg mocks.
 */
const crypto = require("crypto")
const path = require("path")

const STUB = path.join(__dirname, "..", "svgStub")

module.exports = {
  process(_source, file) {
    const name = path.basename(file, ".svg")
    return {
      code: [
        `const { svgStub } = require(${JSON.stringify(STUB)});`,
        `const Icon = svgStub(${JSON.stringify(name)});`,
        "module.exports = Icon;",
        "module.exports.default = Icon;",
        "module.exports.__esModule = true;",
      ].join("\n"),
    }
  },
  getCacheKey(_source, file) {
    return crypto
      .createHash("sha1")
      .update(`svgTransformer:1:${path.basename(file)}`)
      .digest("hex")
  },
}
