module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    // NativeWind v4 is a PRESET, not a plugin. It bundles three things:
    // its own babel-plugin (rewrites createElement -> createInteropElement),
    // @babel/plugin-transform-react-jsx with importSource
    // "react-native-css-interop" (which is why bare RN needs no manual
    // jsxImportSource the way Expo does), and react-native-reanimated/plugin.
    //
    // That last one is why reanimated is NOT listed in plugins below any more:
    // nativewind/babel already supplies it, and Babel rejects the same plugin
    // twice with different options. See node_modules/nativewind/babel.js, which
    // is a one-line re-export of react-native-css-interop/babel.
    'nativewind/babel',
  ],
  plugins: [
    ["module-resolver", {
      root: ["./src"],
      extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
      alias: {
        "@tappler/shared": "../tappler-shared",
      }
    }],
    ["module:react-native-dotenv", {
      moduleName: '@env',
      path: '.env',
    }],
  ],
};
