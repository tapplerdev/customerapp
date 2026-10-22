import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';
import dsColors from 'styles/dsColors';

export default StyleSheet.create({
  row: {
    alignItems: 'baseline',
    marginTop: 3,
  },
  text: {
    color: dsColors.whiteAlpha65,
    textDecorationLine: 'line-through',
    textDecorationColor: dsColors.whiteAlpha65,
  },
  text2: {
    color: dsColors.whiteAlpha90,
  },
  text3: {
    color: colors.white,
  },
  text4: {
    marginTop: 3,
  },
});
