import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  box: {
    alignSelf: 'stretch',
  },
  list: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
  },
  box2: {
    width: 22,
    height: 22,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  boxReason: {
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
  },
  boxNotReason: {
    borderTopColor: colors.grey1,
    borderRightColor: colors.grey1,
    borderBottomColor: colors.grey1,
    borderLeftColor: colors.grey1,
  },
  box3: {
    width: 12,
    height: 12,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  input: {
    borderTopColor: colors.grey5,
    borderRightColor: colors.grey5,
    borderBottomColor: colors.grey5,
    borderLeftColor: colors.grey5,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
    fontSize: 13,
    lineHeight: 22,
    minHeight: 70,
  },
});
