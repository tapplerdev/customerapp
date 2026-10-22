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
  notificationsWrap: {
    left: 0,
    right: 0,
  },
  box: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
  text: {
    marginTop: 17,
  },
});
