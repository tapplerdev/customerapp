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
import "locales/i18n"
import "react-native-gesture-handler"

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#FFFFFF",
  },
}

const isAuthPersisted = (() => {
  try {
    const raw = storage.getString("persist:tappler_customer_app-root-storage")
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const auth = typeof parsed?.auth === "string" ? JSON.parse(parsed.auth) : parsed?.auth
    return !!auth?.isAuth
  } catch { return false }
})()

function App(): JSX.Element {
  const [navReady, setNavReady] = useState(false)
  const [splashDone, setSplashDone] = useState(!isAuthPersisted)

  const handleNavReady = useCallback(() => setNavReady(true), [])
  const handleSplashFinish = useCallback(() => setSplashDone(true), [])

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <View style={{ flex: 1 }}>
                <NavigationContainer theme={navigationTheme} onReady={handleNavReady}>
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
              </View>
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  )
}

export default App
