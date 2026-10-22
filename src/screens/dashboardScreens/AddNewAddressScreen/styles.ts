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
    width: 32,
  },
  box2: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
  input: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.black,
    borderBottomWidth: 0.7,
    borderBottomColor: colors.grey19,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  containerSelected: {
    backgroundColor: colors.red,
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
  },
  containerNotSelected: {
    backgroundColor: colors.white,
    borderTopColor: colors.grey1,
    borderRightColor: colors.grey1,
    borderBottomColor: colors.grey1,
    borderLeftColor: colors.grey1,
  },
});
