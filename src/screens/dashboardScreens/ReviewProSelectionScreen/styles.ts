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
  imageWrap: {
    width: 90,
    height: 90,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  textWrap: {
    width: 90,
    height: 90,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.grey8,
  },
});
