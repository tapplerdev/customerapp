import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  container: {
    width: 22,
    height: 22,
  },
  textWrap: {
    top: -8,
    right: -12,
    backgroundColor: colors.red,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    minWidth: 18,
    height: 18,
  },
});
