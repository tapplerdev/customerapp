const path = require('path')
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config")
const { withNativeWind } = require("nativewind/metro")

const defaultConfig = getDefaultConfig(__dirname)
const { assetExts, sourceExts } = defaultConfig.resolver

const sharedPath = path.resolve(__dirname, '../tappler-shared')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  // @env values are inlined at transform time, but Metro's cache key knows
  // nothing about APP_ENV — so switching environments would serve a stale
  // bundle built against the other API URL. Folding APP_ENV into the cache
  // version makes each environment its own cache instead, which is what
  // removes the --reset-cache dance the dotenv docs tell you to do.
  cacheVersion: `app-env-${process.env.APP_ENV || 'default'}`,
  watchFolders: [sharedPath],
  transformer: {
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...sourceExts, "svg"],
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
  },
}

// withNativeWind wraps the config rather than replacing parts of it, and it is
// safe alongside the svg transformer above: it claims Metro's TOP-LEVEL
// `transformerPath` and preserves the original as `cssInterop_transformerPath`,
// while spreading `...config.transformer` so our `babelTransformerPath`
// (react-native-svg-transformer) survives untouched. It also preserves
// resolver.resolveRequest, transformer.getTransformOptions and
// server.enhanceMiddleware. Verified in react-native-css-interop/dist/metro.
//
// It also writes nativewind-env.d.ts on first run (that is where the
// `className` prop types come from) — generated, so it is gitignored.
module.exports = withNativeWind(mergeConfig(defaultConfig, config), {
  input: "./global.css",
})
