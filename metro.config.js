const path = require('path')
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config")

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
  // The key knows nothing about babel.config.js either. `ds-w3-` came with
  // the commit that took NativeWind's plugin out of it, so no Metro serves a
  // file it transformed with the plugin, and none needs --reset-cache (which
  // empties the cache all the Metros on a machine share). Bump it again after
  // any change to babel.config.js.
  cacheVersion: `ds-w3-app-env-${process.env.APP_ENV || 'default'}`,
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

module.exports = mergeConfig(defaultConfig, config)
