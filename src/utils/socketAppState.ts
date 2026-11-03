import {
  createForegroundTracker,
  type AppStateName,
} from "@tappler/shared/src/store/foregroundReturn"

/*
 * What the chat socket does on each AppState change (useChatSocket), as
 * proapp has done since pa#164:
 *
 * - `background` disconnects. It has to be prompt: the server skips the push
 *   while a socket is connected, so a socket left up would swallow pushes.
 * - iOS `inactive` does nothing. Control Center, Notification Center, Face ID,
 *   a permission alert and the 3DS sheet all pass through it without the app
 *   leaving; dropping the socket there meant a reconnect and a refetch of the
 *   chats and notifications each time.
 * - `active` reconnects if the socket is down (a no-op when it stayed up), and
 *   refetches only on a real return from the background (shared's
 *   createForegroundTracker), since only then were events missed.
 */
export type SocketAppStateStep = {
  connectIfDown: boolean
  refetch: boolean
  disconnect: boolean
}

export const createSocketAppStatePlanner = () => {
  const track = createForegroundTracker()
  return (next: AppStateName): SocketAppStateStep => ({
    connectIfDown: next === "active",
    refetch: track(next) !== null,
    disconnect: next === "background",
  })
}
