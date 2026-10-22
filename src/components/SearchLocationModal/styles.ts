import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  box: {
    height: 0.5,
    backgroundColor: colors.grey5,
  },
  list: {
    backgroundColor: colors.white,
  },
  row: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    height: 44,
  },
  row2: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    height: 40,
  },
  container: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grey5,
  },
});
