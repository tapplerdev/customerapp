/**
 * Jest only. The screen kit's navigation: a screen rendered the way the
 * app's navigator renders it, inside React Navigation's real
 * NavigationContainer, as the one route of a real stack (useNavigationBuilder
 * with React Navigation's own StackRouter). So `navigation` and `route` are
 * the library's objects: useNavigation, useRoute, useFocusEffect,
 * useIsFocused, navigation.setOptions, addListener and isFocused all work,
 * and the screen is focused.
 *
 * The navigator draws nothing of its own (no header, no card, no host view):
 * the host tree is the screen's. An action this one-route stack can't handle
 * (navigate to another screen, goBack from the first route) is recorded in
 * `actions` instead of being performed, so a test can assert on it.
 */
import React from "react"
import {
  DefaultTheme,
  NavigationContainer,
  StackRouter,
  createNavigatorFactory,
  useNavigationBuilder,
  type NavigationAction,
  type ParamListBase,
  type StackNavigationState,
  type StackRouterOptions,
} from "@react-navigation/native"

/** The theme App.tsx gives its NavigationContainer (DefaultTheme, white background). */
const APP_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "#FFFFFF" },
}

type KitNavigatorProps = {
  id?: string
  initialRouteName?: string
  children: React.ReactNode
}

const KitNavigator = ({
  id,
  initialRouteName,
  children,
}: KitNavigatorProps) => {
  const { state, descriptors, NavigationContent } = useNavigationBuilder<
    StackNavigationState<ParamListBase>,
    StackRouterOptions,
    Record<string, () => void>,
    Record<string, unknown>,
    Record<string, unknown>
  >(StackRouter, { id, initialRouteName, children })
  const focused = state.routes[state.index]
  return (
    <NavigationContent>{descriptors[focused.key].render()}</NavigationContent>
  )
}

const createKitStack = createNavigatorFactory(KitNavigator)

export type ScreenRoute = {
  /** The route's name; default `parity-screen`. */
  name?: string
  params?: object
}

export type NavigationRecord = {
  /** Actions the one-route stack couldn't handle (navigate elsewhere, goBack). */
  actions: NavigationAction[]
}

/**
 * The screen as the one route of a stack inside a NavigationContainer. The
 * component gets `navigation` and `route` props from the navigator, as a
 * registered screen does.
 */
export const withNavigation = (
  Screen: React.ComponentType<any>,
  route: ScreenRoute,
  record: NavigationRecord
) => {
  const Stack = createKitStack()
  const name = route.name ?? "parity-screen"
  return (
    <NavigationContainer
      theme={APP_THEME}
      onUnhandledAction={(action) => {
        record.actions.push(action)
      }}
    >
      <Stack.Navigator initialRouteName={name}>
        <Stack.Screen
          name={name}
          component={Screen}
          initialParams={route.params}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
