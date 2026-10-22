import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  containerModal: {
    paddingLeft: 38,
    paddingRight: 38,
  },
  containerTitle: {
    marginTop: 19,
  },
  containerBtns: {
    height: 34,
  },
  containerCard: {
    paddingTop: 19,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  containerSecondBtn: {
    borderTopColor: colors.black,
    borderRightColor: colors.black,
    borderBottomColor: colors.black,
    borderLeftColor: colors.black,
  },
  containerSecondBtnText: {
    color: colors.red,
  },
});
