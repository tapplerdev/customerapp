import React from "react"
import {
  FlatList,
  ScrollView,
  type FlatListProps,
  type ScrollViewProps,
} from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"

/**
 * Scroll primitives that don't rubber-band a page with nothing to scroll.
 *
 * RN defaults alwaysBounceVertical to TRUE on vertical scroll views, so a screen
 * whose content fits still bounces under the finger with nothing to reveal —
 * which reads as the page being loose rather than as a fixed layout.
 *
 * alwaysBounceVertical, NOT bounces: this only removes the bounce when there is
 * nothing to scroll. Long lists keep the end-of-list rubber band, which is
 * standard iOS feel and should stay. (`bounces={false}` kills that too — RN's
 * docs: "disables all bouncing even if the alwaysBounce* props are true".)
 *
 * WHY THIS IS A WRAPPER AND NOT ONE ASSIGNMENT IN index.js
 * -------------------------------------------------------
 * This used to be `ScrollView.defaultProps = { alwaysBounceVertical: false }`.
 *
 * That assignment was LIVE when it was deleted, not already dead. React 18.3.1
 * resolves `type.defaultProps` inside `jsx()` for ANY component type, with no
 * class gate (react/cjs/react-jsx-runtime.development.js:929, and the same loop
 * minified in the production build). So it reached every ScrollView element in
 * the process — ours, FlashList's internal one, any library's. Removing it
 * regresses anything not routed through a wrapper TODAY, which is why the sweep
 * had to be exhaustive rather than best-effort.
 *
 * It had to go because React 19 keeps defaultProps for CLASS components only,
 * and RN has never exported ScrollView's inner class. `ScrollView.js:1899`
 * exports a `component()` wrapper (a forwardRef object once compiled) that
 * merely sets `displayName = 'ScrollView'`. A forwardRef object is outside the
 * class carve-out, so at React 19 the assignment becomes a silent no-op — no
 * warning, no error, every scroll surface just starts bouncing again.
 *
 * A wrapper is the documented replacement, not a workaround:
 *   - react#29233 is this exact question for a third-party component, closed by
 *     React core: "that's the recommended alternative and we're not adding back
 *     defaultProps."
 *   - react-native#51113 is the same bug for Text.defaultProps, where RN core
 *     says "create your own text component ... replace all the imports" and, of
 *     a monkey-patch, "please, don't do that ... You should not tamper with the
 *     internals of core components."
 *
 * THE ONE THING A WRAPPER CANNOT DO is reach a ScrollView that app code never
 * renders. The deleted line covered the whole process; these cover only call
 * sites that import them. Every such surface in this app was found and handled
 * individually (FlashList below, and horizontal pagers which RN already defaults
 * to false), but a NEW library that renders a vertical ScrollView will bounce,
 * and no lint rule can see it. That is the real cost of the change.
 *
 * DO NOT use renderScrollComponent for this. It is documented, but overriding it
 * loses RN's `_isNestedWithSameOrientation()` branch (a private method, so app
 * code cannot reproduce it) which renders a plain <View>, and the automatic
 * onRefresh -> RefreshControl wiring. Pull-to-refresh is the case we must keep.
 *
 * DEFAULT PARAMETER, NOT `{...defaults} {...props}`. A default parameter applies
 * when the prop is `undefined`, which is exactly the condition React's own
 * defaultProps loop tests. A spread does not: the JSX runtime copies every key
 * into props, so `alwaysBounceVertical={someUndefinedVar}` would create the key
 * as undefined, clobber the default and silently restore the bounce.
 *
 * forwardRef IS required, because these wrappers have to work on React 18 as
 * well as 19. Under React 18 a plain function component given a `ref` receives
 * nothing and warns ("Function components cannot be given refs" —
 * ReactFabric-dev.js). Three call sites pass a ref to one of these wrappers:
 * MessagesDetailsScreen (scrollToOffset), FoodMenuScreen (scrollToIndex) and
 * AnimatedSelectCategory (scrollTo). React 19 deprecates forwardRef but keeps it
 * working, so this stays correct across the version bump. (A fourth file,
 * PickAddressScreen, keeps `import type { ScrollView }` for a ref on a
 * reanimated Animated.ScrollView, which is not one of these wrappers.)
 *
 * className MUST BE THREADED THROUGH EXPLICITLY. This is not cosmetic — leaving
 * it in {...rest} silently drops every NativeWind style on these components.
 * NativeWind v2 is a BABEL transform: it rewrites a JSX element that has a
 * className attribute into <StyledComponent component={X} className=... />, and
 * it only does that for elements it recognises as react-native components. An
 * <AppScrollView className="flex-1"> is not one, so it compiled to a plain prop
 * that RN ScrollView ignores. 18 call sites across 10 files were affected, and
 * nothing warned — a collapsed sheet was the only symptom.
 *
 * Passing it as a literal attribute on the INNER component fixes it even though
 * the value is dynamic: the plugin keys on the attribute, not on the value, so
 * the wrapper itself becomes the StyledComponent (verified against the compiled
 * output). The class names at the call sites still register into
 * NativeWindStyleSheet regardless of whether their element was wrapped, so the
 * runtime lookup resolves them.
 *
 * AT THE NATIVEWIND v4 BUMP: no cssInterop is needed here, contrary to what
 * this comment used to say. NativeWind's own guidance is that a custom
 * component forwarding className never needs cssInterop or remapProps — those
 * are for third-party components — and react-native-css-interop's
 * runtime/components.js registers RN's ScrollView (cssInterop) and FlatList
 * (remapProps) out of the box. Since these wrappers hand className to those
 * components, v4 resolves it with no registration. What DOES need registering
 * is reanimated's Animated.View / Animated.Text, and RN's own Animated.*,
 * which are distinct component objects.
 *
 * PULL-TO-REFRESH IS THE EXCEPTION. RefreshControl needs the bounce to reveal its
 * spinner, so on a list short enough to fit there would be nothing to pull.
 * TalabatiScreen and NotificationsScreen pass alwaysBounceVertical explicitly for
 * that reason — do not remove it there.
 */
export const AppScrollView = React.forwardRef<ScrollView, ScrollViewProps>(
  function AppScrollView(
    { alwaysBounceVertical = false, className, ...rest },
    ref,
  ) {
    return (
      <ScrollView
        ref={ref}
        className={className}
        alwaysBounceVertical={alwaysBounceVertical}
        {...rest}
      />
    )
  },
)

/**
 * A plain prop, NOT renderScrollComponent. FlatList destructures only
 * numColumns / columnWrapperStyle / removeClippedSubviews / strictMode
 * (Libraries/Lists/FlatList.js:678) and forwards the rest to VirtualizedList,
 * which spreads them into scrollProps and on to ScrollView
 * (@react-native/virtualized-lists/Lists/VirtualizedList.js:1066,1249). So the
 * prop arrives through the documented "inherits ScrollView props" contract with
 * RN's own three-branch render path untouched.
 */
function AppFlatListInner<ItemT>(
  { alwaysBounceVertical = false, className, ...rest }: FlatListProps<ItemT>,
  ref: React.ForwardedRef<FlatList<ItemT>>,
) {
  return (
    <FlatList<ItemT>
      ref={ref}
      className={className}
      alwaysBounceVertical={alwaysBounceVertical}
      {...rest}
    />
  )
}

/**
 * The standard idiom for a generic forwardRef component, and it IS a real
 * assertion — worth knowing exactly what it trades away before copying it.
 *
 * It is needed because `React.forwardRef`'s own type signature is not
 * generic-preserving: without it every caller collapses to FlatList<unknown> and
 * loses all `data` / `renderItem` checking (verified with a probe — `item.nope`
 * stops erroring).
 *
 * What it asserts is NOT the inner function's signature. The inner function is
 * `(props, ref) => Element`; this declares a one-parameter component. And
 * forwardRef returns an OBJECT (`{$$typeof, render}`), not a callable, so
 * `AppFlatList({...})` type-checks and then throws at runtime. It also drops the
 * exotic-component members, so `AppFlatList.displayName = "..."` will not
 * compile. Use it as JSX only, which is the only way anything uses it here.
 */
export const AppFlatList = React.forwardRef(AppFlatListInner) as <ItemT>(
  props: FlatListProps<ItemT> & React.RefAttributes<FlatList<ItemT>>,
) => React.ReactElement

/**
 * Wraps KeyboardAwareScrollView rather than re-composing its HOC.
 *
 * `listenToKeyboardEvents(AppScrollView)` would also work at runtime — the HOC
 * is a real export of the package index — but it is ABSENT from the bundled
 * index.d.ts in 0.9.5, so it can only be imported untyped. Wrapping the class
 * instead needs no declaration patching: KeyboardAwareScrollViewProps extends
 * ScrollViewProps (index.d.ts:146-148), so alwaysBounceVertical is already
 * accepted and typed.
 *
 * It reaches RN's ScrollView because the HOC spreads `{...this.props}` at
 * KeyboardAwareHOC.js:544, AFTER its own baked-in props (539-543) and before a
 * fixed list of post-spread overrides (545-558) that does not include this one.
 * It is not in the HOC's `static defaultProps` either.
 *
 * This package is dead upstream (last publish 2021) and the migration replaces it
 * with react-native-keyboard-controller, which takes a `ScrollViewComponent` prop
 * instead. This wrapper is the seam where that swap happens.
 */
type AppKeyboardAwareScrollViewProps = React.ComponentProps<
  typeof KeyboardAwareScrollView
>

export const AppKeyboardAwareScrollView = React.forwardRef<
  KeyboardAwareScrollView,
  AppKeyboardAwareScrollViewProps
>(function AppKeyboardAwareScrollView(
  { alwaysBounceVertical = false, className, ...rest },
  ref,
) {
  return (
    <KeyboardAwareScrollView
      ref={ref}
      className={className}
      alwaysBounceVertical={alwaysBounceVertical}
      {...rest}
    />
  )
})
