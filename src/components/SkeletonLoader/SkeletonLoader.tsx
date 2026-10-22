import React, { useEffect } from "react"
import { View, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated"
import { DmView } from "@tappler/shared/src/components/UI"
import { classNameSlot } from "@tappler/shared/src/components/classNameSlots"
import type { NoShorthands } from "@tappler/shared/src/components/classStyles"
import styles from "./styles"

// The wrapper as a slot: a caller's className, then `style` (see
// classNameSlots). It has no styles of its own.
const Wrapper = classNameSlot(DmView)

interface Props {
  width?: number | string
  height?: number | string
  borderRadius?: number
  /** The wrapper around the block, as classes (margins, flex). */
  className?: string
  /**
   * The wrapper, as a style, after `className`. Like every twin it takes one
   * key per side or corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
}

const SkeletonLoader: React.FC<Props> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  className = "",
  style,
}) => {
  const shimmerTranslate = useSharedValue(-200)

  useEffect(() => {
    shimmerTranslate.value = withRepeat(
      withTiming(200, {
        duration: 1500,
        easing: Easing.ease,
      }),
      -1,
      false
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shimmerTranslate.value }],
    }
  })

  const shimmerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerTranslate.value,
      [-200, -100, 0, 100, 200],
      [0, 0.5, 1, 0.5, 0]
    )
    return {
      opacity,
    }
  })

  // Dynamic colors based on theme
  // Fixed light palette, NOT useColorScheme.
  //
  // The dark branch made this the only component in the app that followed the
  // system theme, on an app whose every other surface is a hardcoded light
  // palette. iOS never revealed it because Info.plist pins
  // UIUserInterfaceStyle to Light, so useColorScheme always answered "light".
  // Android has no equivalent pin, so a phone in dark mode drew near-black
  // blocks on a white screen. Restore the branch when there is a dark theme
  // for it to match.
  const skeletonBackgroundColor = "#E1E9EE"
  const shimmerColor = "rgba(255, 255, 255, 0.6)"

  return (
    <Wrapper className={className} style={style}>
      <View
        style={[
          styles.container,
          {
            width,
            height,
            borderRadius,
          },
        ]}
      >
        {/* Base skeleton */}
        <View style={[styles.skeleton, { backgroundColor: skeletonBackgroundColor, borderRadius }]} />

        {/* Shimmer overlay */}
        <Animated.View
          style={[
            styles.shimmerContainer,
            {
              borderRadius,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.shimmer,
              { backgroundColor: shimmerColor },
              animatedStyle,
              shimmerStyle,
            ]}
          />
        </Animated.View>
      </View>
    </Wrapper>
  )
}

export default SkeletonLoader
