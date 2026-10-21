/*
 * `@env` in jest: stub values, never the worktree's .env.
 *
 * react-native-dotenv (babel.config.js) inlines `@env` at TRANSFORM time, and
 * jest caches transforms, so a row's answer would depend on which .env its
 * worktree has (and on which run filled the cache): HERE's key rides in the
 * URL (services/here-maps-api.ts), API_URL names the production backend. The
 * plugin lets process.env win over the files (index.js:91-97 in
 * node_modules/react-native-dotenv), so every key src/types/env.d.ts declares
 * is set here, before babel-jest runs in this process or its workers. The
 * same values sit in `globals`, which is part of the transform cache key, so
 * a cache filled with other values is never reused. A test pins both
 * (src/testing/__tests__/env.test.ts).
 */
const ENV_STUB = {
  API_URL: "https://api.parity.invalid/api",
  HERE_MAPS_API_KEY: "parity-here-key",
}
Object.assign(process.env, ENV_STUB)

module.exports = {
  preset: 'react-native',
  // tappler-shared is a link: dependency, so its sources resolve from ITS
  // directory — where @babel/runtime is not installed. Without this, any test
  // reaching into the shared package dies on an unresolvable helper import
  // rather than on anything to do with the test. modulePaths rather than
  // moduleDirectories: jest puts an absolute moduleDirectories entry FIRST in
  // the lookup order, ahead of a package's own nested node_modules (proapp's
  // RTK resolved the root's reselect 4 instead of its own 5 that way).
  // modulePaths is consulted last — a fallback, which is all shared needs.
  modulePaths: ['<rootDir>/node_modules'],
  // The RN preset's own default allowlist, plus what ships ESM it doesn't
  // transform: the true-sheet mock and stand-in's library
  // (https://sheet.lodev09.com/guides/jest says so explicitly) and the Redux
  // Toolkit family, without which any test touching a slice or services/api
  // dies on `Unexpected token 'export'`.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|reselect|redux|redux-thunk|@lodev09/react-native-true-sheet)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globals: { __PARITY_ENV_STUB__: ENV_STUB },
  // `*.parity.tsx` run under jest.parity.config.js only (the screen kit's
  // mocks and setup, src/testing/screenKit): `yarn test:parity`.
  // `*.pass1.test.*` need NativeWind's internals and the class-era tools
  // (jest.pass1.config.js, `yarn test:pass1-tools`), as in proapp.
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.parity\\.tsx?$',
    '\\.pass1\\.test\\.[jt]sx?$',
  ],
};
