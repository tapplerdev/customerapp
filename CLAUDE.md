# CLAUDE.md

This file provides guidance to Claude Code when working with the Tappler Customer App.

## Project Overview

**Tappler Customer App** — React Native 0.73.4 for customers to find and hire service providers. Built with TypeScript, NativeWind (Tailwind CSS), and Redux Toolkit. Supports Arabic (RTL) and English (LTR).

## Development Commands

```bash
yarn start          # Metro bundler (port 8082)
yarn ios            # Run on iOS simulator
yarn android        # Run on Android
yarn lint           # Lint
yarn test           # Tests
```

## Architecture

### State Management
- **Redux Toolkit** with RTK Query for API calls
- **Redux Persist** using MMKV storage — only `auth` slice is persisted
- Store slices: `auth` (tokens, user, language, guestLocation)

### Navigation
- **React Navigation v7** (Native Stack + Bottom Tabs)
- Route types in `src/navigation/types.ts`
- Pass IDs in navigation params, not full objects. Read data from RTK Query cache on the destination screen.

### RTK Query
- Endpoints in `src/services/api.ts`
- Cache tags: `Auth`, `Preset`, `Jobs`, `Chats` — only add tags when a mutation actually invalidates them
- `preferCacheValue: true` on lazy triggers to avoid redundant fetches
- Token refresh with deduplication via module-level `isRefreshing` flag

### Prefetch-Before-Navigate
When navigating to a screen that fetches data on mount, prefetch the data on the source screen first so the destination renders instantly from cache instead of showing a loading state.

**Pattern:**
```typescript
// Source screen
const [getProProfile] = useLazyGetProProfileQuery()

const handlePress = async () => {
  await getProProfile({ proId, serviceCategoryId }, true).unwrap()
  navigation.navigate("ProProfileScreen", { proId, serviceCategoryId })
}

// Destination screen — useQuery hits cache, no loading flash
const { data: pro, isLoading } = useGetProProfileQuery({ proId, serviceCategoryId })
```

**When to use:** Navigating to detail/profile screens where the destination has a loading guard (`if (isLoading) return <LoadingOverlay />`). The user stays on the current screen while data loads, then transitions instantly.

**When NOT to use:** Screens that load fast already, list screens with their own skeletons, or screens where showing a loading state is expected (e.g., search results).

### Event Bus
- `addressEventBus` from `@tappler/shared` for address selection modal-return flows
- Events: `"address:pick"` (from PickAddressScreen), `"address:select"` (from MySavedAddressesScreen)
- Used when one emitter has multiple possible listeners — `popTo` can't do this
- Always clean up listeners in useEffect return

### Styling
- **NativeWind v2** (Tailwind CSS via Babel transform)
- Base components from `@tappler/shared`: `DmView`, `DmText`, `DmInput`, `ActionBtn`
- `DmText` has hardcoded `text-14 text-black text-left` — use `style` prop to override, NOT className conflicts
- Do NOT use `tailwind-merge` with NativeWind v2 — it breaks visual consistency across both apps

### Shared Package
- `@tappler/shared` (local file link to `../tappler-shared`)
- Contains: UI components, event buses, helpers, CachedImage, colors, fonts
- Changes to shared package affect BOTH customer and pro apps

## Key Patterns

### Loading States
- Use `LoadingOverlay` (`components/LoadingOverlay/LoadingOverlay`) for full-screen loading states (screen mounts, data fetching before render)
- Use `ActivityIndicator` from react-native ONLY for inline/button spinners (search dropdowns, button loading states)
- Do NOT use bare `ActivityIndicator` for full-screen loading — always use `LoadingOverlay`

### Error Handling
- Use `ErrorModal` component for form submission failures (same pattern as RegisterScreen, MyInformationScreen)
- Use `Alert.alert` for actionable errors where user needs guidance (e.g., location permissions)
- SvgUriContainer fetch failures are silent by design (decorative images)

### Lists
- `FlashList` (v1) for large lists (ProsListingScreen) — requires `estimatedItemSize`
- `FlatList` with `getItemLayout` for fixed-height lists (MessagesScreen, CategoriesScreen)
- Wrap `renderItem` in `useCallback` for list components
- `React.memo` on list item components (ProCard, MessagesComponent, MessageComponent)

### Internationalization
- `i18next` with `react-i18next`
- Use `i18n.language === 'ar'` for reactive checks (NOT `I18nManager.isRTL` — it's static)
- Translation files: `src/locales/en.json` and `src/locales/ar.json`

## Module Resolution

Absolute imports from `src/`:
```typescript
import { api } from "services/api"
import { DmText } from "components/UI"
import { useTypedSelector } from "store"
```

## Environment Variables

Uses `react-native-dotenv`:
```typescript
import { API_URL, HERE_MAPS_API_KEY } from "@env"
```

## Known Quirks

1. **DmText hardcoded base styles**: `text-14 text-black text-left` in base className. NativeWind v2 uses first-match-wins, so className overrides are silently ignored. Use `style` prop for overrides.

2. **I18nManager.isRTL is static**: Doesn't trigger re-renders. Use `i18n.language === 'ar'` instead.

3. **HERE Maps language parameter**: `lang` controls response display language but does NOT filter results by language.

4. **FlashList v1 vs v2**: v2 requires New Architecture (RN 0.76+). On RN 0.73, use v1 with `estimatedItemSize`.

5. **RTK Query mutation triggers are stable**: `useMutation` trigger functions don't change identity between renders — they don't need to be in useEffect dependency arrays.

6. **`i18n` and `t` from useTranslation are stable**: `i18n` is a singleton. `t` changes when language changes, which correlates with `i18n.language` — if you already depend on `isAr` or `i18n.language`, you don't need `t` separately.

## File Organization

```
src/
├── components/       # Reusable UI components
│   ├── MyComponent/
│   │   ├── MyComponent.tsx
│   │   └── styles.ts
│   └── CLAUDE.md     # Pro card rendering docs
├── screens/
│   ├── onboardingScreens/
│   ├── dashboardScreens/
│   │   └── MyScreen/
│   │       ├── MyScreen.tsx
│   │       ├── styles.ts
│   │       ├── CLAUDE.md   # Screen-specific docs (e.g., TalabatiScreen)
│   │       └── components/
│   └── PickAddressScreen/
├── navigation/       # Navigator + route types
├── services/         # RTK Query API + HERE Maps
├── store/            # Redux slices (auth only)
├── types/            # TypeScript type definitions
├── locales/          # i18n translation files (en.json, ar.json)
├── assets/           # Images, icons, fonts, animations
└── docs/             # Visual guides (talabati-status-guide.html)
```

### Style Files Convention
- Extract `StyleSheet.create()` to co-located `styles.ts` (not `.tsx`)
- Import as `import styles from "./styles"`
- Prioritize hot-path styles (list items, frequently re-rendered components)
- Keep NativeWind for layout/spacing, StyleSheet for shadows and complex objects
