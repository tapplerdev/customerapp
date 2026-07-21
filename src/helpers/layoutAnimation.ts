import {
  LayoutAnimation,
  LayoutAnimationConfig,
  Platform,
  UIManager,
} from "react-native"

// LayoutAnimation needs the experimental flag on Android (iOS is native).
// Lives here so every scheduling call site is guaranteed the flag ran first.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

let pendingThisFrame = false

/**
 * Coalescing wrapper around LayoutAnimation.configureNext: the FIRST schedule
 * in a frame wins and later ones no-op until the next frame. Independent
 * triggers legitimately collide in one JS turn (blur + send in the same tap,
 * iOS re-firing keyboardWillShow on QuickType frame changes, focus + incoming
 * message) — raw configureNext then spams "Overriding previous layout
 * animation" warnings. One commit can only run one animation anyway.
 */
export function scheduleLayoutAnimation(config: LayoutAnimationConfig): void {
  if (pendingThisFrame) return
  pendingThisFrame = true
  requestAnimationFrame(() => {
    pendingThisFrame = false
  })
  LayoutAnimation.configureNext(config)
}
