import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  textWrap: {
    marginLeft: 36,
  },
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
  mainModalTitle: {
    marginTop: 17,
  },
  mainModalBtns: {
    height: 40,
  },
  mainModalBtnsWrapper: {
    marginLeft: 15,
    marginRight: 15,
  },
  mainModalModal: {
    paddingLeft: 17,
    paddingRight: 17,
  },
});
