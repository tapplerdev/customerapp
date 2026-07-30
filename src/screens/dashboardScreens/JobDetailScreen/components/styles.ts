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
    // marginStart rather than marginLeft. Not because marginLeft would break:
    // I18nManager.swapLeftAndRightInRTL is never called, so RN's default
    // doLeftAndRightSwapInRTL stays on and feeds marginLeft into YGEdgeStart
    // under RTL anyway — the two are identical today. It is the form that
    // survives a New Architecture migration, where that swap goes away.
    marginStart: 6,
  },
})
