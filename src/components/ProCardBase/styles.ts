import { StyleSheet } from "react-native"

export default StyleSheet.create({
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 0.5,
    borderColor: "#B7B7B7",
  },
  profilePhoto: { width: 85, height: 85 },
  featuredBadgeBorder: {
    borderWidth: 0.5,
    borderColor: "#707070",
  },
  offerBadgeBorder: {
    borderWidth: 0.5,
    borderRadius: 12,
  },
  triangleOuter: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#707070",
  },
  triangleInnerWrap: { marginTop: -1 },
  triangleInner: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#E4E4E4",
    zIndex: 1,
  },
  notesBubble: {
    backgroundColor: "#E4E4E4",
    borderWidth: 0.5,
    borderColor: "#707070",
  },
  buttonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  italic: { fontStyle: "italic" },
})
