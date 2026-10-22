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
  row: {
    paddingLeft: 31,
    paddingRight: 31,
  },
  box: {
    paddingTop: 60,
    paddingLeft: 31,
    paddingRight: 31,
  },
  box2: {
    paddingLeft: 35,
    paddingRight: 35,
    paddingTop: 55,
  },
  row2: {
    borderTopColor: colors.grey7,
    borderRightColor: colors.grey7,
    borderBottomColor: colors.grey7,
    borderLeftColor: colors.grey7,
  },
  rowAr: {
    flexDirection: 'row-reverse',
  },
  row3: {
    borderRightWidth: 1,
    borderRightColor: colors.grey7,
    paddingRight: 7,
  },
  rowAr2: {
    flexDirection: 'row-reverse',
    borderRightWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: colors.grey7,
    paddingLeft: 7,
    paddingRight: 0,
  },
  textAr: {
    marginLeft: 2,
    marginRight: 10,
  },
  input: {
    height: 60,
    fontSize: 20,
    lineHeight: 24,
    color: colors.black,
  },
  inputAr: {
    marginLeft: 0,
    marginRight: 8,
  },
  buttonWrap: {
    paddingLeft: 35,
    paddingRight: 35,
  },
});
