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
