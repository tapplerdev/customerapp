import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
  },
  hiThere: {
    color: colors.black1,
  },
  row: {
    height: 51,
    backgroundColor: colors.red,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomLeftRadius: 28,
  },
  row2: {
    height: 51,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
  },
});
