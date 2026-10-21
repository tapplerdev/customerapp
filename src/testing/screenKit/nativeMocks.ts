/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   these build mock modules inside jest.mock factories (setup.ts), which run
   when a module is first asked for, in whichever registry asks. */
/**
 * Jest only. The stand-ins the screen kit puts where a native module or a
 * native view would be (setup.ts registers them). Two rules shape every one:
 *
 * - A native VIEW becomes a host element named after it, carrying every prop
 *   it was given (functions drop out of the host tree anyway), with its
 *   children rendered. A host tree then shows what the screen asked the
 *   library to draw, and a conversion that changes those props fails.
 * - A native MODULE becomes functions that answer like a device that has
 *   said nothing yet: promises that resolve to an empty or granted answer,
 *   or that never settle where a real answer would change the screen on
 *   its own (a thumbnail, a location fix). Nothing reaches the network.
 *
 * Our own components are never mocked here; data comes from the store and
 * backend kits (store.ts, backend.ts).
 */
import type React from "react"

type Props = Record<string, unknown> & { children?: React.ReactNode }

const noop = () => undefined
const resolved =
  <T>(value: T) =>
  () =>
    Promise.resolve(value)
/** A promise that never settles: the screen stays where it was before the answer. */
const pending = () =>
  new Promise<never>(() => {
    // never settles
  })

/** A ref whose every method is a no-op (map.animateToRegion, list.scrollToIndex...). */
const inertHandle = () =>
  new Proxy(
    {},
    {
      get: (_target, key) => (key === "then" ? undefined : noop),
    }
  )

/**
 * A host element named `name` with every prop and the children, plus a ref
 * whose methods do nothing. `omit` names props the real view consumes
 * itself (a Lottie animation's JSON) so they don't flood the tree.
 */
export const host = (name: string, omit: string[] = []) => {
  const R = require("react") as typeof React
  const Host = R.forwardRef((props: Props, ref) => {
    R.useImperativeHandle(ref, inertHandle)
    const rest: Props = {}
    Object.keys(props).forEach((key) => {
      if (!omit.includes(key)) rest[key] = props[key]
    })
    const { children } = rest
    return R.createElement(
      name,
      rest,
      typeof children === "function" ? null : (children as React.ReactNode)
    )
  })
  Host.displayName = name
  return Host
}

// ---------------------------------------------------------------------------
// React Native's Modal

type ModalProps = Props & { visible?: boolean; onDismiss?: () => void }
type ModalClass = new (props: ModalProps) => React.Component<ModalProps>

/**
 * React Native's Modal as its own jest mock draws it (`base`, from
 * @react-native/jest-preset: a `Modal` host with every prop while visible,
 * nothing once `visible` is false), plus what iOS does when a shown modal is
 * told to hide: UIKit dismisses it and React Native reports that through
 * `onDismiss` (Modal.js, iOS only). Without the report, shared's
 * useNativeModalVisibility waited out its 2 s backstop after every close, so
 * a card opened once another one closed needed a long wait. The dismiss
 * animation isn't modelled: the report comes right after the closing commit,
 * in a microtask (the kit's settle flushes it). Android's Modal has no
 * dismiss callback in RN 0.86, so there it stays silent, as the device does,
 * and so does an unmount with the modal up.
 */
export const modal = (base: { default: ModalClass }) => {
  const Base = base.default
  class Modal extends Base {
    mounted = false

    componentDidMount() {
      super.componentDidMount?.()
      this.mounted = true
    }

    componentWillUnmount() {
      this.mounted = false
      super.componentWillUnmount?.()
    }

    componentDidUpdate(previous: ModalProps) {
      super.componentDidUpdate?.(previous, this.state)
      const { Platform } = require("react-native") as {
        Platform: { OS: string }
      }
      if (Platform.OS !== "ios") return
      // `visible` defaults to true, as React Native's does.
      if (previous.visible === false || this.props.visible !== false) return
      queueMicrotask(() => {
        if (this.mounted) this.props.onDismiss?.()
      })
    }
  }
  return { __esModule: true, default: Modal }
}

// ---------------------------------------------------------------------------
// react-native-reanimated

/**
 * A layout animation (FadeIn, FadeInDown.duration(300).delay(50), ...): any
 * builder call returns another builder. The animated components below drop
 * `entering`/`exiting`/`layout` as the real ones do (they never reach the
 * native view), so a builder is never drawn.
 */
const builder = (name: string): unknown =>
  new Proxy(
    function animationBuilder() {
      return undefined
    },
    {
      get: (_target, key) => {
        if (key === "toString") return () => name
        if (key === Symbol.toPrimitive) return () => name
        if (key === "then") return undefined
        return () => builder(name)
      },
      apply: () => builder(name),
      construct: () => builder(name) as object,
    }
  )

/** Props an Animated component consumes and never hands its view. */
const REANIMATED_ONLY = [
  "entering",
  "exiting",
  "layout",
  "sharedTransitionTag",
  "sharedTransitionStyle",
]

const sharedValue = <T>(initial: T) => {
  const box = {
    value: initial,
    get: () => box.value,
    set: (next: T | ((current: T) => T)) => {
      box.value =
        typeof next === "function"
          ? (next as (current: T) => T)(box.value)
          : next
    },
    modify: (fn?: (current: T) => T) => {
      if (fn) box.value = fn(box.value)
    },
    addListener: noop,
    removeListener: noop,
  }
  return box
}

const interpolateNumber = (
  value: number,
  input: number[],
  output: number[],
  extrapolate?: unknown
) => {
  const clamp =
    extrapolate === "clamp" ||
    (typeof extrapolate === "object" &&
      extrapolate !== null &&
      (extrapolate as Record<string, unknown>).extrapolateLeft === "clamp")
  if (value <= input[0]) {
    if (clamp || input.length < 2) return output[0]
  }
  for (let i = 1; i < input.length; i += 1) {
    if (value <= input[i] || i === input.length - 1) {
      if (value > input[i] && clamp) return output[i]
      const span = input[i] - input[i - 1]
      const t = span === 0 ? 0 : (value - input[i - 1]) / span
      return output[i - 1] + t * (output[i] - output[i - 1])
    }
  }
  return output[output.length - 1]
}

export const reanimated = () => {
  const R = require("react") as typeof React
  const RN = require("react-native")
  const createAnimatedComponent = (Component: React.ComponentType<Props>) => {
    const Animated = R.forwardRef((props: Props, ref) => {
      const rest: Props = {}
      Object.keys(props).forEach((key) => {
        if (!REANIMATED_ONLY.includes(key) && key !== "animatedProps") {
          rest[key] = props[key]
        }
      })
      const animatedProps = props.animatedProps as Props | undefined
      return R.createElement(Component, { ...rest, ...animatedProps, ref })
    })
    Animated.displayName = `Animated(${
      (Component as { displayName?: string }).displayName ??
      (Component as { name?: string }).name ??
      "Component"
    })`
    return Animated
  }
  const Animated = {
    View: createAnimatedComponent(RN.View),
    Text: createAnimatedComponent(RN.Text),
    ScrollView: createAnimatedComponent(RN.ScrollView),
    Image: createAnimatedComponent(RN.Image),
    FlatList: createAnimatedComponent(RN.FlatList),
    createAnimatedComponent,
  }
  const useSharedValue = <T>(initial: T) => {
    const ref = R.useRef<ReturnType<typeof sharedValue<T>> | null>(null)
    if (ref.current === null) ref.current = sharedValue(initial)
    return ref.current
  }
  const known: Record<string, unknown> = {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue,
    makeMutable: sharedValue,
    isSharedValue: (value: unknown) =>
      typeof value === "object" &&
      value !== null &&
      "value" in value &&
      "get" in value,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedProps: (fn: () => unknown) => fn(),
    useDerivedValue: (fn: () => unknown) => {
      const value = fn()
      return { value, get: () => value, set: noop }
    },
    useAnimatedRef: () => R.useRef(null),
    useAnimatedReaction: noop,
    useAnimatedScrollHandler: () => noop,
    // Gesture handler's GestureDetector reaches these when Reanimated is
    // installed (its reanimatedWrapper).
    useEvent: () => noop,
    useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
    useComposedEventHandler: () => noop,
    setGestureState: noop,
    useAnimatedGestureHandler: () => noop,
    useScrollViewOffset: () => useSharedValue(0),
    useScrollOffset: () => useSharedValue(0),
    useFrameCallback: () => ({ setActive: noop, isActive: false }),
    useReducedMotion: () => false,
    useAnimatedKeyboard: () => ({
      height: sharedValue(0),
      state: sharedValue(0),
    }),
    withTiming: (to: unknown) => to,
    withSpring: (to: unknown) => to,
    withDecay: () => 0,
    withDelay: (_delay: number, animation: unknown) => animation,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) =>
      animations[animations.length - 1],
    withClamp: (_config: unknown, animation: unknown) => animation,
    cancelAnimation: noop,
    runOnJS:
      (fn: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        fn(...args),
    runOnUI:
      (fn: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        fn(...args),
    scrollTo: noop,
    measure: () => null,
    getRelativeCoords: () => null,
    interpolate: interpolateNumber,
    // The first colour: what an animation that starts at its first input shows.
    interpolateColor: (value: number, input: number[], output: unknown[]) =>
      value >= input[input.length - 1] ? output[output.length - 1] : output[0],
    Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
    Extrapolate: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
    ReduceMotion: { System: "system", Always: "always", Never: "never" },
    SensorType: {},
    KeyboardState: {},
    Easing: new Proxy(
      {},
      {
        get:
          () =>
          (...args: unknown[]) =>
            typeof args[0] === "function" ? args[0] : (t: number) => t,
      }
    ),
    Keyframe: function Keyframe() {
      return builder("Keyframe")
    },
    enableLayoutAnimations: noop,
    configureReanimatedLogger: noop,
    ReanimatedLogLevel: { warn: 1, error: 2 },
  }
  // Any other export a screen names is a layout animation builder
  // (FadeInDown, ZoomIn, LinearTransition, ...).
  return new Proxy(known, {
    get: (target, key) => {
      if (typeof key !== "string" || key in target) {
        return target[key as string]
      }
      return /^[A-Z]/.test(key) ? builder(key) : undefined
    },
  })
}

// ---------------------------------------------------------------------------
// react-native-worklets

export const worklets = () => ({
  __esModule: true,
  scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    fn(...args),
  scheduleOnUI: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
    fn(...args),
  runOnJS:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
  runOnUI:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
  createWorkletRuntime: () => ({}),
  isWorkletFunction: () => false,
})

// ---------------------------------------------------------------------------
// Lists and pagers that measure themselves natively: every item, in order.

type ListProps = Props & {
  data?: readonly unknown[] | null
  renderItem?: (info: {
    item: unknown
    index: number
    target?: string
  }) => React.ReactNode
  keyExtractor?: (item: unknown, index: number) => string
  ListHeaderComponent?: React.ReactNode | React.ComponentType
  ListFooterComponent?: React.ReactNode | React.ComponentType
  ListEmptyComponent?: React.ReactNode | React.ComponentType
  ItemSeparatorComponent?: React.ComponentType | null
}

const element = (R: typeof React, value: unknown) => {
  if (!value) return null
  if (R.isValidElement(value)) return value
  return R.createElement(value as React.ComponentType)
}

/**
 * FlashList draws only what it has measured, which under jest is nothing;
 * this stand-in draws its header, every item (with the separators), the
 * empty component when there are none, and its footer, inside a host
 * `FlashList` that keeps the list's own props (contentContainerStyle...).
 */
const listHost = (name: string) => {
  const R = require("react") as typeof React
  const List = R.forwardRef((props: ListProps, ref) => {
    R.useImperativeHandle(ref, inertHandle)
    const {
      data,
      renderItem,
      keyExtractor,
      ListHeaderComponent,
      ListFooterComponent,
      ListEmptyComponent,
      ItemSeparatorComponent,
      ...rest
    } = props
    const items = data ?? []
    const children: React.ReactNode[] = []
    const header = element(R, ListHeaderComponent)
    if (header) children.push(R.cloneElement(header, { key: "$header" }))
    if (items.length === 0) {
      const empty = element(R, ListEmptyComponent)
      if (empty) children.push(R.cloneElement(empty, { key: "$empty" }))
    }
    items.forEach((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : String(index)
      if (index > 0 && ItemSeparatorComponent) {
        children.push(
          R.createElement(ItemSeparatorComponent, { key: `$sep-${key}` })
        )
      }
      children.push(
        R.createElement(
          R.Fragment,
          { key },
          renderItem ? renderItem({ item, index, target: "Cell" }) : null
        )
      )
    })
    const footer = element(R, ListFooterComponent)
    if (footer) children.push(R.cloneElement(footer, { key: "$footer" }))
    return R.createElement(name, rest, children)
  })
  List.displayName = name
  return List
}

export const flashList = () => {
  const R = require("react") as typeof React
  return {
    __esModule: true,
    FlashList: listHost("FlashList"),
    // State that resets when a recycled cell shows another item: here,
    // plain state (cells are never recycled).
    useRecyclingState: <T>(initial: T | (() => T)) => R.useState(initial),
    useLayoutState: <T>(initial: T | (() => T)) => R.useState(initial),
    useMappingHelper: () => ({
      getMappingKey: (key: unknown) => String(key),
    }),
  }
}

export const carousel = () => ({
  __esModule: true,
  default: listHost("Carousel"),
})

/** react-native-sortables: Grid and Flex draw every item; Handle and Touchable their children. */
export const sortables = () => {
  const R = require("react") as typeof React
  const passthrough = (name: string) => {
    const Component = ({ children }: Props) =>
      R.createElement(R.Fragment, null, children)
    Component.displayName = name
    return Component
  }
  const Sortable = {
    Grid: listHost("SortableGrid"),
    Flex: host("SortableFlex"),
    Handle: passthrough("SortableHandle"),
    Touchable: host("SortableTouchable"),
    Layer: passthrough("SortableLayer"),
  }
  return { __esModule: true, default: Sortable, ...Sortable }
}

// ---------------------------------------------------------------------------
// Native views

export const maps = () => {
  const MapView = host("MapView")
  return {
    __esModule: true,
    default: MapView,
    MapView,
    Marker: host("Marker"),
    Callout: host("Callout"),
    Circle: host("Circle"),
    Polygon: host("Polygon"),
    Polyline: host("Polyline"),
    Overlay: host("Overlay"),
    Heatmap: host("Heatmap"),
    Geojson: host("Geojson"),
    UrlTile: host("UrlTile"),
    PROVIDER_GOOGLE: "google",
    PROVIDER_DEFAULT: undefined,
    MAP_TYPES: { STANDARD: "standard", SATELLITE: "satellite" },
    AnimatedRegion: function AnimatedRegion(region: object) {
      return { ...region, timing: () => ({ start: noop }) }
    },
  }
}

export const linearGradient = () => {
  const LinearGradient = host("LinearGradient")
  return { __esModule: true, default: LinearGradient, LinearGradient }
}

export const lottie = () => {
  const R = require("react") as typeof React
  const Lottie = R.forwardRef((props: Props, ref) => {
    R.useImperativeHandle(ref, inertHandle)
    const { source, children, ...rest } = props
    // The animation itself is a JSON document: named, not drawn.
    const named =
      typeof source === "object" && source !== null
        ? ((source as Record<string, unknown>).nm ??
          (source as Record<string, unknown>).uri ??
          "animation")
        : source
    return R.createElement("LottieView", { ...rest, source: named }, children)
  })
  Lottie.displayName = "LottieView"
  return { __esModule: true, default: Lottie }
}

export const fastImage = () => {
  const FastImage = host("FastImage") as unknown as Record<string, unknown>
  FastImage.priority = { low: "low", normal: "normal", high: "high" }
  FastImage.cacheControl = {
    immutable: "immutable",
    web: "web",
    cacheOnly: "cacheOnly",
  }
  FastImage.resizeMode = {
    contain: "contain",
    cover: "cover",
    stretch: "stretch",
    center: "center",
  }
  FastImage.preload = noop
  FastImage.clearMemoryCache = resolved(undefined)
  FastImage.clearDiskCache = resolved(undefined)
  return {
    __esModule: true,
    default: FastImage,
    Priority: FastImage.priority,
    ResizeMode: FastImage.resizeMode,
    CacheControl: FastImage.cacheControl,
  }
}

export const video = () => ({ __esModule: true, default: host("Video") })

export const webview = () => {
  const WebView = host("WebView")
  return { __esModule: true, default: WebView, WebView }
}

export const dropShadow = () => ({
  __esModule: true,
  default: host("DropShadow"),
})

export const slider = () => ({ __esModule: true, default: host("Slider") })

export const datePicker = () => ({
  __esModule: true,
  default: host("DatePicker"),
})

export const colorMatrixFilters = () =>
  new Proxy({ __esModule: true } as Record<string, unknown>, {
    get: (target, key) =>
      typeof key === "string" && /^[A-Z]/.test(key)
        ? host(key)
        : target[key as string],
  })

export const svgUri = () => ({ __esModule: true, default: host("SvgUri") })

export const cropTools = () => ({
  __esModule: true,
  CropView: host("CropView"),
})

export const gestureImageViewer = () => ({
  __esModule: true,
  GestureViewer: host("GestureViewer"),
  useGestureViewerController: () => ({
    goToIndex: noop,
    goToPrevious: noop,
    goToNext: noop,
    resetZoom: noop,
    zoomIn: noop,
    zoomOut: noop,
    rotate: noop,
  }),
  useGestureViewerState: () => ({ currentIndex: 0, totalCount: 0 }),
  useGestureViewerEvent: noop,
  registerGestureViewer: noop,
})

export const visionCamera = () => ({
  __esModule: true,
  Camera: host("Camera"),
  useCameraDevice: () => undefined,
  useCameraDevices: () => [],
  useCameraFormat: () => undefined,
  useCameraPermission: () => ({
    hasPermission: true,
    requestPermission: resolved(true),
  }),
  useMicrophonePermission: () => ({
    hasPermission: true,
    requestPermission: resolved(true),
  }),
  useFrameOutput: () => ({}),
  usePhotoOutput: () => ({ capturePhoto: pending }),
  useFrameProcessor: () => undefined,
  CommonResolutions: new Proxy({}, { get: (_t, key) => String(key) }),
})

export const visionCameraCropper = () => ({
  __esModule: true,
  crop: pending,
})

/**
 * paymob-reactnative as its src/index.js exports it (pinned against that
 * file by screenKit.parity.tsx): the SDK module, the embedded card form and
 * its commands, and the two enums. No charge is ever made: the setters do
 * nothing, presentPayVC presents nothing, and nothing ever calls the
 * transaction listener or the form's outcome events.
 */
export const paymob = () => {
  // The default export: the SDK's own screen and its settings. Each returns
  // nothing, as the SDK's do (the outcome comes through setSdkListener).
  const Paymob = {
    setAppIcon: noop,
    setAppName: noop,
    setButtonBackgroundColor: noop,
    setButtonTextColor: noop,
    setSaveCardDefault: noop,
    setShowSaveCard: noop,
    setShowConfirmationPage: noop,
    setShowTransactionResult: noop,
    setKeyboardHandlingEnabled: noop,
    setFailureCallbackVersion: noop,
    presentPayVC: noop,
    setSdkListener: noop,
    removeSdkListener: noop,
  }
  return {
    __esModule: true,
    default: Paymob,
    // The embedded card form: a native view (requireNativeComponent), so a
    // host under its own name, carrying its props.
    PaymobCheckoutView: host("PaymobCheckoutView"),
    // Its commands, each taking the mounted view's ref: a device that does
    // nothing with them.
    PaymobCheckout: {
      configure: noop,
      setPaymentKeys: noop,
      payFromOutside: noop,
      revealValidationErrors: noop,
    },
    PaymentStatus: {
      SUCCESS: "Success",
      FAIL: "Fail",
      CANCELLED: "Cancelled",
      PENDING: "Pending",
    },
    FailureCallBackVersion: { V1: "V1", V2: "V2" },
  }
}

// ---------------------------------------------------------------------------
// Native modules

export const mmkv = () => {
  // One in-memory store per registry, cleared and seeded per render by the
  // kit (store.ts), shared by every createMMKV() instance as the device's
  // default instance is.
  const values = new Map<string, string | number | boolean>()
  const instance = () => ({
    set: (key: string, value: string | number | boolean) => {
      values.set(key, value)
    },
    getString: (key: string) => {
      const value = values.get(key)
      return typeof value === "string" ? value : undefined
    },
    getNumber: (key: string) => {
      const value = values.get(key)
      return typeof value === "number" ? value : undefined
    },
    getBoolean: (key: string) => {
      const value = values.get(key)
      return typeof value === "boolean" ? value : undefined
    },
    contains: (key: string) => values.has(key),
    remove: (key: string) => values.delete(key),
    delete: (key: string) => values.delete(key),
    getAllKeys: () => [...values.keys()],
    clearAll: () => values.clear(),
    addOnValueChangedListener: () => ({ remove: noop }),
    recrypt: noop,
    trim: noop,
    size: 0,
  })
  return {
    __esModule: true,
    createMMKV: instance,
    MMKV: function MMKV() {
      return instance()
    },
    useMMKVString: (key: string) => [instance().getString(key), noop],
    useMMKVBoolean: (key: string) => [instance().getBoolean(key), noop],
    useMMKVNumber: (key: string) => [instance().getNumber(key), noop],
    /** The kit's handle on the store (store.ts). */
    __screenKitValues: values,
  }
}

export const notifee = () => {
  const notifeeModule = {
    requestPermission: resolved({ authorizationStatus: 1 }),
    getNotificationSettings: resolved({ authorizationStatus: 1 }),
    createChannel: resolved("default"),
    displayNotification: resolved("id"),
    cancelNotification: resolved(undefined),
    cancelAllNotifications: resolved(undefined),
    setBadgeCount: resolved(undefined),
    getBadgeCount: resolved(0),
    onForegroundEvent: () => noop,
    onBackgroundEvent: noop,
    getInitialNotification: resolved(null),
    openNotificationSettings: resolved(undefined),
  }
  return {
    __esModule: true,
    default: notifeeModule,
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2, MIN: 1, NONE: 0 },
    AuthorizationStatus: {
      NOT_DETERMINED: -1,
      DENIED: 0,
      AUTHORIZED: 1,
      PROVISIONAL: 2,
    },
    EventType: {
      UNKNOWN: -1,
      DISMISSED: 0,
      PRESS: 1,
      ACTION_PRESS: 2,
      DELIVERED: 3,
    },
  }
}

export const firebaseMessaging = () => {
  const messaging = {}
  return {
    __esModule: true,
    default: () => messaging,
    getMessaging: () => messaging,
    getToken: pending,
    deleteToken: resolved(undefined),
    onMessage: () => noop,
    onTokenRefresh: () => noop,
    onNotificationOpenedApp: () => noop,
    getInitialNotification: resolved(null),
    requestPermission: resolved(1),
    hasPermission: resolved(1),
    registerDeviceForRemoteMessages: resolved(undefined),
    setBackgroundMessageHandler: noop,
    AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0, NOT_DETERMINED: -1 },
  }
}

export const firebaseAuth = () => {
  const auth = { currentUser: null }
  return {
    __esModule: true,
    default: () => auth,
    getAuth: () => auth,
    GoogleAuthProvider: { credential: () => ({}) },
    signInWithCredential: pending,
    signOut: resolved(undefined),
    onAuthStateChanged: () => noop,
  }
}

export const firebaseApp = () => ({
  __esModule: true,
  default: { app: () => ({}) },
  getApp: () => ({}),
  initializeApp: resolved({}),
})

export const googleSignin = () => ({
  __esModule: true,
  GoogleSignin: {
    configure: noop,
    hasPlayServices: resolved(true),
    signIn: pending,
    signInSilently: pending,
    signOut: resolved(null),
    revokeAccess: resolved(null),
    getCurrentUser: () => null,
    hasPreviousSignIn: () => false,
  },
  isSuccessResponse: (response: { type?: string }) =>
    response?.type === "success",
  isErrorWithCode: () => false,
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
  GoogleSigninButton: host("GoogleSigninButton"),
})

export const geolocation = () => {
  const Geolocation = {
    getCurrentPosition: noop,
    watchPosition: () => 0,
    clearWatch: noop,
    stopObserving: noop,
    requestAuthorization: noop,
    setRNConfiguration: noop,
  }
  return { __esModule: true, default: Geolocation, ...Geolocation }
}

export const netinfo = () => {
  const state = {
    type: "wifi",
    isConnected: true,
    isInternetReachable: true,
    details: { isConnectionExpensive: false },
  }
  const NetInfo = {
    fetch: resolved(state),
    refresh: resolved(state),
    addEventListener: () => noop,
    configure: noop,
    useNetInfo: () => state,
  }
  return {
    __esModule: true,
    default: NetInfo,
    ...NetInfo,
    useNetInfoInstance: () => ({ netInfo: state, refresh: resolved(state) }),
    NetInfoStateType: {
      unknown: "unknown",
      none: "none",
      cellular: "cellular",
      wifi: "wifi",
    },
  }
}

export const clipboard = () => {
  const Clipboard = {
    setString: noop,
    getString: resolved(""),
    hasString: resolved(false),
    addListener: () => ({ remove: noop }),
  }
  return { __esModule: true, default: Clipboard, ...Clipboard }
}

export const cameraRoll = () => ({
  __esModule: true,
  CameraRoll: {
    save: pending,
    saveAsset: pending,
    getPhotos: resolved({ edges: [], page_info: { has_next_page: false } }),
  },
})

export const documentPicker = () => ({
  __esModule: true,
  pick: pending,
  keepLocalCopy: pending,
  isErrorWithCode: () => false,
  errorCodes: { OPERATION_CANCELED: "OPERATION_CANCELED" },
  types: new Proxy({}, { get: (_t, key) => String(key) }),
})

export const imageCropPicker = () => {
  const picker = {
    openPicker: pending,
    openCamera: pending,
    openCropper: pending,
    clean: resolved(undefined),
    cleanSingle: resolved(undefined),
  }
  return { __esModule: true, default: picker, ...picker }
}

export const blobUtil = () => {
  const blob = {
    fs: {
      dirs: { DocumentDir: "/docs", CacheDir: "/cache", DownloadDir: "/dl" },
      exists: resolved(false),
      unlink: resolved(undefined),
      readFile: pending,
      writeFile: pending,
    },
    config: () => ({ fetch: pending }),
    fetch: pending,
    ios: { openDocument: noop, previewDocument: noop },
    android: { actionViewIntent: noop, addCompleteDownload: noop },
  }
  return { __esModule: true, default: blob }
}

export const compressor = () => ({
  __esModule: true,
  Image: { compress: pending },
  Video: { compress: pending },
  getVideoMetaData: pending,
})

export const createThumbnail = () => ({
  __esModule: true,
  // Never settles: a thumbnail stays on its skeleton, the same every run.
  createThumbnail: pending,
})

export const pdfThumbnail = () => ({
  __esModule: true,
  default: { generate: pending, generateAllPages: pending },
})

export const hapticFeedback = () => {
  const module = { trigger: noop }
  return {
    __esModule: true,
    default: module,
    trigger: noop,
    HapticFeedbackTypes: new Proxy({}, { get: (_t, key) => String(key) }),
  }
}

export const orientationLocker = () => ({
  __esModule: true,
  default: {
    lockToPortrait: noop,
    lockToLandscape: noop,
    unlockAllOrientations: noop,
    getDeviceOrientation: noop,
    getOrientation: noop,
    addDeviceOrientationListener: noop,
    removeDeviceOrientationListener: noop,
    addOrientationListener: noop,
    removeOrientationListener: noop,
  },
  OrientationType: {
    PORTRAIT: "PORTRAIT",
    "LANDSCAPE-LEFT": "LANDSCAPE-LEFT",
    "LANDSCAPE-RIGHT": "LANDSCAPE-RIGHT",
  },
})

export const restart = () => {
  const RNRestart = { restart: noop, Restart: noop }
  return { __esModule: true, default: RNRestart }
}

export const bootsplash = () => ({
  __esModule: true,
  default: { hide: resolved(undefined), isVisible: resolved(false) },
})

export const geocoding = () => ({
  __esModule: true,
  default: { init: noop, from: pending, isInit: () => true },
})

/** socket.io: a socket that never connects (the app's WebSocketService stays offline). */
export const socketIo = () => {
  const socket = () => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
    const self = {
      connected: false,
      disconnected: true,
      id: undefined,
      on: (event: string, fn: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set())
        listeners.get(event)!.add(fn)
        return self
      },
      once: () => self,
      off: (event?: string, fn?: (...args: unknown[]) => void) => {
        if (event && fn) listeners.get(event)?.delete(fn)
        else if (event) listeners.delete(event)
        return self
      },
      removeAllListeners: () => {
        listeners.clear()
        return self
      },
      emit: () => self,
      connect: () => self,
      disconnect: () => self,
      close: () => self,
      io: { on: noop, off: noop, opts: {} },
      auth: {},
    }
    return self
  }
  return { __esModule: true, default: socket, io: socket }
}
