import {StyleSheet} from 'react-native';
import colors from '@tappler/shared/src/styles/colors';

export default StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
  },
  shadow: {
    left: 8,
    top: 8,
    width: 48,
    height: 48,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  iconWrap: {
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.white,
  },
  shadow2: {
    right: 16,
    bottom: 70,
    width: 44,
    height: 44,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
});

export const mapPickerWithSearchViewStyles = StyleSheet.create({
  row: {
    borderBottomColor: colors.grey8,
  },
  container: {
    backgroundColor: colors.white,
  },
  shadow: {
    right: 16,
    bottom: 46,
    width: 44,
    height: 44,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  iconWrap: {
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.white,
  },
  boxSearchMode: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.white,
  },
  boxNotSearchMode: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  rowSearchMode: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingLeft: 16,
    paddingRight: 16,
    height: 56,
  },
  rowNotSearchMode: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    height: 48,
  },
  rowNotSearchModeResolvingAddress: {
    backgroundColor: colors.grey38,
  },
  dmInputContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderLeftWidth: 0,
  },
  iconWrap2: {
    width: 32,
    height: 32,
  },
});

export const searchViewStyles = StyleSheet.create({
  container: {
    borderBottomColor: colors.grey8,
  },
  dmInputContainer: {
    backgroundColor: colors.grey38,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderLeftWidth: 0,
  },
});
