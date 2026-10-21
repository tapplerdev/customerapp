/**
 * The files run-real's --sweep can't check for a reason other than a prop
 * they need, each with its cause (sweep.js): nothing in them is compared.
 * A load failure or a file with no component to draw fails the sweep unless
 * it is listed here, and a listed gap that no longer happens fails it too.
 *
 * As found on 2026-10-21 (feature/design-system + ds/ca-w0-T-fix, both
 * platforms): 15 files stop at an import this config can't load, an ESM
 * package it doesn't transform or a native module with no mock here, and 3
 * screens export only their sheet. This sweep is a broad check; the screen
 * kit (`yarn test:parity`, src/testing/screenKit) has the mocks and data
 * these screens need and draws them, its sheets included (review-ca-w0: its
 * 44 routes, 400/400 after converting the screens). Mocking them here too
 * would copy the kit's native mocks.
 */
const esm = (pkg, where) =>
  `${pkg} ships ESM (${where}) that this config doesn't transform`

const SWEEP_GAPS = [
  {
    file: "src/components/MessageComponent/MessageComponent.tsx",
    kind: "load",
    match: /node_modules\/react-native-autolink\//,
    cause: esm("react-native-autolink", "dist/index.js"),
  },
  ...[
    "src/components/TabBar/TabBar.tsx",
    "src/screens/PickAddressScreen/components/MapPickerView.tsx",
    "src/screens/PickAddressScreen/components/MapPickerWithSearchView.tsx",
    "src/screens/onboardingScreens/GuestLocationScreen/GuestLocationScreen.tsx",
  ].map((file) => ({
    file,
    kind: "load",
    match: /node_modules\/react-native-drop-shadow\//,
    cause: esm("react-native-drop-shadow", "lib/module"),
  })),
  ...[
    "src/screens/PickAddressScreen/PickAddressScreen.tsx",
    "src/screens/PickAddressScreen/components/SearchView.tsx",
  ].map((file) => ({
    file,
    kind: "load",
    match: /'@react-native-community\/geolocation' doesn't seem to be linked/,
    cause:
      "@react-native-community/geolocation throws at import without its native module, which nothing mocks here",
  })),
  ...[
    "src/screens/dashboardScreens/AccountScreen/AccountScreen.tsx",
    "src/screens/dashboardScreens/RequestSuccessScreen/RequestSuccessScreen.tsx",
  ].map((file) => ({
    file,
    kind: "load",
    match: /node_modules\/@react-native-firebase\/messaging\//,
    cause: esm("@react-native-firebase/messaging", "dist/module"),
  })),
  {
    file: "src/screens/dashboardScreens/MessagesDetailsScreen/MessagesDetailsScreen.tsx",
    kind: "load",
    match: /node_modules\/@react-native-documents\/picker\//,
    cause: esm("@react-native-documents/picker", "lib/module"),
  },
  {
    file: "src/screens/dashboardScreens/ProProfileScreen/ProProfileScreen.tsx",
    kind: "load",
    match: /node_modules\/react-native-create-thumbnail\//,
    cause: esm("react-native-create-thumbnail", "index.js"),
  },
  ...[
    "src/screens/dashboardScreens/ProsListingScreen/ProsListingScreen.tsx",
    "src/screens/dashboardScreens/ProsListingScreen/components/ProCard.tsx",
  ].map((file) => ({
    file,
    kind: "load",
    match: /node_modules\/rn-tourguide\//,
    cause: esm("rn-tourguide", "lib/index.js"),
  })),
  {
    file: "src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx",
    kind: "load",
    match: /node_modules\/react-native-maps\//,
    cause:
      "react-native-maps ships TypeScript source (src/index.ts) that this config doesn't transform",
  },
  {
    file: "src/screens/dashboardScreens/ReviewFormScreen/ReviewFormScreen.tsx",
    kind: "load",
    match: /node_modules\/react-native-image-crop-picker\//,
    cause: esm("react-native-image-crop-picker", "index.js"),
  },
  ...[
    ["AllQuestionsScreen", "AllQuestionsSheet"],
    ["FiltersScreen", "FiltersSheet"],
    ["QuestionStepScreen", "QuestionFlowSheet"],
  ].map(([screen, sheet]) => ({
    file: `src/screens/dashboardScreens/${screen}/${screen}.tsx`,
    kind: "export",
    match: /^no component export$/,
    cause: `exports ${sheet} and no default component, so there is nothing to draw with no props`,
  })),
]

module.exports = { SWEEP_GAPS }
