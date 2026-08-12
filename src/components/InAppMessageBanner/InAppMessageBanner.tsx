import React, { useEffect, useRef, useState } from "react"
import { Animated, Dimensions, TouchableOpacity } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PanGestureHandler, State } from "react-native-gesture-handler"
import FastImage from "react-native-fast-image"

import { messageBannerEventBus } from "events/messageBannerEventBus"
import { navigateFromRef, navigationRef } from "navigation/navigationRef"
import { setActiveChat } from "services/chatCache"
import { useTypedSelector } from "store"
import { ChatPreviewType } from "types/chat"

const DURATION = 5000

// A chat message opens the thread and shows the pro's avatar; anything else
// (an offer arriving or being revised, a food order moving) opens the job when
// the event carries one and falls back to the notifications list when it does
// not. Kept as one component rather than two overlays so a message and a
// notification landing together replace each other instead of stacking.
type Banner =
  | { kind: "message"; chatPreview: ChatPreviewType; title: string; body: string }
  | {
      kind: "notification"
      event: string
      title: string
      body: string
      jobId?: number
    }

// The review reminder carries a jobId like the job events do, but the job
// screen is not where you leave a review — send it to the pro picker instead.
const REVIEW_EVENT = "system.account:customer.jobs.review"

// A job in one of these is over: the customer has to act (order elsewhere),
// and the update must never be swallowed by the on-screen suppression below.
const ORDER_ENDED_STATUSES = ["declined", "cancelledByPro", "cancelled"]
// The food order's own terminal status, set unconditionally by the cancel
// itself — unlike job.status, which depends on a backend settle step that can
// bail silently.
const ORDER_ENDED_FOOD_STATUSES = ["cancelled"]

/**
 * Where a notification tap should land, or null to stay put.
 *
 * Exported because push taps must land in the same place as banner taps. When
 * the push handler had its own copy of this rule, a review reminder opened
 * ReviewProSelectionScreen from a banner and NotificationsScreen from the
 * lock screen — same notification, two destinations, depending only on whether
 * the customer happened to have the app open.
 */
export const destinationFor = (
  // Narrowed to what it actually reads, so the push handler — which has a
  // ParsedNotification and no banner "kind" — can call the same function
  // instead of keeping a second copy of the rule.
  banner: { event: string; jobId?: number }
): { screen: "JobDetailScreen" | "ReviewProSelectionScreen"; jobId: number } | null => {
  if (!banner.jobId) return null
  return {
    screen: banner.event === REVIEW_EVENT ? "ReviewProSelectionScreen" : "JobDetailScreen",
    jobId: banner.jobId,
  }
}

/**
 * Global in-app message banner (customer app). Renders as a slide-down toast
 * when a pro's message arrives while the customer is on another screen — the
 * customer-side twin of the proapp's InAppNotification. Driven by
 * messageBannerEventBus (not Redux, so it never persists). Mount ONCE, as an
 * overlay sibling of the navigator.
 *
 * Slide down on arrive, auto-dismiss after 5s, swipe up to dismiss, tap to
 * open the chat.
 */
const InAppMessageBanner: React.FC = () => {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-200)).current
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const [banner, setBanner] = useState<Banner | null>(null)
  const { isAuth } = useTypedSelector((store) => store.auth)

  // This overlay is mounted outside the auth gate, so a banner already on
  // screen when the session ends would sit there for the rest of its 5s — the
  // previous account's text, still tappable into their job. Nothing new can
  // arrive (the socket handler is torn down), but what is already up has to go.
  useEffect(() => {
    if (!isAuth) {
      if (timer.current) clearTimeout(timer.current)
      setBanner(null)
    }
  }, [isAuth])

  useEffect(() => {
    const handler = ({ chatPreview, body }: { chatPreview: ChatPreviewType; body: string }) => {
      const title =
        chatPreview.chat.pro?.businessName || chatPreview.chat.pro?.registeredName || "New message"
      setBanner({ kind: "message", chatPreview, title, body })
    }
    const notificationHandler = ({
      event,
      title,
      body,
      jobId,
      jobStatus,
      foodStatus,
    }: {
      event: string
      title: string
      body: string
      jobId?: number
      jobStatus?: string
      foodStatus?: string
    }) => {
      const next: Banner = { kind: "notification", event, title, body, jobId }
      // Don't announce what the customer is already watching. The same socket
      // event invalidates the Jobs cache, so a job screen live-updates in front
      // of them — a banner on top of that is noise reporting a change they just
      // saw happen. The chat banner suppresses the same way for the open chat.
      //
      // EXCEPT when the news ends the order. "Preparing" turning into "On the
      // way" is a status line quietly changing, and the customer watching it
      // does not need telling twice. A cancellation is the same quiet change
      // and must NOT be missed — it is the one update that requires them to do
      // something, and swallowing it because they happened to be on the screen
      // is exactly when it gets missed.
      //
      // Keyed on status, not on the copy. Matching words like "cancel" in the
      // title would work in English and silently fail in Arabic, and break
      // again the next time the wording changes.
      //
      // BOTH statuses are checked, because job.status is the less reliable of
      // the two. It only reaches a terminal value if the backend's
      // settleFoodJobIfUndeliverable succeeded, and that bails silently on
      // several conditions and swallows its own errors. The food order's own
      // status is set unconditionally by the cancel itself, so it is the
      // dependable signal. Relying on job.status alone meant this carve-out
      // failed CLOSED — suppressing the cancellation banner for the customer
      // sitting on the order screen, the exact case it exists to cover.
      const isOrderEnded =
        ORDER_ENDED_STATUSES.includes(jobStatus ?? "") ||
        ORDER_ENDED_FOOD_STATUSES.includes(foodStatus ?? "")

      const current = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null
      const destination = destinationFor(next)
      if (
        !isOrderEnded &&
        destination &&
        current?.name === destination.screen &&
        (current.params as { jobId?: number } | undefined)?.jobId === destination.jobId
      ) {
        return
      }
      setBanner(next)
    }
    messageBannerEventBus.on("message:new", handler)
    messageBannerEventBus.on("notification:new", notificationHandler)
    return () => {
      messageBannerEventBus.off("message:new", handler)
      messageBannerEventBus.off("notification:new", notificationHandler)
    }
  }, [])

  // Slide in + arm auto-dismiss whenever a new banner is set. A newer message
  // replaces the current one and restarts the timer.
  useEffect(() => {
    if (!banner) return
    translateY.setValue(-200)
    Animated.spring(translateY, {
      toValue: insets.top + 10,
      useNativeDriver: true,
      tension: 30,
      friction: 10,
    }).start()
    timer.current = setTimeout(() => dismiss(), DURATION)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner])

  const dismiss = (fast = false) => {
    if (timer.current) clearTimeout(timer.current)
    Animated.timing(translateY, {
      toValue: -200,
      duration: fast ? 250 : 500,
      useNativeDriver: true,
    }).start(() => setBanner(null))
  }

  const handlePress = () => {
    if (!banner) return
    if (banner.kind === "message") {
      // Pre-mark the chat active so the message the banner announced doesn't
      // also bump the badge once the chat mounts.
      setActiveChat(banner.chatPreview.chat.id)
      dismiss(true)
      navigateFromRef("MessagesDetailsScreen", { chatPreview: banner.chatPreview })
      return
    }
    dismiss(true)
    // Straight to what it is about when the event named a job — that is where a
    // new or revised offer is actually acted on. Without one there is no single
    // right destination, so the notifications list is the honest fallback.
    const destination = destinationFor(banner)
    if (!destination) {
      navigateFromRef("NotificationsScreen", undefined)
    } else if (destination.screen === "ReviewProSelectionScreen") {
      navigateFromRef("ReviewProSelectionScreen", { jobId: destination.jobId })
    } else {
      navigateFromRef("JobDetailScreen", { jobId: destination.jobId })
    }
  }

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  )

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent
      if (translationY < -50 || velocityY < -500) {
        dismiss()
      } else {
        Animated.spring(translateY, {
          toValue: insets.top + 10,
          useNativeDriver: true,
          tension: 25,
          friction: 10,
        }).start()
      }
    }
  }

  if (!banner) return null

  // Only a chat message has a pro to show a face for; a system notification
  // falls through to the initial circle, which reads as the app itself.
  const photo =
    banner.kind === "message"
      ? banner.chatPreview.chat.pro?.profilePhoto150 ||
        banner.chatPreview.chat.pro?.profilePhoto
      : undefined

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetY={[-10, 10]}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          width: Dimensions.get("window").width - 32,
          zIndex: 9999,
          transform: [{ translateY }],
        }}
      >
        <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
          <DmView
            className="bg-white rounded-12 overflow-hidden border-0.5 border-grey5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.18,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <DmView className="flex-row items-center p-[14]">
              {photo ? (
                <DmView className="w-[40] h-[40] rounded-full overflow-hidden mr-[12]">
                  <FastImage
                    source={{ uri: photo }}
                    style={{ width: 40, height: 40 }}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                </DmView>
              ) : (
                <DmView className="w-[40] h-[40] rounded-full bg-red items-center justify-center mr-[12]">
                  <DmText className="text-white text-16 font-custom600">
                    {(banner.title || "Tappler").charAt(0)}
                  </DmText>
                </DmView>
              )}
              <DmView className="flex-1">
                <DmView className="flex-row items-center justify-between mb-[2]">
                  <DmText
                    className="text-15 font-custom600 text-black flex-1"
                    numberOfLines={1}
                  >
                    {/* A config row seeded with a body but no title is a real
                        state (see useChatSocket) — fall back rather than
                        rendering a blank bold line above the message. */}
                    {banner.title || "Tappler"}
                  </DmText>
                  <DmText className="text-11 font-custom400 text-grey3 ml-[8]">now</DmText>
                </DmView>
                <DmText className="text-13 font-custom400 text-grey2" numberOfLines={2}>
                  {banner.body}
                </DmText>
              </DmView>
            </DmView>
          </DmView>
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  )
}

export default InAppMessageBanner
