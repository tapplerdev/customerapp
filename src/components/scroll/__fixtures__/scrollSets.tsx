/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
/*
 * The prop sets the three scroll wrappers' call sites hand them, read off the
 * sites (`jsxsites.js` in ca-w1-C2-evidence: every JSX element of the
 * wrapper's name and its attributes; the harvest can't be used here, it
 * evaluates a site's children and the sites' are whole screens). One entry per
 * distinct set; `sites` names the call sites behind it (file:line, at 7fa5fc6).
 * A value a site computes is a stand-in with the site's own shape (a number
 * for `insets.bottom + 32`, a colour for `BG2`). A handler is `{ $fn: true }`,
 * a list, and a list's `renderItem`, `keyExtractor` and `getItemLayout`, `{ $opaque: "<name>" }` (OPAQUE below), an element a spec.
 *
 * The data is in a .tsx file so NativeWind compiles the class strings in it:
 * the tests load this file in every row's registry (loaders below).
 */
import React from "react"

import type { CasesFile } from "testing/harvest"

type PropSet = Record<string, unknown>
type Set = { id: string; sites: string[]; props: PropSet }

/** What the `$opaque` markers stand for. A host element named `Row` draws a list item. */
export const OPAQUE = (key: string): unknown => {
  switch (key) {
    case "data":
      return [{ id: 1 }, { id: 2 }]
    case "keyExtractor":
      return (item: { id: number }) => String(item.id)
    case "renderItem":
      return ({ item }: { item: { id: number } }) =>
        React.createElement("Row", {}, `item ${item.id}`)
    case "getItemLayout":
      return (_: unknown, index: number) => ({
        length: 50,
        offset: 50 * index,
        index,
      })
    default:
      throw new Error(`scrollSets: no stand-in for ${key}`)
  }
}

const ROW = (text: string) => ({ $el: "Row", children: text })
const ROWS = [ROW("first row"), ROW("second row")]
const EMPTY = ROW("nothing here")

/** AppScrollView: every distinct set. */
export const SCROLL_VIEW: Set[] = [
  {
    id: "vertical, no indicator",
    sites: ["components/AddressSelectionModal/AddressSelectionModal.tsx:103"],
    props: { showsVerticalScrollIndicator: false, children: ROWS },
  },
  {
    id: "horizontal, padded content",
    sites: ["components/AnimatedSelectCategory/AnimatedSelectCategory.tsx:93"],
    props: {
      horizontal: true,
      showsHorizontalScrollIndicator: false,
      contentContainerStyle: { paddingHorizontal: 14 },
      children: ROWS,
    },
  },
  {
    id: "class flex-1, no bounce",
    sites: ["components/CalendarTimeSheet/CalendarTimeSheet.tsx:94"],
    props: {
      className: "flex-1",
      bounces: false,
      showsVerticalScrollIndicator: false,
      children: ROWS,
    },
  },
  {
    id: "class mt-[16], horizontal",
    sites: [
      "components/QuestionComponent/QuestionComponent.tsx:286",
      "components/QuestionComponent/QuestionComponent.tsx:311",
      "components/QuestionComponent/QuestionComponent.tsx:336",
      "components/QuestionComponent/QuestionComponent.tsx:360",
    ],
    props: {
      horizontal: true,
      showsHorizontalScrollIndicator: false,
      className: "mt-[16]",
      children: ROWS,
    },
  },
  {
    id: "class mt-[12], horizontal, padded content",
    sites: [
      "screens/HomeSkeletonScreen/HomeSkeletonScreen.tsx:22",
      "screens/dashboardScreens/HomeScreen/components/PresetSection.tsx:41",
    ],
    props: {
      horizontal: true,
      showsHorizontalScrollIndicator: false,
      contentContainerStyle: { paddingHorizontal: 16 },
      className: "mt-[12]",
      children: ROWS,
    },
  },
  {
    id: "padded bottom",
    sites: [
      "screens/HomeSkeletonScreen/HomeSkeletonScreen.tsx:40",
      "screens/dashboardScreens/FoodCartScreen/FoodCartScreen.tsx:243",
      "screens/dashboardScreens/HomeScreen/HomeScreen.tsx:85",
    ],
    props: {
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { paddingBottom: 24 },
      children: ROWS,
    },
  },
  {
    id: "grow and padded bottom",
    sites: [
      "screens/dashboardScreens/AccountScreen/AccountScreen.tsx:83",
      "screens/dashboardScreens/AccountScreen/AccountScreen.tsx:194",
    ],
    props: {
      contentContainerStyle: { flexGrow: 1, paddingBottom: 24 },
      showsVerticalScrollIndicator: false,
      children: ROWS,
    },
  },
  {
    id: "class flex-1, padded, handled taps, no bounce",
    sites: [
      "screens/dashboardScreens/AllQuestionsScreen/AllQuestionsScreen.tsx:176",
    ],
    props: {
      className: "flex-1",
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { paddingBottom: 20 },
      bounces: false,
      keyboardShouldPersistTaps: "handled",
      children: ROWS,
    },
  },
  {
    id: "class flex-1, padded top and bottom, handled taps, no bounce",
    sites: ["screens/dashboardScreens/FiltersScreen/FiltersScreen.tsx:290"],
    props: {
      className: "flex-1",
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { paddingTop: 16, paddingBottom: 16 },
      keyboardShouldPersistTaps: "handled",
      bounces: false,
      children: ROWS,
    },
  },
  {
    id: "horizontal",
    sites: [
      "screens/dashboardScreens/FiltersScreen/FiltersScreen.tsx:419",
      "screens/dashboardScreens/FiltersScreen/FiltersScreen.tsx:440",
      "screens/dashboardScreens/FiltersScreen/FiltersScreen.tsx:500",
      "screens/dashboardScreens/FiltersScreen/FiltersScreen.tsx:521",
      "screens/dashboardScreens/FiltersScreen/FiltersScreen.tsx:542",
    ],
    props: {
      horizontal: true,
      showsHorizontalScrollIndicator: false,
      children: ROWS,
    },
  },
  {
    id: "padded all round",
    sites: [
      "screens/dashboardScreens/FoodCheckoutScreen/FoodCheckoutScreen.tsx:604",
      "screens/dashboardScreens/JobDetailScreen/components/FoodOrderView.tsx:386",
    ],
    props: {
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { padding: 16, paddingBottom: 24 },
      children: ROWS,
    },
  },
  {
    id: "class flex-1, padded bottom",
    sites: [
      "screens/dashboardScreens/FoodOrderReviewScreen/FoodOrderReviewScreen.tsx:145",
    ],
    props: {
      className: "flex-1",
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { paddingBottom: 24 },
      children: ROWS,
    },
  },
  {
    id: "no bounce, padded by the inset",
    sites: [
      "screens/dashboardScreens/MessagesDetailsScreen/MessagesDetailsScreen.tsx:736",
    ],
    props: {
      showsVerticalScrollIndicator: false,
      bounces: false,
      // insets.bottom + 32, at the kit's iPhone 16 Pro inset
      contentContainerStyle: { paddingHorizontal: 24, paddingBottom: 66 },
      children: ROWS,
    },
  },
  {
    id: "style as well as content style",
    sites: [
      "screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:322",
    ],
    props: {
      contentContainerStyle: { paddingBottom: 20 },
      showsVerticalScrollIndicator: false,
      // BG2
      style: { backgroundColor: "#F7F7F7" },
      children: ROWS,
    },
  },
  {
    id: "padded top and sides, grow",
    sites: [
      "screens/dashboardScreens/ChangePasswordScreen/ChangePasswordScreen.tsx:88",
      "screens/dashboardScreens/UpdateEmailScreen/UpdateEmailScreen.tsx:90",
    ],
    props: {
      contentContainerStyle: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
      },
      showsVerticalScrollIndicator: false,
      children: ROWS,
    },
  },
  {
    id: "handled taps, no bounce, padded",
    sites: [
      "screens/dashboardScreens/QuestionStepScreen/QuestionStepScreen.tsx:283",
      "screens/dashboardScreens/ServiceRequestDetailsScreen/ServiceRequestDetailsScreen.tsx:345",
    ],
    props: {
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { paddingTop: 28, paddingBottom: 20, flexGrow: 1 },
      bounces: false,
      keyboardShouldPersistTaps: "handled",
      children: ROWS,
    },
  },
  {
    id: "grow only",
    sites: [
      "screens/dashboardScreens/RequestDetailsScreen/RequestDetailsScreen.tsx:161",
    ],
    props: {
      contentContainerStyle: { flexGrow: 1 },
      showsVerticalScrollIndicator: false,
      children: ROWS,
    },
  },
]

/** AppFlatList: the sets that differ in what the wrapper handles. */
export const FLAT_LIST: Set[] = [
  {
    id: "inverted chat list, class flex-1 bg-white",
    sites: [
      "screens/dashboardScreens/MessagesDetailsScreen/MessagesDetailsScreen.tsx:1080",
    ],
    props: {
      data: { $opaque: "data" },
      keyExtractor: { $opaque: "keyExtractor" },
      renderItem: { $opaque: "renderItem" },
      inverted: true,
      className: "flex-1 bg-white",
      contentContainerStyle: { paddingBottom: 10 },
      onEndReached: { $fn: true },
      onEndReachedThreshold: 0.3,
      onScroll: { $fn: true },
      scrollEventThrottle: 16,
      keyboardDismissMode: "interactive",
      removeClippedSubviews: true,
      windowSize: 10,
      maxToRenderPerBatch: 10,
      ListEmptyComponent: EMPTY,
    },
  },
  {
    id: "inverted chat list, empty",
    sites: [
      "screens/dashboardScreens/MessagesDetailsScreen/MessagesDetailsScreen.tsx:1080",
    ],
    props: {
      data: [],
      keyExtractor: { $opaque: "keyExtractor" },
      renderItem: { $opaque: "renderItem" },
      inverted: true,
      className: "flex-1 bg-white",
      contentContainerStyle: { flex: 1, justifyContent: "center" },
      ListEmptyComponent: EMPTY,
    },
  },
  {
    id: "vertical, no indicator",
    sites: [
      "screens/dashboardScreens/SubCategoriesScreen/SubCategoriesScreen.tsx:76",
    ],
    props: {
      data: { $opaque: "data" },
      renderItem: { $opaque: "renderItem" },
      keyExtractor: { $opaque: "keyExtractor" },
      showsVerticalScrollIndicator: false,
    },
  },
  {
    id: "pull to refresh, bounce kept",
    sites: [
      "screens/dashboardScreens/TalabatiScreen/TalabatiScreen.tsx:392",
      "screens/dashboardScreens/NotificationsScreen/NotificationsScreen.tsx:207",
    ],
    props: {
      data: { $opaque: "data" },
      renderItem: { $opaque: "renderItem" },
      keyExtractor: { $opaque: "keyExtractor" },
      contentContainerStyle: { paddingBottom: 20 },
      showsVerticalScrollIndicator: false,
      alwaysBounceVertical: true,
    },
  },
  {
    id: "horizontal strip",
    sites: [
      "screens/dashboardScreens/ProProfileScreen/ProProfileScreen.tsx:341",
    ],
    props: {
      horizontal: true,
      showsHorizontalScrollIndicator: false,
      contentContainerStyle: { flexGrow: 1, paddingRight: 15 },
      data: { $opaque: "data" },
      keyExtractor: { $opaque: "keyExtractor" },
      renderItem: { $opaque: "renderItem" },
    },
  },
  {
    id: "paging gallery",
    sites: ["components/ImageViewerModal/ImageViewerModal.tsx:62"],
    props: {
      data: { $opaque: "data" },
      renderItem: { $opaque: "renderItem" },
      horizontal: true,
      pagingEnabled: true,
      showsHorizontalScrollIndicator: false,
      onScroll: { $fn: true },
      scrollEventThrottle: 16,
      initialScrollIndex: 0,
      getItemLayout: { $opaque: "getItemLayout" },
      keyExtractor: { $opaque: "keyExtractor" },
    },
  },
  {
    id: "handled taps, interactive dismissal",
    sites: ["components/SearchLocationModal/SearchLocationModal.tsx:286"],
    props: {
      data: { $opaque: "data" },
      renderItem: { $opaque: "renderItem" },
      keyExtractor: { $opaque: "keyExtractor" },
      keyboardShouldPersistTaps: "handled",
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { paddingBottom: 0 },
      keyboardDismissMode: "interactive",
    },
  },
  {
    id: "empty component, padded bottom",
    sites: [
      "screens/dashboardScreens/CategoriesScreen/CategoriesScreen.tsx:207",
    ],
    props: {
      data: [],
      renderItem: { $opaque: "renderItem" },
      keyExtractor: { $opaque: "keyExtractor" },
      keyboardShouldPersistTaps: "handled",
      showsVerticalScrollIndicator: false,
      contentContainerStyle: { paddingBottom: 20 },
      ListEmptyComponent: EMPTY,
    },
  },
]

/** AppKeyboardAwareScrollView: every distinct set. */
export const KEYBOARD_SCROLL: Set[] = [
  {
    id: "grow, padded top and sides",
    sites: [
      "screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen.tsx:115",
    ],
    props: {
      contentContainerStyle: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
      },
      showsVerticalScrollIndicator: false,
      keyboardShouldPersistTaps: "handled",
      children: ROWS,
    },
  },
  {
    id: "grow, padded bottom",
    sites: [
      "screens/dashboardScreens/AuthGateScreen/GateRegisterScreen.tsx:106",
      "screens/onboardingScreens/RegisterScreen/RegisterScreen.tsx:135",
    ],
    props: {
      contentContainerStyle: { flexGrow: 1, paddingBottom: 27 },
      showsVerticalScrollIndicator: false,
      keyboardShouldPersistTaps: "handled",
      children: ROWS,
    },
  },
  {
    id: "grow, padded bottom and sides",
    sites: [
      "screens/dashboardScreens/AuthGateScreen/GateSignInScreen.tsx:77",
      "screens/onboardingScreens/SignInEmailScreen/SignInEmailScreen.tsx:110",
    ],
    props: {
      contentContainerStyle: {
        flexGrow: 1,
        paddingBottom: 27,
        paddingHorizontal: 19,
      },
      showsVerticalScrollIndicator: false,
      keyboardShouldPersistTaps: "handled",
      children: ROWS,
    },
  },
  {
    id: "grow only",
    sites: [
      "screens/dashboardScreens/DeleteAccountScreen/DeleteAccountScreen.tsx:59",
    ],
    props: {
      contentContainerStyle: { flexGrow: 1 },
      showsVerticalScrollIndicator: false,
      keyboardShouldPersistTaps: "handled",
      children: ROWS,
    },
  },
  {
    id: "scroll handler, no bounce",
    sites: [
      "screens/dashboardScreens/ProProfileScreen/ProProfileScreen.tsx:229",
    ],
    props: {
      showsVerticalScrollIndicator: false,
      // colors.white
      contentContainerStyle: { paddingBottom: 100, backgroundColor: "#FFFFFF" },
      onScroll: { $fn: true },
      scrollEventThrottle: 16,
      bounces: false,
      children: ROWS,
    },
  },
  {
    id: "grow, padded bottom (review form)",
    sites: [
      "screens/dashboardScreens/ReviewFormScreen/ReviewFormScreen.tsx:174",
    ],
    props: {
      contentContainerStyle: { flexGrow: 1, paddingBottom: 40 },
      showsVerticalScrollIndicator: false,
      keyboardShouldPersistTaps: "handled",
      children: ROWS,
    },
  },
]

export const WRAPPERS = {
  AppScrollView: SCROLL_VIEW,
  AppFlatList: FLAT_LIST,
  AppKeyboardAwareScrollView: KEYBOARD_SCROLL,
} as const
export type WrapperName = keyof typeof WRAPPERS

/** A wrapper's sets in the harvest's file shape (what twinCases takes). */
export const casesFor = (name: WrapperName): CasesFile => ({
  component: name,
  capturedAt: "7fa5fc6",
  elements: WRAPPERS[name].reduce((n, set) => n + set.sites.length, 0),
  files: new Set(
    WRAPPERS[name].flatMap((set) => set.sites.map((s) => s.split(":")[0]))
  ).size,
  cases: Object.fromEntries(
    WRAPPERS[name].map((set) => [
      set.id,
      { props: set.props, sites: set.sites },
    ])
  ) as unknown as CasesFile["cases"],
})
