// Firebase 26 deleted the namespaced API; deleteToken is now modular and takes
// the Messaging instance.
import { deleteToken, getMessaging } from "@react-native-firebase/messaging"
import { api } from "services/api"
import { PushNotifications } from "services/PushNotificationService"
import { store } from "store"
import { logout } from "store/auth/slice"

/*
 * Sign-out, in the order that leaves a signed-out phone quiet. Same shape as
 * proapp's services/session — keep the two aligned.
 *
 * Logging out used to be local only: clear the auth slice, wipe the cache,
 * drop the socket. The backend never heard about it, so its one push row per
 * user still held this phone's token, and with the socket gone every event
 * for the account came here as a push.
 *
 *   1. Tell the backend to drop this token, while the auth token still works.
 *      The call names the token, so one that lands late (after a quick
 *      re-login registered under a NEW token) cannot delete the new row.
 *   2. Kill the token at Firebase, so pushes die even if step 1 never
 *      arrived. Errors ignored, like step 1 (and on Android without Firebase
 *      configured, messaging() throws — same outcome).
 *   Both steps are capped: an offline or black-holed phone must not hang the
 *   sign-out (Firebase's delete alone can sit on a 60 s request timeout).
 *   3. The local sign-out, in `finally`: always, and only after the network
 *      steps — the phone should be quiet before the isAuth flip drops the
 *      socket and forgets the registered token (usePushNotifications).
 *
 * Runs once even when several callers race. The base query's own 401 path
 * cannot import this module (it imports the api); it does steps 2 and 3
 * inline with no valid token for step 1.
 *
 * If a DIFFERENT account signed in while the network steps were still
 * running (that 401 path ended the session mid-way, then a quick sign-in as
 * somebody else), step 3 is skipped: wiping the new session would strand it
 * on a signed-in screen with no token.
 *
 * Accepted: signed out while offline, both network steps fail and the phone
 * keeps its pushes until the next sign-in on it replaces the row.
 */
export const REMOVE_TOKEN_TIMEOUT_MS = 3000

let signingOut = false

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number
): Promise<T | undefined> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export const signOut = async (): Promise<void> => {
  if (signingOut) return
  signingOut = true
  const { dispatch } = store
  const startedAs = store.getState().auth.user?.id
  try {
    // Step 1 needs a session to speak for; without an auth token the call
    // would only earn a 401.
    const registrationToken = PushNotifications.getRegisteredToken()
    if (registrationToken && store.getState().auth.token) {
      await withTimeout(
        dispatch(
          api.endpoints.removeNotificationsDevice.initiate({ registrationToken })
        ).unwrap(),
        REMOVE_TOKEN_TIMEOUT_MS
      ).catch(() => undefined)
    }
    await withTimeout(
      Promise.resolve().then(() => deleteToken(getMessaging())),
      REMOVE_TOKEN_TIMEOUT_MS
    ).catch(() => undefined)
  } finally {
    if (store.getState().auth.user?.id === startedAs) {
      dispatch(logout())
      dispatch(api.util.resetApiState())
    }
    signingOut = false
  }
}
