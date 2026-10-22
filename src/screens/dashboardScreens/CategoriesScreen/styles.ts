import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  row: {
    paddingLeft: 19,
    paddingRight: 19,
    paddingTop: 17,
    paddingBottom: 17,
  },
  box: {
    borderTopColor: colors.grey8,
    borderRightColor: colors.grey8,
    borderBottomColor: colors.grey8,
    borderLeftColor: colors.grey8,
  },
  container: {
    paddingTop: 17,
    paddingBottom: 17,
    paddingLeft: 19,
    paddingRight: 19,
    borderBottomColor: colors.grey8,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  row2: {
    height: 42,
    backgroundColor: colors.white,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  box2: {
    height: 0.5,
    backgroundColor: colors.grey4,
  },
  noResultsFoundWrap: {
    paddingTop: 80,
  },
});
