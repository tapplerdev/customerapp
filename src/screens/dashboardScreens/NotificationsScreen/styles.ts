import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  notificationsWrap: {
    left: 0,
    right: 0,
  },
  markAllReadWrap: {
    zIndex: 10,
  },
  box: {
    width: 32,
  },
})

export const notificationsSkeletonStyles = StyleSheet.create({
  skeletonLoaderWrap: {
    marginTop: 5,
  },
})
