// Scroll surfaces must come from components/scroll, which carries the
// alwaysBounceVertical={false} default that `ScrollView.defaultProps` used to
// set globally in index.js.
//
// That assignment was LIVE, not already dead: React 18.3.1 resolves
// `type.defaultProps` inside jsx() for any component type with no class gate.
// It had to go because React 19 keeps defaultProps for CLASS components only and
// RN's ScrollView export is a forwardRef wrapper, never the inner class — so at
// React 19 it becomes a silent no-op. A raw import here therefore reintroduces
// the rubber-band bounce with no error and no warning, which is why this is a
// lint error and not a convention.
//
// KNOWN GAPS, deliberately not chased: this cannot see `Animated.ScrollView`
// (a member expression, not an import — PickAddressScreen.tsx:23 does exactly
// that, benign only because it is horizontal AND behind a false feature flag),
// nor require()/dynamic import, nor a scroll view rendered inside a third-party
// component. See the note in src/components/scroll/index.tsx.
const RN_NAMES = ['ScrollView', 'FlatList', 'SectionList', 'VirtualizedList'];
const KAS_NAMES = [
  'KeyboardAwareScrollView',
  'KeyboardAwareFlatList',
  'KeyboardAwareSectionList',
];

const paths = [
  {
    name: 'react-native',
    importNames: RN_NAMES,
    message:
      'Import AppScrollView / AppFlatList from "components/scroll" instead. ' +
      'For a ref type, use `import type { ScrollView } from "react-native"`.',
  },
  {
    name: 'react-native-keyboard-aware-scroll-view',
    importNames: KAS_NAMES,
    message:
      'Import AppKeyboardAwareScrollView from "components/scroll" instead.',
  },
  {
    // RNGH re-wraps RN's ScrollView/FlatList, so these bounce identically.
    name: 'react-native-gesture-handler',
    importNames: ['ScrollView', 'FlatList'],
    message:
      'These wrap RN\'s own scroll views and bounce the same way. Use ' +
      'components/scroll, or pass alwaysBounceVertical explicitly and say why.',
  },
];

// Deep paths bypass an exact-name match, e.g.
// react-native/Libraries/Components/ScrollView/ScrollView
const patterns = ['react-native/Libraries/Components/ScrollView/*', 'react-native/Libraries/Lists/*'];

const withTypes = {
  paths: paths.map(p => ({...p, allowTypeImports: true})),
  patterns,
};

module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // the TS variant is the only one that understands allowTypeImports, and
      // four files legitimately need the real type for a ref
      files: ['*.ts', '*.tsx'],
      rules: {'@typescript-eslint/no-restricted-imports': ['error', withTypes]},
    },
    {
      // .js/.jsx get the core rule — no type imports exist there anyway. This
      // is what guards index.js, the file the default was removed from.
      files: ['*.js', '*.jsx'],
      rules: {'no-restricted-imports': ['error', {paths, patterns}]},
    },
    {
      // the wrappers themselves must import the real components
      files: ['src/components/scroll/index.tsx'],
      rules: {'@typescript-eslint/no-restricted-imports': 'off'},
    },
  ],
};
