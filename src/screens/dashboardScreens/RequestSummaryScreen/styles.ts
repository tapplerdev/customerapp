import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  textWrap: {
    backgroundColor: colors.red,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  text: {
    letterSpacing: 0.5,
  },
  container: {
    backgroundColor: colors.white,
    borderTopWidth: RULE_WEIGHT,
    borderRightWidth: RULE_WEIGHT,
    borderBottomWidth: RULE_WEIGHT,
    borderLeftWidth: RULE_WEIGHT,
  },
  box: {
    width: 56,
    height: 56,
  },
  image: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  text2: {
    marginLeft: 3,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    borderTopWidth: RULE_WEIGHT,
    borderRightWidth: RULE_WEIGHT,
    borderBottomWidth: RULE_WEIGHT,
    borderLeftWidth: RULE_WEIGHT,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  row: {
    backgroundColor: colors.white,
    borderBottomWidth: RULE_WEIGHT,
  },
  iconWrap2: {
    width: 44,
    height: 44,
  },
  box2: {
    width: 44,
  },
  box3: {
    height: 180,
  },
  yourRequestRow: {
    backgroundColor: colors.red,
    paddingTop: 5,
    paddingBottom: 5,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  textWrap2: {
    width: 22,
    height: 22,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
    marginTop: 1,
  },
  buttonWrap: {
    backgroundColor: colors.white,
    paddingLeft: 15,
    paddingRight: 15,
  },
})
