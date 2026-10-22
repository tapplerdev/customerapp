import { StyleSheet } from "react-native"
import { a } from "@tappler/shared/src/ds"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
  // `px-[20] py-[12] flex-row items-center self-start`, then `bg-pink`
  // selected or `bg-white`; a caller's className lands after them (the Box
  // slot).
  box: {
    ...a.px_20,
    ...a.py_12,
    ...a.flex_row,
    ...a.items_center,
    ...a.self_start,
  },
  boxSelected: {
    backgroundColor: colors.pink,
  },
  boxIdle: {
    backgroundColor: colors.white,
  },
})

export default styles
