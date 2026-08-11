/**
 * @format
 */

import {AppRegistry, ScrollView} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

// Don't rubber-band a page that has nothing to scroll.
//
// RN defaults alwaysBounceVertical to TRUE on vertical scroll views, so a
// screen whose content fits still bounces under the finger with nothing to
// reveal — which reads as the page being loose rather than as a fixed layout.
// Screens had been opting out of this one at a time with bounces={false}.
//
// alwaysBounceVertical, NOT bounces: this only removes the bounce when there
// is nothing to scroll. Long lists keep the end-of-list rubber band, which is
// standard iOS feel and should stay.
//
// One assignment covers every scroll surface in the app — direct ScrollView,
// KeyboardAwareScrollView (literally listenToKeyboardEvents(ScrollView)),
// FlatList and FlashList all resolve to this same component.
// Safe on React 18.2: defaultProps is only deprecated for FUNCTION components,
// and RN 0.73's ScrollView is a class.
//
// PULL-TO-REFRESH IS THE EXCEPTION. RefreshControl needs the bounce to reveal
// its spinner, so on a list short enough to fit there would be nothing to pull.
// TalabatiScreen and NotificationsScreen pass alwaysBounceVertical explicitly
// for that reason — do not remove it there.
ScrollView.defaultProps = {
  ...ScrollView.defaultProps,
  alwaysBounceVertical: false,
};

AppRegistry.registerComponent(appName, () => App);
