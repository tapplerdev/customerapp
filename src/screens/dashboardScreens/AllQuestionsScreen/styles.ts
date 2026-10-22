import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  box: {
    height: 1,
    backgroundColor: colors.grey5,
  },
  box2: {
    width: 20,
    height: 20,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  boxSelected: {
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
  },
  boxNotSelected: {
    borderTopColor: colors.grey5,
    borderRightColor: colors.grey5,
    borderBottomColor: colors.grey5,
    borderLeftColor: colors.grey5,
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
  buttonWrap: {
    paddingTop: 17,
    backgroundColor: colors.white,
  },
});
