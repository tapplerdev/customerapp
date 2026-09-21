module.exports = {
  preset: 'react-native',
  // tappler-shared is a link: dependency, so its sources resolve from ITS
  // directory — where @babel/runtime is not installed. Without this, any test
  // reaching into the shared package dies on an unresolvable helper import
  // rather than on anything to do with the test. modulePaths rather than
  // moduleDirectories: the latter is consulted BEFORE a package's own nested
  // node_modules and has bitten proapp before.
  modulePaths: ['<rootDir>/node_modules'],
  // The true-sheet mock ships ESM, so the package has to be transformed —
  // https://sheet.lodev09.com/guides/jest says so explicitly. This is the RN
  // preset's own default allowlist plus that package.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@lodev09/react-native-true-sheet)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
