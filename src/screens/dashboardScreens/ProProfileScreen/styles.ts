import { StyleSheet } from "react-native"

export default StyleSheet.create({
  headerZIndex: { zIndex: 3 },
  heroZIndex: { zIndex: 5 },
  featuredMarginLeft: { marginLeft: -5 },
  fullSize: { width: "100%", height: "100%" },
  modalOverlay: { backgroundColor: "#000000A6" },
  thumbnailSize: { width: 60, height: 60 },
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
