import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  container: {
    paddingTop: 80,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  box: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
  row: {
    paddingLeft: 15,
    paddingRight: 15,
    borderTopColor: colors.grey4,
    borderRightColor: colors.grey4,
    borderBottomColor: colors.grey4,
    borderLeftColor: colors.grey4,
  },
  archived: {
    color: colors.grey30,
  },
});

export const messagesSkeletonStyles = StyleSheet.create({
  boxWrap: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 13,
  },
  box: {
    marginRight: 15,
    borderTopColor: colors.grey4,
    borderRightColor: colors.grey4,
    borderBottomColor: colors.grey4,
    borderLeftColor: colors.grey4,
  },
});
