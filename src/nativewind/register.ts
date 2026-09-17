/**
 * cssInterop registrations for components NativeWind v4 does not know about.
 *
 * Imported once, from App.tsx, BEFORE anything renders. Registration mutates a
 * module-level map keyed by component identity, so a component rendered before
 * its registration runs resolves className to nothing.
 *
 * WHAT DOES *NOT* BELONG HERE
 * ---------------------------
 * Our own wrappers (components/scroll) need nothing. NativeWind's guidance is
 * that a custom component forwarding className never needs cssInterop —
 * that is for third-party components — and react-native-css-interop's
 * runtime/components.js already registers every core primitive we hand
 * className to: View, Text, Image, Pressable, Switch, the Touchables,
 * ActivityIndicator, StatusBar, TextInput and ScrollView via cssInterop, plus
 * FlatList, ImageBackground, KeyboardAvoidingView and VirtualizedList via
 * remapProps, plus safe-area-context's SafeAreaView.
 *
 * WHY Animated.* IS NOT COVERED BY THAT
 * -------------------------------------
 * `cssInterop(View, …)` keys on the View component object. reanimated's
 * `Animated.View` is a DIFFERENT object — createAnimatedComponent(View) — so it
 * inherits nothing from View's registration. Same for RN's own `Animated.*`.
 * Counted across the three repos at the v4 bump: 29 Animated.* tags carrying
 * className (6 here, 18 in proapp, 5 in tappler-shared).
 *
 * The failure mode is silent: className is accepted as an unknown prop,
 * dropped, and the element renders unstyled. Nothing warns.
 */
import Animated from "react-native-reanimated"
import { cssInterop } from "nativewind"

cssInterop(Animated.View, { className: "style" })
cssInterop(Animated.Text, { className: "style" })
cssInterop(Animated.ScrollView, { className: "style" })
