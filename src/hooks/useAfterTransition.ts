import { useEffect, useState } from "react"
import { InteractionManager } from "react-native"

/**
 * False until the current navigation animation has finished, then true.
 *
 * Use it to withhold reanimated `entering` animations on a screen's first
 * mount. While the native stack is still animating a screen in there is no
 * committed layout for reanimated to enter FROM, so it draws the subtree at
 * the container's origin for a frame or two — content appears over the header
 * and then drops into place. It is a race, so it only shows up sometimes.
 *
 * Gating on this keeps the animation everywhere it is well-defined (any
 * remount after the screen has settled — a new search key, a list swapping in
 * after its skeleton) and drops it only where it was broken (arrival).
 *
 * InteractionManager already means "after the animations", so there is no
 * timer to tune and no dependency on a navigator's transition events. The
 * handle is cancelled on unmount, so a screen popped mid-transition never
 * setStates after teardown.
 */
export const useAfterTransition = (): boolean => {
  const [hasSettled, setHasSettled] = useState(false)

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() =>
      setHasSettled(true),
    )
    return () => handle.cancel()
  }, [])

  return hasSettled
}

export default useAfterTransition
