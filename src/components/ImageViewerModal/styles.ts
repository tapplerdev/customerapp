import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';
import dsColors from 'styles/dsColors';

export default StyleSheet.create({
  list: {
    backgroundColor: colors.black,
  },
  iconWrap: {
    zIndex: 10,
    width: 40,
    height: 40,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: dsColors.whiteAlpha20,
  },
  container: {
    marginLeft: 3,
    marginRight: 3,
  },
});
