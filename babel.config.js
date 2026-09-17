module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ["module-resolver", {
      root: ["./src"],
      extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
      alias: {
        "@tappler/shared": "../tappler-shared",
      }
    }],
    'nativewind/babel',
    ["module:react-native-dotenv", {
      moduleName: '@env',
      path: '.env',
    }],
    ["react-native-reanimated/plugin", {
      "relativeSourceLocation": true
    }]
  ],
};
