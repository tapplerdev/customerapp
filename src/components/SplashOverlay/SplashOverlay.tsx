import React, { useEffect, useRef } from "react"
import { Animated, StyleSheet } from "react-native"
import LottieView from "lottie-react-native"

import splashAnimation from "assets/animations/splash-build-up.json"

interface Props {
  isReady: boolean
  onFinish: () => void
}

const SplashOverlay: React.FC<Props> = ({ isReady, onFinish }) => {
  const opacity = useRef(new Animated.Value(1)).current
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => onFinish())
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isReady])

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ scale }] },
      ]}
    >
      <LottieView
        source={splashAnimation}
        autoPlay
        loop
        style={styles.lottie}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  lottie: {
    width: 320,
    height: 320,
  },
})

export default SplashOverlay
