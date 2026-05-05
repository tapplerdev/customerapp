import React, { useEffect } from "react"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"

interface LoadingOverlayProps {
  color?: string
  size?: number
  strokeWidth?: number
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg)

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  color = colors.red,
  size = 40,
  strokeWidth = 3,
}) => {
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    )
  }, [])

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.overlay}
    >
      <Animated.View
        entering={FadeIn.duration(300).delay(100)}
        style={styles.card}
      >
        <AnimatedSvg
          width={size}
          height={size}
          style={spinnerStyle}
        >
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeLinecap="round"
          />
        </AnimatedSvg>
      </Animated.View>
    </Animated.View>
  )
}

export default LoadingOverlay
