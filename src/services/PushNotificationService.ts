/**
 * PushNotificationService — singleton
 *
 * The customer app shipped with @react-native-firebase/messaging and
 * @notifee/react-native in package.json, a GoogleService-Info.plist in the iOS
 * project, and `[FIRApp configure]` in AppDelegate.mm — and not one line of
 * JavaScript that used any of it. No token was ever requested, so none was ever
 * sent to POST /notifications/registration-token.
 *
 * The backend half was already finished and already customer-aware:
 * `@UseAuth([AuthUserType.pro, AuthUserType.customer])` on the registration
 * endpoint, and PushNotificationService.sendPushNotification keyed on
 * {userId, userType} with no pro-specific branch anywhere in it. Every
 * notification listener follows the same shape —
 *
 *     isConnected ? socketGateway.send(...) : pushNotificationService.send(...)
 *
 * — so a customer with the app closed took the push branch, the backend looked
 * for their registration token, found no row, logged
 * "User doesn't have a registration token", and returned. Every offer, every
 * order status change, every message to a backgrounded customer went nowhere.
 * It looked like a backend bug and was a missing client.
 *
 * ---
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It never calls requestPermission() on its own. iOS gives an app exactly
 *    one system prompt; once it's dismissed with Don't Allow, no API brings it
 *    back and the user has to go find it in Settings. Asking on launch, before
 *    the customer has any reason to want notifications, spends that one shot at
 *    the worst possible moment. The ask lives at the point where the value is
 *    self-evident — see requestPermissionWithPrompt's callers.
 *
 * 2. It never assumes Firebase is initialised. Android has no
 *    android/app/google-services.json and no google-services Gradle plugin, so
 *    `messaging()` there throws "No Firebase App '[DEFAULT]' has been created".
 *    Every entry point is guarded and the failure is remembered, so the app
 *    behaves exactly as it does today on Android — no push, no crash — and
 *    starts working the moment those native files land, with no JS change.
 */

import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging"
import { destinationFor } from "components/InAppMessageBanner/InAppMessageBanner"
import { navigateFromRef } from "navigation/navigationRef"

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage

/**
 * Exactly the shape useChatSocket emits on "notification:new", so a
 * notification looks and behaves the same whichever channel delivered it.
 */
export type ParsedNotification = {
  event: string
  title: string
  body: string
  jobId?: number
  jobStatus?: string
  foodStatus?: string
}

/**
 * RN Firebase types `data` as `{ [key: string]: string | object }` because FCM
 * can nest, but the backend only ever puts strings there (`event` and a
 * JSON.stringify'd `payload`). Read it as a string or not at all rather than
 * casting the whole message.
 */
const dataString = (
  message: RemoteMessage,
  key: string
): string | undefined => {
  const value = message.data?.[key]
  return typeof value === "string" ? value : undefined
}

class PushNotificationServiceClass {
  /**
   * Set once the native module has been proven missing. Without it, every
   * notification on Android would pay for a throwing native call and print a
   * stack trace that looks like a real error.
   */
  private unavailable = false

  private foregroundUnsubscribe: (() => void) | null = null
  private tokenRefreshUnsubscribe: (() => void) | null = null
  private tapUnsubscribe: (() => void) | null = null

  /** The last token handed to the backend, so a refresh that isn't one is a no-op. */
  private registeredToken: string | null = null

  private isAvailable(): boolean {
    if (this.unavailable) return false
    try {
      messaging()
      return true
    } catch {
      // Android until google-services.json exists. Logged once, not per event.
      console.log(
        "[PushNotificationService] Firebase messaging is not configured on this platform — push disabled"
      )
      this.unavailable = true
      return false
    }
  }

  // --- Permission ---------------------------------------------------------

  /** Whether notifications are already allowed. Never prompts. */
  public async hasPermission(): Promise<boolean> {
    if (!this.isAvailable()) return false
    try {
      const status = await messaging().hasPermission()
      return (
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL
      )
    } catch {
      return false
    }
  }

  /**
   * Shows the system permission prompt. Call this only from a moment where the
   * customer can see why it's being asked — the one system prompt iOS allows is
   * spent here.
   */
  public async requestPermissionWithPrompt(): Promise<boolean> {
    if (!this.isAvailable()) return false
    try {
      const status = await messaging().requestPermission()
      return (
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL
      )
    } catch {
      return false
    }
  }

  // --- Token --------------------------------------------------------------

  /**
   * Sends the device's FCM token to the backend, if there is one to send.
   *
   * Returns false rather than throwing on every failure path — a customer whose
   * push registration fails should still get a working app, and the next launch
   * tries again.
   */
  public async register(
    apiCall: (registrationToken: string) => Promise<unknown>
  ): Promise<boolean> {
    if (!this.isAvailable()) return false

    // Check, don't ask. Registration runs on every authenticated launch, so
    // prompting from here would be prompting at launch.
    if (!(await this.hasPermission())) return false

    try {
      const token = await messaging().getToken()
      if (!token) return false
      if (token === this.registeredToken) return true

      await apiCall(token)
      this.registeredToken = token
      return true
    } catch (error) {
      console.log("[PushNotificationService] Token registration failed:", error)
      return false
    }
  }

  /**
   * FCM rotates tokens (app restore, reinstall, some OS updates). A rotated
   * token that is never re-sent means the backend keeps pushing to a dead one,
   * which fails silently on its end — the customer just stops getting anything.
   */
  public watchTokenRefresh(
    apiCall: (registrationToken: string) => Promise<unknown>
  ): void {
    if (!this.isAvailable()) return
    if (this.tokenRefreshUnsubscribe) return

    try {
      this.tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (token) => {
        if (!token || token === this.registeredToken) return
        try {
          await apiCall(token)
          this.registeredToken = token
        } catch (error) {
          console.log("[PushNotificationService] Token refresh sync failed:", error)
        }
      })
    } catch {
      // Non-fatal: the next launch re-registers whatever the current token is.
    }
  }

  /**
   * The registered token is per-user on the backend (it deletes by
   * {userId, userType} before saving), so signing in as somebody else on the
   * same device correctly moves it. This only clears the local memo, so the
   * next sign-in actually re-sends instead of short-circuiting on
   * `token === this.registeredToken`.
   */
  public forgetRegisteredToken(): void {
    this.registeredToken = null
  }

  // --- Incoming messages --------------------------------------------------

  /**
   * A push that lands while the app is open, routed into the same slide-down
   * banner the socket path uses, in the same shape — so a notification looks
   * identical however it arrived.
   *
   * In the normal case this never fires: the backend sends over the socket when
   * the customer is connected and only falls back to push when they aren't. It
   * matters in the gap — socket dropped, app still foregrounded — which is
   * exactly when a silent notification would be least explicable.
   */
  public startForegroundListener(
    onNotification: (parsed: ParsedNotification) => void
  ): void {
    if (!this.isAvailable()) return
    if (this.foregroundUnsubscribe) return

    try {
      this.foregroundUnsubscribe = messaging().onMessage(
        async (remoteMessage: RemoteMessage) => {
          const parsed = this.parse(remoteMessage)
          if (!parsed) return

          // Chat messages belong to the "message:new" banner, which carries the
          // pro's avatar and can open the thread; push has no chat preview to
          // give it.
          //
          // This filter is also load-bearing in a way that is easy to miss:
          // the chat notification path is the ONE customer path that is not a
          // socket-XOR-push choice. message-notification.listener.ts resolves
          // its socket branch to Promise.resolve() and the real emit lives in a
          // second, independent listener with its own isUserConnected check, so
          // both channels can fire for the same message. Nothing double-renders
          // today only because this line drops the push copy. Do not relax it
          // for "richer chat pushes" without deduping first.
          if (parsed.event.startsWith("system.messages:")) return

          onNotification(parsed)
        }
      )
    } catch {
      // Non-fatal.
    }
  }

  /**
   * Tapping a notification from the tray or the lock screen, both while the app
   * is backgrounded and from a cold start.
   */
  public startTapListener(): void {
    if (!this.isAvailable()) return
    if (this.tapUnsubscribe) return

    try {
      this.tapUnsubscribe = messaging().onNotificationOpenedApp(
        (remoteMessage: RemoteMessage) => this.routeTap(remoteMessage)
      )

      // Cold start: the app was not running when the notification was tapped.
      messaging()
        .getInitialNotification()
        .then((remoteMessage: RemoteMessage | null) => {
          if (remoteMessage) this.routeTap(remoteMessage)
        })
        .catch(() => undefined)
    } catch {
      // Non-fatal.
    }
  }

  // --- Internals ----------------------------------------------------------

  /**
   * The backend sends `data: { event, payload: JSON.stringify(payload) }` and a
   * separate `notification: { title, body }` (see PushNotificationService
   * .sendPushNotification). Title and body are already resolved and localised
   * server-side, so nothing here translates anything.
   */
  private parse(remoteMessage: RemoteMessage): ParsedNotification | null {
    const event = dataString(remoteMessage, "event") ?? ""
    if (!event) return null

    let payload: any = {}
    try {
      payload = JSON.parse(dataString(remoteMessage, "payload") ?? "{}")
    } catch {
      payload = {}
    }

    // Same rule the socket handler applies: a body is required, not just one of
    // the two. An unseeded config row is synthesised server-side as empty
    // strings rather than skipped, so a half-configured event arrives with
    // nothing to say — better dropped than rendered as a title over a blank.
    const body = remoteMessage.notification?.body || payload?.body || ""
    if (!body) return null

    return {
      event,
      title: remoteMessage.notification?.title || payload?.title || "",
      body,
      jobId: typeof payload?.jobId === "number" ? payload.jobId : undefined,
      jobStatus:
        typeof payload?.job?.status === "string" ? payload.job.status : undefined,
      // Top-level. The backend omits `pros` from the job it serialises, so the
      // food order's status is sent as its own field rather than dug out of
      // job.pros[0] — which is always undefined on the wire.
      foodStatus:
        typeof payload?.foodOrderStatus === "string"
          ? payload.foodOrderStatus
          : undefined,
    }
  }

  private routeTap(remoteMessage: RemoteMessage): void {
    const parsed = this.parse(remoteMessage)
    const event = parsed?.event ?? dataString(remoteMessage, "event") ?? ""

    if (event.startsWith("system.messages:")) {
      navigateFromRef("HomeTabs", { screen: "messages" })
      return
    }

    // The banner's own rule, imported rather than reimplemented. It knows that
    // the review reminder carries a jobId but must NOT open the job screen —
    // a copy here drifted from it immediately.
    const destination = parsed ? destinationFor(parsed) : null
    if (destination) {
      navigateFromRef(destination.screen, { jobId: destination.jobId })
      return
    }

    // Everything else lands on the notifications list, which is never wrong:
    // it is where the notification is, whatever it was about.
    navigateFromRef("NotificationsScreen", undefined)
  }
}

export const PushNotifications = new PushNotificationServiceClass()
