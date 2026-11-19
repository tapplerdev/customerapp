import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  proPhoto: {
    width: 85,
    height: 85,
    borderRadius: 8,
  },
  // Plain style rather than a className so the rotate transform is the only
  // transform on the node — nothing here for RTL to fight with.
  detailsChevron: {
    // marginStart rather than marginLeft. Not because marginLeft would break:
    // I18nManager.swapLeftAndRightInRTL is never called, so RN's default
    // doLeftAndRightSwapInRTL stays on and feeds marginLeft into YGEdgeStart
    // under RTL anyway — the two are identical today. It is the form that
    // survives a New Architecture migration, where that swap goes away.
    marginStart: 6,
  },
  text: {
    marginTop: 3,
  },
  totalWrap: {
    paddingTop: 5,
    paddingBottom: 5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
  },
  textWrap: {
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  box: {
    height: RULE_WEIGHT,
    backgroundColor: colors.grey19,
  },
  textWrap2: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: colors.pink1,
  },
  box2: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopWidth: RULE_WEIGHT,
    borderRightWidth: RULE_WEIGHT,
    borderBottomWidth: RULE_WEIGHT,
    borderLeftWidth: RULE_WEIGHT,
    borderTopColor: colors.grey14,
    borderRightColor: colors.grey14,
    borderBottomColor: colors.grey14,
    borderLeftColor: colors.grey14,
  },
  box3: {
    height: 2,
  },
  box4: {
    width: 14,
    height: 14,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
})

export const jobMenuSheetStyles = StyleSheet.create({
  box: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  iconWrap: {
    width: 24,
  },
})
