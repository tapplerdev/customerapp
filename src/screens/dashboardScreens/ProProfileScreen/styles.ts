import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  headerZIndex: { zIndex: 3 },
  // Was a className on an Animated.View. NativeWind v4 cannot style an
  // Animated component — the interop takes over the `style` prop and flattens
  // the useAnimatedStyle output the animation depends on — so these live here
  // instead. See the call site.
  animatedHeader: {
    position: "absolute",
    width: "100%",
    backgroundColor: colors.white,
    borderBottomWidth: 0.3,
    borderColor: colors.grey2,
    overflow: "hidden",
  },
  animatedHeaderInner: { paddingBottom: 12, paddingHorizontal: 16 },
  heroZIndex: { zIndex: 5 },
  featuredMarginLeft: { marginLeft: -5 },
  fullSize: { width: "100%", height: "100%" },
  modalOverlay: { backgroundColor: "#000000A6" },
  thumbnailSize: { width: 60, height: 60 },
  // Mirrors proapp's videoThumbnailOverlay so a video reads the same way in
  // both apps' viewers.
  thumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailBase: {
    width: 60,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
  },
  floatingButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 20,
  },
})
