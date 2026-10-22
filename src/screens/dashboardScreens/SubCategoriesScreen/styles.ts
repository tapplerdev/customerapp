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
  safeArea: {
    backgroundColor: colors.white,
  },
  row2: {
    paddingTop: 17,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  box2: {
    width: 32,
  },
  box3: {
    height: 1,
    backgroundColor: colors.grey4,
  },
});
