import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  safeArea: {
    paddingLeft: 33,
    paddingRight: 33,
    backgroundColor: colors.white,
  },
  text: {
    marginTop: 11,
  },
  row: {
    marginTop: 21,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  buttonRtl: {
    marginLeft: 10,
    marginRight: 0,
  },
  buttonRtl2: {
    marginRight: 10,
    marginLeft: 0,
  },
  text2: {
    color: colors.grey,
  },
  // font-sans400 names TheSans-Regular, a face the app doesn't ship, so the
  // device draws the system face (latent-bugs/ca-w2-S2.md). Kept as the class
  // wrote it: the style names the face, LegacyText's family="system" adds none.
  arabicNote: {
    marginTop: 32,
    fontSize: 13,
    lineHeight: 22,
    color: colors.grey,
    fontFamily: 'TheSans-Regular',
    textAlign: 'center',
  },
});
