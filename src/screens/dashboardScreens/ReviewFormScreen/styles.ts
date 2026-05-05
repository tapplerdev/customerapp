import { StyleSheet } from "react-native"

export default StyleSheet.create({
  profilePhoto: { width: 100, height: 100 },
  reviewInputBorder: { borderWidth: 1 },
  reviewTextInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: "top",
  },
  photoPreview: { width: 80, height: 80 },
  uploadBorder: { borderWidth: 0.3, borderColor: "#000" },
  modalOverlay: { backgroundColor: "#000000A6" },
  closePosition: { top: 50, left: 18 },
  closeShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  thumbnailsBottom: { bottom: 40 },
  thumbnailBase: {
    width: 60,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
  },
  fullSize: { width: "100%", height: "100%" },
})
