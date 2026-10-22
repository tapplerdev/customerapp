import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  box: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  scrollWrap: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  box2: {
    height: 1,
    backgroundColor: colors.grey5,
  },
  chooseAnotherAddress: {
    marginTop: 3,
  },
});
