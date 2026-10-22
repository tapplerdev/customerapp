import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  textWrap: {
    backgroundColor: colors.red,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  text: {
    letterSpacing: 0.5,
  },
  container: {
    backgroundColor: colors.white,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
  },
  box: {
    width: 56,
    height: 56,
  },
  image: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  text2: {
    marginLeft: 3,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  row: {
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
  },
  iconWrap2: {
    width: 44,
    height: 44,
  },
  box2: {
    width: 44,
  },
  box3: {
    height: 180,
  },
  yourRequestRow: {
    backgroundColor: colors.red,
    paddingTop: 5,
    paddingBottom: 5,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  textWrap2: {
    width: 22,
    height: 22,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
    marginTop: 1,
  },
  buttonWrap: {
    backgroundColor: colors.white,
    paddingLeft: 15,
    paddingRight: 15,
  },
});
