import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  row: {
    zIndex: 10,
  },
  textWrap: {
    top: -8,
    right: -8,
    backgroundColor: colors.red,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    width: 20,
    height: 20,
  },
});

export const presetCardStyles = StyleSheet.create({
  container: {
    width: 100,
    height: 110,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  box: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  textWrap: {
    bottom: 8,
    left: 8,
    right: 8,
  },
  container2: {
    width: 210,
    height: 120,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  textWrap2: {
    bottom: 10,
    left: 10,
    right: 10,
  },
  container3: {
    width: 168,
  },
  boxWrap: {
    height: 63,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 6,
  },
  box2: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 6,
  },
  container4: {
    width: 150,
  },
  boxWrap2: {
    height: 90,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
});
