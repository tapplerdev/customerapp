import { Dimensions, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const imageSize = Dimensions.get("window").width / 3.23

const styles = StyleSheet.create({
  img: {
    width: imageSize,
    height: imageSize,
    backgroundColor: colors.grey4,
    borderRadius: 5,
  },
  outOfStock: {
    opacity: 0.45,
  },
  badgeShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  container: {
    paddingBottom: 23,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grey14,
  },
  text: {
    marginTop: 5,
  },
  row: {
    marginTop: 13,
  },
  eGP: {
    textDecorationLine: "line-through",
  },
  button: {
    alignSelf: "auto",
  },
  box: {
    marginLeft: 21,
  },
  box2: {
    bottom: 8,
    left: 0,
    right: 0,
  },
  row2: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
    height: 30,
  },
  iconWrap: {
    width: 26,
    height: 30,
  },
  iconWrap2: {
    width: 34,
    height: 26,
    backgroundColor: colors.white,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
  },
})

export default styles
