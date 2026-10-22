import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';
import dsColors from 'styles/dsColors';

/**
 * The pin's parts by size: what the table of 19 class strings drew
 * (`w-[36] h-[36]`, `pb-[42]`, ...). A pin has a round background, a round
 * head with a dot in it, and a stick; `offset` lifts the pin so its tip lands
 * on the map's centre.
 */
export const pinSizes = {
  small: StyleSheet.create({
    background: {width: 36, height: 36},
    pinHead: {width: 20, height: 20},
    pinDot: {width: 4, height: 4, marginTop: 5, marginLeft: 5},
    pinStick: {width: 2, height: 24},
    offset: {paddingBottom: 42},
  }),
  medium: StyleSheet.create({
    background: {width: 46, height: 46},
    pinHead: {width: 28, height: 28},
    pinDot: {width: 6, height: 6, marginTop: 7, marginLeft: 7},
    pinStick: {width: 2, height: 30},
    offset: {paddingBottom: 54},
  }),
  large: StyleSheet.create({
    background: {width: 56, height: 56},
    pinHead: {width: 36, height: 36},
    pinDot: {width: 8, height: 8, marginTop: 9, marginLeft: 9},
    pinStick: {width: 3, height: 36},
    offset: {paddingBottom: 66},
  }),
};

/** The pin's colours (bg-blue2, bg-red6, bg-red7, bg-red6). */
export const pinColors = StyleSheet.create({
  background: {backgroundColor: dsColors.blue2},
  pinHead: {backgroundColor: colors.red6},
  pinDot: {backgroundColor: dsColors.red7},
  pinStick: {backgroundColor: colors.red6},
});

export default StyleSheet.create({
  rounded: {
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  boxWrap: {
    left: 30,
    top: 0,
    right: 30,
    bottom: 0,
  },
  box: {
    paddingBottom: 200,
  },
  textWrap: {
    backgroundColor: colors.grey57,
    height: 64,
    marginBottom: -8,
  },
});
