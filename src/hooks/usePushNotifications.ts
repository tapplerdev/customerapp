import { useCallback, useEffect, useRef } from "react"
import { AppState, AppStateStatus } from "react-native"
import { useDispatch } from "react-redux"

import { messageBannerEventBus } from "events/messageBannerEventBus"
import { api, useRegisterNotificationsDeviceMutation } from "services/api"
import { PushNotifications } from "services/PushNotificationService"
import { useTypedSelector } from "store"

/**
 * Owns the push lifecycle for the whole app. Mounted once, in App's
 * RealtimeManager, next to the chat socket — the two are the same concern seen
 * from either side of "is the customer looking at the app right now".
 *
 * Deliberately does not prompt for permission. It registers a token when the
 * customer has already allowed notifications and does nothing when they
 * haven't; the ask lives on RequestSuccessScreen, where there is something to
 * be notified about. See PushNotificationService for why the one iOS prompt is
 * worth protecting.
 */
export const usePushNotifications = (): void => {
  const isAuth = useTypedSelector((store) => store.auth.isAuth)
  const [registerDevice] = useRegisterNotificationsDeviceMutation()
  const dispatch = useDispatch()

  const send = useCallback(
    (registrationToken: string) => registerDevice({ registrationToken }).unwrap(),
    [registerDevice]
  )

  useEffect(() => {
    if (!isAuth) {
      // Signed out: drop the memo of what was registered so signing back in —
      // possibly as a different customer on the same device — actually re-sends
      // instead of short-circuiting on an unchanged token.
      PushNotifications.forgetRegisteredToken()
      return
    }

    PushNotifications.register(send)
    PushNotifications.watchTokenRefresh(send)

    // A push arriving while the app is open has to do everything the socket
    // path does, not just draw a banner.
    //
    // useChatSocket invalidates Notifications on every event and Jobs on
    // system.job:*, and InAppMessageBanner leans on that: it SUPPRESSES the
    // banner when the customer is already looking at the destination screen,
    // reasoning that the cache invalidation updates that screen in front of
    // them. Emitting the banner event alone made that reasoning false — a
    // customer sitting on JobDetailScreen for the very job the push was about
    // got no banner AND no refresh, and went on reading pre-offer data.
    PushNotifications.startForegroundListener((parsed) => {
      dispatch(api.util.invalidateTags(["Notifications"]))
      if (parsed.event.startsWith("system.job:")) {
        dispatch(api.util.invalidateTags(["Jobs"]))
      }
      messageBannerEventBus.emit("notification:new", parsed)
    })

    PushNotifications.startTapListener()

    // No teardown on sign-out: the listeners are process-wide and idempotent
    // (each is a no-op once started), and tearing them down would drop a
    // notification tapped during the moment between logout and re-login. They
    // die with the process, which is the right lifetime for them.
  }, [isAuth, send, dispatch])

  // getToken() rejects outright on iOS until APNs registration has completed,
  // and that registration is fired asynchronously at didFinishLaunching. This
  // hook runs in the first commit inside PersistGate, so it can lose that race
  // — and register() is called exactly once per isAuth flip, with no retry.
  // The result was a customer who had granted permission being silently
  // un-pushable for the entire install.
  //
  // Retrying when the app returns to the foreground costs nothing (register()
  // no-ops once the token is registered, and returns early without permission)
  // and closes the window: by the second foreground, APNs is long since up.
  const registeredRef = useRef(false)
  useEffect(() => {
    if (!isAuth) {
      registeredRef.current = false
      return
    }

    const retry = (state: AppStateStatus) => {
      if (state !== "active" || registeredRef.current) return
      PushNotifications.register(send).then((ok) => {
        registeredRef.current = ok
      })
    }

    const subscription = AppState.addEventListener("change", retry)
    return () => subscription.remove()
  }, [isAuth, send])
}

/**
 * The one place the app asks for notification permission.
 *
 * Returns a callback rather than firing on mount, so the caller controls the
 * moment. iOS allows exactly one system prompt per install; the point of
 * putting it behind a call is that it gets spent somewhere the customer has
 * just done something they'd want to hear back about — not on first launch,
 * where "Tappler would like to send you notifications" is a question about
 * nothing.
 *
 * Fire and forget. It used to be awaited by its caller, which meant the Done
 * button on RequestSuccessScreen sat dead through a permission dialog, a token
 * fetch and a 20s-timeout POST before it would navigate.
 */
export const useRequestPushPermission = (): (() => void) => {
  const isAuth = useTypedSelector((store) => store.auth.isAuth)
  const [registerDevice] = useRegisterNotificationsDeviceMutation()

  return useCallback(() => {
    if (!isAuth) return

    void (async () => {
      // NOT an early return when permission already exists. Registration can
      // fail on its own (see the APNs race above) and this is the only other
      // place that attempts it, so bailing here left a granted-but-unregistered
      // customer with nothing that would ever repair them. register() is
      // cheap and self-deduplicating when there is nothing to do.
      const alreadyAllowed = await PushNotifications.hasPermission()
      const granted =
        alreadyAllowed || (await PushNotifications.requestPermissionWithPrompt())
      if (!granted) return

      await PushNotifications.register((registrationToken) =>
        registerDevice({ registrationToken }).unwrap()
      )
    })()
  }, [isAuth, registerDevice])
}
