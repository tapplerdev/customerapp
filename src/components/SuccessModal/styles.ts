import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  box: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    marginLeft: 19,
    marginRight: 19,
    paddingLeft: 39,
    paddingRight: 39,
    alignSelf: 'stretch',
  },
  text: {
    marginTop: 11,
  },
  text2: {
    marginTop: 7,
  },
  button: {
    marginTop: 17,
  },
});
