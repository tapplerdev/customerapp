import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';
import dsColors from 'styles/dsColors';

export default StyleSheet.create({
  container: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
  },
  containerSelected: {
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
    backgroundColor: dsColors.redAlpha10,
  },
  containerNotSelected: {
    borderTopColor: colors.grey1,
    borderRightColor: colors.grey1,
    borderBottomColor: colors.grey1,
    borderLeftColor: colors.grey1,
  },
  // NativeWind's `gap-[8]` on the windows' row: the row pulled back 8 left and
  // top, each window pushed 8 left and top (physical sides, as NativeWind
  // wrote them).
  gapRow: {
    marginLeft: -8,
    marginTop: -8,
  },
  gapChild: {
    marginLeft: 8,
    marginTop: 8,
  },
});
