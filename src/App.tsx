import { NavigationContainer, DefaultTheme } from "@react-navigation/native"
import React, { useCallback, useState } from "react"
import { Platform, StatusBar, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Provider } from "react-redux"
import { PersistGate } from "redux-persist/integration/react"
import { store, persistor } from "store"
import BootstrapScreen from "screens/BootstrapScreen/BootstrapScreen"
import SplashOverlay from "components/SplashOverlay/SplashOverlay"
import { storage } from "@tappler/shared/src/store/mmkv"
import { useChatSocket } from "hooks/useChatSocket"
import { navigationRef } from "navigation/navigationRef"
import InAppMessageBanner from "components/InAppMessageBanner/InAppMessageBanner"
import "locales/i18n"
import "react-native-gesture-handler"

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#FFFFFF",
  },
}

// Show splash on cold start if user will land on HomeScreen (auth or guest with location)
const shouldShowSplash = (() => {
  try {
    const raw = storage.getString("persist:tappler_customer_app-root-storage")
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const auth = typeof parsed?.auth === "string" ? JSON.parse(parsed.auth) : parsed?.auth
    // Authenticated user — will land on HomeScreen
    if (auth?.isAuth) return true
    // Guest with saved location — will also land on HomeScreen
    if (auth?.guestLocation) return true
    return false
  } catch { return false }
})()

// Mounted inside the Redux Provider so it can read auth state. Renders
// nothing — it just owns the single global chat WebSocket lifecycle.
const RealtimeManager: React.FC = () => {
  useChatSocket()
  return null
}

function App(): JSX.Element {
  const [navReady, setNavReady] = useState(false)
  const [splashDone, setSplashDone] = useState(!shouldShowSplash)

  const handleNavReady = useCallback(() => setNavReady(true), [])
  const handleSplashFinish = useCallback(() => setSplashDone(true), [])

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <RealtimeManager />
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <View style={{ flex: 1 }}>
                <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={handleNavReady}>
                  <StatusBar
                    barStyle={
                      Platform.OS === "android" ? "dark-content" : "default"
                    }
                    backgroundColor="transparent"
                    translucent={true}
                  />
                  <BootstrapScreen />
                </NavigationContainer>

                {!splashDone && (
                  <SplashOverlay
                    isReady={navReady}
                    onFinish={handleSplashFinish}
                  />
                )}

                {/* Global in-app message banner — overlays everything, above
                    the navigator so it's visible on any screen. */}
                <InAppMessageBanner />
              </View>
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  )
}

export default App
