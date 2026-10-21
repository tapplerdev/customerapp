/**
 * An SVG icon (react-native-svg-transformer in the app) as a host element
 * that keeps its props, so the parity comparison sees an icon's colour and
 * size as well as where it sits.
 */
const React = require("react")

const SvgStub = (props) => React.createElement("SvgIcon", props)

module.exports = SvgStub
module.exports.default = SvgStub
