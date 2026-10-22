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
  text: {
    color: colors.grey15,
    borderBottomWidth: 0.7,
    borderBottomColor: colors.grey19,
  },
});
