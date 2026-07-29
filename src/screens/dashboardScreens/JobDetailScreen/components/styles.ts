import { StyleSheet } from "react-native"

export default StyleSheet.create({
  proPhoto: {
    width: 85,
    height: 85,
    borderRadius: 8,
  },
  // Plain style rather than a className so the rotate transform is the only
  // transform on the node — nothing here for RTL to fight with.
  detailsChevron: {
    // marginStart, not marginLeft: the row is flex-row, which reverses under
    // forceRTL, so a left margin would put the gap on the outer edge instead of
    // between the label and the chevron.
    marginStart: 6,
  },
})
