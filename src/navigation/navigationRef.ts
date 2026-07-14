import { createNavigationContainerRef } from "@react-navigation/native"
import { RootStackParamList } from "navigation/types"

// Ref for navigating from OUTSIDE the navigator tree (e.g. the global in-app
// message banner, which renders as an overlay sibling of NavigationContainer
// and so cannot use useNavigation).
export const navigationRef = createNavigationContainerRef<RootStackParamList>()

export function navigateFromRef<T extends keyof RootStackParamList>(
  name: T,
  params: RootStackParamList[T]
): void {
  if (navigationRef.isReady()) {
    // @ts-expect-error — params type is correct per the overload; RN's ref.navigate signature is looser
    navigationRef.navigate(name, params)
  }
}
