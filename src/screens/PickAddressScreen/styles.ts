import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  closeShadow: {
    shadowColor: colors.grey4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  closeShadowAndroid: {
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  myLocationShadow: {
    shadowColor: colors.grey55,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  myLocationShadowAndroid: {
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  searchShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  searchShadowAndroid: {
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchHeaderShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  searchHeaderShadowAndroid: {
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
})
