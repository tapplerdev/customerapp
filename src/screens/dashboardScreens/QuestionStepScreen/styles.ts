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
  boxWrap: {
    height: 3,
    backgroundColor: colors.grey5,
  },
  box: {
    height: 3,
    backgroundColor: colors.red,
  },
  buttonWrap: {
    paddingTop: 17,
    backgroundColor: colors.white,
  },
});
