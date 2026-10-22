/*
 * Jest only, for window.parity.tsx: what tappler-shared's helpers worked out
 * from the screen when they loaded (isSmallPhone, SCREEN_WIDTH...), drawn,
 * with a branch on isSmallPhone the way RegistrationFlowScreen takes one.
 */
import React from "react"
import { Dimensions, Text, View } from "react-native"

import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  isSmallPhone,
  isSmallPhoneHeight,
} from "@tappler/shared/src/helpers/helpers"

const SmallPhoneProbe = () => (
  <View>
    <Text testID="branch" style={{ fontSize: isSmallPhone ? 11 : 13 }}>
      {isSmallPhone ? "small phone" : "large phone"}
    </Text>
    <Text testID="loaded">{`${SCREEN_WIDTH}x${SCREEN_HEIGHT} ${isSmallPhoneHeight ? "short" : "tall"}`}</Text>
    <Text testID="now">{`${Dimensions.get("window").width}`}</Text>
  </View>
)

export default SmallPhoneProbe
